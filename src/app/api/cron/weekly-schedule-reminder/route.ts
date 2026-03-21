import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DAYS_RU = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
const DAYS_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS_RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']

function getNextWeekDates(): Record<number, string> {
  const now = new Date()
  const jsDay = now.getDay()
  // Следующий понедельник
  const daysUntilNextMonday = jsDay === 0 ? 1 : 8 - jsDay
  const monday = new Date(now)
  monday.setDate(now.getDate() + daysUntilNextMonday)
  const dates: Record<number, string> = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates[i + 1] = d.toISOString().split('T')[0]
  }
  return dates
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`
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

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminChatId = process.env.ADMIN_CHAT_ID
  if (!adminChatId) {
    return NextResponse.json({ error: 'ADMIN_CHAT_ID not set' }, { status: 500 })
  }

  const nextWeek = getNextWeekDates()
  const monday = nextWeek[1]
  const sunday = nextWeek[7]

  // Загружаем шаблон расписания и overrides на следующую неделю
  const [{ data: schedule }, { data: overrides }] = await Promise.all([
    supabase.from('schedule').select('*').order('day_of_week').order('time_start'),
    supabase.from('schedule_overrides').select('*').gte('date', monday).lte('date', sunday),
  ])

  const slots = schedule || []
  const ovList = overrides || []

  // Строим сообщение
  const mondayDate = new Date(monday + 'T00:00:00')
  const sundayDate = new Date(sunday + 'T00:00:00')
  const weekLabel = `${mondayDate.getDate()} ${MONTHS_RU[mondayDate.getMonth()]} — ${sundayDate.getDate()} ${MONTHS_RU[sundayDate.getMonth()]}`

  let text = `📅 <b>Расписание на следующую неделю</b>\n${weekLabel}\n\n`

  let hasContent = false
  for (let day = 1; day <= 7; day++) {
    const daySlots = slots.filter(s => s.day_of_week === day)
    if (daySlots.length === 0) continue
    hasContent = true

    const dateStr = nextWeek[day]
    text += `<b>${DAYS_RU[day]}, ${formatDate(dateStr)}</b>\n`

    for (const slot of daySlots) {
      const override = ovList.find(o => o.date === dateStr && o.group_name === slot.group_name)
      const time = slot.time_start?.slice(0, 5) || ''

      if (override?.cancelled) {
        text += `  ${time} ${slot.group_name} — ❌ <i>отменено</i>${override.note ? ` (${override.note})` : ''}\n`
      } else if (override?.trainer_name) {
        text += `  ${time} ${slot.group_name} — 🔄 ${override.trainer_name} <i>(замена)</i>\n`
      } else {
        text += `  ${time} ${slot.group_name} — ${slot.trainer_name || '—'}\n`
      }
    }
    text += '\n'
  }

  if (!hasContent) {
    text += '<i>Расписание не заполнено</i>\n\n'
  }

  // Изменения на неделе
  if (ovList.length > 0) {
    text += `⚡ <b>Внесено изменений: ${ovList.length}</b>\n`
  } else {
    text += `✅ Изменений не зафиксировано\n`
  }

  text += `\nЧтобы внести замены — откройте раздел <b>Расписание</b> в приложении`

  await sendTelegram(adminChatId, text)

  return NextResponse.json({ ok: true })
}
