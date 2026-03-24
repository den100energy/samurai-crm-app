import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID!

const TYPE_LABELS: Record<string, string> = {
  болезнь: '🤒 Болезнь',
  перенос: '🔄 Перенос занятия',
  жалоба:  '⚠️ Жалоба',
  вопрос:  '❓ Вопрос',
}

async function sendTelegram(text: string) {
  if (!BOT_TOKEN || !OWNER_CHAT_ID) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: OWNER_CHAT_ID, text, parse_mode: 'HTML' }),
  })
}

export async function POST(req: NextRequest) {
  const { ticket_id, actor, resolution_note } = await req.json()
  if (!ticket_id || !actor) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Получаем текущий тикет с именем ученика
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, students(name)')
    .eq('id', ticket_id)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (ticket.status === 'resolved') return NextResponse.json({ error: 'Already resolved' }, { status: 400 })

  const now = new Date().toISOString()
  const studentName = ticket.students?.name || 'Неизвестный'
  const typeLabel = TYPE_LABELS[ticket.type] ?? ticket.type

  let update: Record<string, string> = {}
  let tgText = ''

  if (ticket.status === 'pending') {
    update = { status: 'in_review', taken_by: actor, taken_at: now }
    tgText = [
      `🔄 <b>Обращение взято в работу</b>`,
      ``,
      `👤 Ученик: <b>${studentName}</b>`,
      `📋 Тип: ${typeLabel}`,
      ticket.description ? `📝 ${ticket.description}` : '',
      ``,
      `✋ Взял: <b>${actor}</b>`,
      `🕐 ${new Date(now).toLocaleString('ru-RU')}`,
    ].filter(Boolean).join('\n')
  } else if (ticket.status === 'in_review') {
    if (!resolution_note) return NextResponse.json({ error: 'resolution_note required' }, { status: 400 })
    update = { status: 'resolved', resolved_by: actor, resolved_at: now, resolution_note }
    const takenInfo = ticket.taken_by ? `✋ Взял: ${ticket.taken_by}` : ''
    tgText = [
      `✅ <b>Обращение решено</b>`,
      ``,
      `👤 Ученик: <b>${studentName}</b>`,
      `📋 Тип: ${typeLabel}`,
      ticket.description ? `📝 Вопрос: ${ticket.description}` : '',
      ``,
      `💬 Как решили: <b>${resolution_note}</b>`,
      ``,
      takenInfo,
      `✅ Решил: <b>${actor}</b>`,
      `🕐 ${new Date(now).toLocaleString('ru-RU')}`,
    ].filter(Boolean).join('\n')
  }

  const { data: updated } = await supabase
    .from('tickets')
    .update(update)
    .eq('id', ticket_id)
    .select('id, type, description, status, created_at, taken_by, taken_at, resolved_by, resolved_at, resolution_note')
    .single()

  // Отправляем Telegram уведомление (не блокируем ответ)
  sendTelegram(tgText).catch(console.error)

  return NextResponse.json({ ok: true, ticket: updated })
}
