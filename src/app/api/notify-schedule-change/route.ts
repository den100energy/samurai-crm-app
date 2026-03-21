import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MONTHS_RU = ['января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря']
const WEEKDAYS_RU = ['воскресенье','понедельник','вторник','среду','четверг','пятницу','субботу']

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${WEEKDAYS_RU[d.getDay()]}, ${d.getDate()} ${MONTHS_RU[d.getMonth()]}`
}

async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export async function POST(req: NextRequest) {
  const { override_id } = await req.json()
  if (!override_id) return NextResponse.json({ error: 'override_id required' }, { status: 400 })

  // Load override
  const { data: override } = await supabase
    .from('schedule_overrides')
    .select('*')
    .eq('id', override_id)
    .single()

  if (!override) return NextResponse.json({ error: 'Override not found' }, { status: 404 })

  // Find all active students in the group with telegram_chat_id
  const { data: students } = await supabase
    .from('students')
    .select('id, name, telegram_chat_id')
    .eq('group_name', override.group_name)
    .eq('status', 'active')
    .not('telegram_chat_id', 'is', null)

  // Find contacts (parents) of students in this group
  const studentIds = (students || []).map(s => s.id)
  let contacts: { telegram_chat_id: string }[] = []
  if (studentIds.length > 0) {
    const { data: c } = await supabase
      .from('student_contacts')
      .select('telegram_chat_id')
      .in('student_id', studentIds)
      .not('telegram_chat_id', 'is', null)
    contacts = c || []
  }

  // Build message
  const dateFormatted = formatDate(override.date)
  let text = `📅 <b>Изменение расписания</b>\n\n`
  text += `Группа: <b>${override.group_name}</b>\n`
  text += `Дата: ${dateFormatted}\n`
  if (override.cancelled) {
    text += `\n❌ <b>Тренировка отменена</b>`
  } else if (override.trainer_name) {
    text += `Тренер: ${override.trainer_name}`
  }
  if (override.note) {
    text += `\n💬 ${override.note}`
  }

  // Collect unique chat IDs (students + parents)
  const chatIds = new Set<string>()
  ;(students || []).forEach(s => { if (s.telegram_chat_id) chatIds.add(s.telegram_chat_id) })
  contacts.forEach(c => { if (c.telegram_chat_id) chatIds.add(c.telegram_chat_id) })

  // Всегда дублируем в админский чат
  const adminChatId = process.env.ADMIN_CHAT_ID
  const adminText = `📅 <b>Изменение расписания отправлено ученикам</b>\n\nГруппа: <b>${override.group_name}</b>\nДата: ${formatDate(override.date)}\n${override.cancelled ? '❌ Тренировка отменена' : override.trainer_name ? `Тренер: ${override.trainer_name}` : ''}\nОтправлено: ${chatIds.size} чел.`

  await Promise.all([
    ...[...chatIds].map(chatId => sendTelegram(chatId, text)),
    adminChatId ? sendTelegram(adminChatId, adminText) : Promise.resolve(),
  ])

  // Mark as notified
  await supabase
    .from('schedule_overrides')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', override_id)

  return NextResponse.json({ sent: chatIds.size })
}
