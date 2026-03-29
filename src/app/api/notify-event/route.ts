import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  // Find students with telegram_chat_id (filtered by group if restricted)
  let query = supabase
    .from('students')
    .select('id, name, telegram_chat_id, group_name')
    .eq('status', 'active')
    .not('telegram_chat_id', 'is', null)

  if (event.group_restriction && event.group_restriction.length > 0) {
    query = query.in('group_name', event.group_restriction)
  }

  const { data: students } = await query

  // Also get contacts with telegram_chat_id
  const studentIds = (students || []).map(s => s.id)
  const { data: contacts } = studentIds.length > 0
    ? await supabase
        .from('student_contacts')
        .select('telegram_chat_id')
        .in('student_id', studentIds)
        .not('telegram_chat_id', 'is', null)
    : { data: [] }

  // Build message
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

  // Collect unique chat IDs
  const chatIds = new Set<number>()
  for (const s of students || []) {
    if (s.telegram_chat_id) chatIds.add(s.telegram_chat_id)
  }
  for (const c of contacts || []) {
    if (c.telegram_chat_id) chatIds.add(c.telegram_chat_id)
  }

  // Admin chat message
  const adminChatId = process.env.ADMIN_CHAT_ID
  const adminText = `📨 Уведомление о мероприятии отправлено\n\n${text}\n\n✅ Отправлено: ${chatIds.size} получателей`

  await Promise.all([
    ...[...chatIds].map(chatId => sendTelegram(chatId, text)),
    adminChatId ? sendTelegram(adminChatId, adminText) : Promise.resolve(),
  ])

  return NextResponse.json({ sent: chatIds.size })
}
