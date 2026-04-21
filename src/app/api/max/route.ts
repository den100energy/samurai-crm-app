// Webhook для Макс Bot API.
// Обрабатывает 2 типа событий:
//   1. bot_started — пользователь перешёл по диплинку https://max.ru/<bot>?start=<TOKEN>
//      В payload приходит наш invite-токен → автопривязка
//   2. message_created — обычное сообщение от пользователя
//      Fallback: ищем "/start TOKEN" в тексте (на случай ручного ввода)
//
// MAX требует ответ HTTP 200 в течение 30 секунд.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { linkUserChannel } from '@/lib/notifications'
import { sendMaxMessage } from '@/lib/notifications/adapters/max'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const SECRET = process.env.MAX_WEBHOOK_SECRET || ''

function ok() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  // Проверка секрета (если задан)
  if (SECRET) {
    const headerSecret = req.headers.get('x-max-bot-api-secret')
    if (headerSecret !== SECRET) {
      return new NextResponse('forbidden', { status: 403 })
    }
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new NextResponse('bad request', { status: 400 })
  }

  const updateType = body?.update_type

  // 1. Запуск бота по диплинку: payload = наш invite-токен
  if (updateType === 'bot_started') {
    const userId = body?.user?.user_id
    const payload: string | undefined = body?.payload
    if (userId && payload) {
      await handleStart(Number(userId), String(payload))
    } else if (userId) {
      await sendMaxMessage(String(userId),
        'Привет! Это бот Школы Самурая. Чтобы получать уведомления, перейдите по invite-ссылке от тренера.')
    }
    return ok()
  }

  // 2. Обычное сообщение
  if (updateType === 'message_created') {
    const message = body?.message
    const fromId = message?.sender?.user_id
    const text: string = message?.body?.text || ''
    if (!fromId) return ok()

    // Ищем токен в тексте: "/start TOKEN" или просто "TOKEN"
    const m = text.match(/^\/?start\s+(\S+)/i)
    const token = m ? m[1] : null

    if (token) {
      await handleStart(Number(fromId), token)
    } else {
      // Уже привязан?
      const { data: ch } = await supabase
        .from('user_channels')
        .select('user_type, user_id')
        .eq('provider', 'max')
        .eq('chat_id', String(fromId))
        .maybeSingle()

      if (ch) {
        await sendMaxMessage(String(fromId),
          'Вы уже подключены к Школе Самурая. Уведомления будут приходить сюда.')
      } else {
        await sendMaxMessage(String(fromId),
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

  // Лид
  const { data: lead } = await supabase
    .from('leads').select('id, full_name').eq('invite_token', token).maybeSingle()
  if (lead) {
    await linkUserChannel(lead.id, 'lead', 'max', chatId)
    await sendMaxMessage(chatId,
      `Привет! Вы успешно подключены к карточке ${lead.full_name}.\n\n` +
      `Теперь вы будете получать уведомления о занятиях и абонементе.`)
    return
  }

  // Ученик
  const { data: student } = await supabase
    .from('students').select('id, name, cabinet_token').eq('invite_token', token).maybeSingle()
  if (student) {
    await linkUserChannel(student.id, 'student', 'max', chatId)
    const cabinetLine = student.cabinet_token && appUrl
      ? `\n\nЛичный кабинет: ${appUrl}/cabinet/${student.cabinet_token}`
      : ''
    await sendMaxMessage(chatId,
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
    await linkUserChannel(contact.id, 'contact', 'max', chatId)
    const s = contact.students as any
    const studentName = s?.name || 'ученика'
    const cabinetLine = s?.cabinet_token && appUrl
      ? `\n\nКабинет ученика: ${appUrl}/cabinet/${s.cabinet_token}`
      : ''
    await sendMaxMessage(chatId,
      `Привет! Вы подключены как контакт ученика ${studentName}.\n\n` +
      `Теперь вы будете получать уведомления от Школы Самурая.${cabinetLine}`)
    return
  }

  // Тренер
  if (token.startsWith('tr_')) {
    const { data: trainer } = await supabase
      .from('trainers').select('id, name').eq('telegram_invite_token', token).maybeSingle()
    if (trainer) {
      await linkUserChannel(trainer.id, 'trainer', 'max', chatId)
      await sendMaxMessage(chatId,
        `Привет! Макс успешно привязан к профилю тренера ${trainer.name}.\n\n` +
        `Теперь уведомления о пропущенных отметках посещаемости будут приходить сюда.`)
      return
    }
  }

  await sendMaxMessage(chatId,
    'Ссылка не распознана или устарела. Попросите тренера отправить новую invite-ссылку.')
}

export async function GET() {
  return new NextResponse('ok')
}
