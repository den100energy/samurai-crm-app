// Webhook для VK Callback API.
// Обрабатывает 2 типа событий:
//   1. confirmation — VK проверяет подлинность сервера (вернуть VK_CONFIRMATION_CODE)
//   2. message_new — пользователь написал боту (привязка по ref/токену)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { linkUserChannel } from '@/lib/notifications'
import { sendVkMessage } from '@/lib/notifications/adapters/vk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const CONFIRMATION_CODE = process.env.VK_CONFIRMATION_CODE || ''
const SECRET = process.env.VK_CALLBACK_SECRET || ''
const GROUP_ID = Number(process.env.VK_GROUP_ID || 0)

function ok() {
  // VK ждёт строку 'ok' в ответ на любое событие, кроме confirmation
  return new NextResponse('ok')
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return new NextResponse('bad request', { status: 400 })
  }

  // 1. Подтверждение сервера
  if (body?.type === 'confirmation') {
    if (GROUP_ID && body.group_id !== GROUP_ID) {
      return new NextResponse('wrong group', { status: 403 })
    }
    return new NextResponse(CONFIRMATION_CODE)
  }

  // 2. Проверка secret (если задан в env)
  if (SECRET && body?.secret !== SECRET) {
    return new NextResponse('forbidden', { status: 403 })
  }

  // 3. Новое сообщение
  if (body?.type === 'message_new') {
    const message = body.object?.message
    if (!message) return ok()

    const fromId = message.from_id
    const text: string = message.text || ''
    if (!fromId) return ok()
    console.log('[vk] message_new from', fromId, 'text:', text, 'ref:', message.ref)

    // Ищем токен в трёх местах:
    //  1) message.ref — приходит когда пользователь перешёл по vk.me/group?ref=TOKEN
    //  2) message.payload — JSON-строка кнопки "Начать" (может содержать ref)
    //  3) Текст сообщения вида "/start TOKEN" или просто "TOKEN"
    let token: string | null = null

    if (message.ref) {
      token = String(message.ref)
    } else if (message.payload) {
      try {
        const p = JSON.parse(message.payload)
        if (p?.ref) token = String(p.ref)
      } catch { /* not JSON, ignore */ }
    }

    if (!token) {
      const m = text.match(/^\/?start\s+(\S+)/i)
      if (m) token = m[1]
    }

    if (token) {
      await handleStart(fromId, token)
    } else {
      // Привязан ли уже этот VK-пользователь?
      const { data: ch } = await supabase
        .from('user_channels')
        .select('user_type, user_id')
        .eq('provider', 'vk')
        .eq('chat_id', String(fromId))
        .maybeSingle()

      if (ch) {
        await sendVkMessage(String(fromId),
          'Вы уже подключены к Школе Самурая. Уведомления будут приходить сюда.')
      } else {
        await sendVkMessage(String(fromId),
          'Привет! Это бот Школы Самурая. Чтобы получать уведомления о занятиях и абонементе, перейдите по invite-ссылке от тренера.')
      }
    }

    return ok()
  }

  return ok()
}

async function handleStart(fromId: number, token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const chatId = String(fromId)
  console.log('[vk] handleStart token:', token)

  // Лид
  const { data: lead } = await supabase
    .from('leads').select('id, full_name').eq('invite_token', token).maybeSingle()
  if (lead) {
    console.log('[vk] matched lead:', lead.id)
    await linkUserChannel(lead.id, 'lead', 'vk', chatId)
    await sendVkMessage(chatId,
      `Привет! Вы успешно подключены к карточке ${lead.full_name}.\n\n` +
      `Теперь вы будете получать уведомления о занятиях и абонементе.`)
    return
  }

  // Ученик
  const { data: student } = await supabase
    .from('students').select('id, name, cabinet_token').eq('invite_token', token).maybeSingle()
  if (student) {
    console.log('[vk] matched student:', student.id)
    await linkUserChannel(student.id, 'student', 'vk', chatId)
    const cabinetLine = student.cabinet_token && appUrl
      ? `\n\nЛичный кабинет: ${appUrl}/cabinet/${student.cabinet_token}`
      : ''
    await sendVkMessage(chatId,
      `Привет, ${student.name}! Вы успешно подключены.\n\n` +
      `Теперь вы будете получать уведомления о занятиях и абонементе.${cabinetLine}`)
    return
  }

  // Контакт (родитель)
  const { data: contact } = await supabase
    .from('student_contacts')
    .select('id, name, students(name, cabinet_token)')
    .eq('invite_token', token).maybeSingle()
  if (contact) {
    console.log('[vk] matched contact:', contact.id)
    await linkUserChannel(contact.id, 'contact', 'vk', chatId)
    const s = contact.students as any
    const studentName = s?.name || 'ученика'
    const cabinetLine = s?.cabinet_token && appUrl
      ? `\n\nКабинет ученика: ${appUrl}/cabinet/${s.cabinet_token}`
      : ''
    await sendVkMessage(chatId,
      `Привет! Вы подключены как контакт ученика ${studentName}.\n\n` +
      `Теперь вы будете получать уведомления от Школы Самурая.${cabinetLine}`)
    return
  }

  // Тренер
  if (token.startsWith('tr_')) {
    const { data: trainer } = await supabase
      .from('trainers').select('id, name').eq('telegram_invite_token', token).maybeSingle()
    if (trainer) {
      console.log('[vk] matched trainer:', trainer.id)
      await linkUserChannel(trainer.id, 'trainer', 'vk', chatId)
      await sendVkMessage(chatId,
        `Привет! VK успешно привязан к профилю тренера ${trainer.name}.\n\n` +
        `Теперь уведомления о пропущенных отметках посещаемости будут приходить сюда.`)
      return
    }
  }

  console.log('[vk] no match for token')
  await sendVkMessage(chatId,
    'Ссылка не распознана или устарела. Попросите тренера отправить новую invite-ссылку.')
}

// VK иногда шлёт GET (например, при проверке доступности URL). Просто отвечаем 200.
export async function GET() {
  return new NextResponse('ok')
}
