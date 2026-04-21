import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendToUser } from '@/lib/notifications'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendTelegram(chatId: number | string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export async function POST(req: NextRequest) {
  const { event_id } = await req.json()
  if (!event_id) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', event_id)
    .single()

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  // Find active students (filtered by group if restricted)
  let query = supabase
    .from('students')
    .select('id, name, telegram_chat_id, group_name')
    .eq('status', 'active')

  if (event.group_restriction && event.group_restriction.length > 0) {
    query = query.in('group_name', event.group_restriction)
  }

  const { data: students } = await query

  const studentIds = (students || []).map(s => s.id)
  const { data: contacts } = studentIds.length > 0
    ? await supabase
        .from('student_contacts')
        .select('id, student_id, telegram_chat_id')
        .in('student_id', studentIds)
    : { data: [] }

  const dateFormatted = new Date(event.date + 'T00:00:00').toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  let text = `🥋 <b>Мероприятие: ${event.name}</b>\n\n`
  text += `📅 ${dateFormatted}\n`
  if (event.trainer_name) text += `👤 Тренер: ${event.trainer_name}\n`
  if (event.trainer_name_extra) text += `👤 Доп. тренер: ${event.trainer_name_extra}\n`
  if (event.price) text += `💰 Стоимость: ${event.price.toLocaleString('ru-RU')} ₽\n`
  if (event.group_restriction && event.group_restriction.length > 0) text += `👥 Группы: ${event.group_restriction.join(', ')}\n`
  if (event.bonus_type) text += `🎁 Тип: ${event.bonus_type}\n`
  if (event.description) text += `\n${event.description}`

  // Отправляем через NotificationService (новый путь) с fallback на старый telegram_chat_id.
  // Дедупликация telegram fallback — через Set, чтобы родитель с двумя детьми не получил 2 сообщения.
  const fallbackChatIds = new Set<number | string>()
  let sentCount = 0

  for (const s of students || []) {
    const sent = await sendToUser(s.id, 'student', text)
    if (sent) sentCount++
    else if (s.telegram_chat_id) fallbackChatIds.add(s.telegram_chat_id)
  }

  for (const c of contacts || []) {
    const sent = await sendToUser(c.id, 'contact', text)
    if (sent) sentCount++
    else if (c.telegram_chat_id) fallbackChatIds.add(c.telegram_chat_id)
  }

  for (const chatId of fallbackChatIds) {
    await sendTelegram(chatId, text)
    sentCount++
  }

  const adminChatId = process.env.ADMIN_CHAT_ID
  if (adminChatId) {
    await sendTelegram(adminChatId, `📨 Уведомление о мероприятии отправлено\n\n${text}\n\n✅ Отправлено: ${sentCount} получателей`)
  }

  return NextResponse.json({ sent: sentCount })
}
