import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TRAINING_CHAT_ID = process.env.TELEGRAM_TRAINING_CHAT_ID!

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MONTHS_FULL  = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']

function fmtShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

function fmtDay(dateStr: string): string {
  return String(new Date(dateStr + 'T00:00:00').getDate())
}

// Прошлая неделя (пн–вс) относительно сегодня
function prevWeekRange(): { from: string; to: string; label: string } {
  const today = new Date()
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay() // 1=пн … 7=вс
  const lastMonday = new Date(today)
  lastMonday.setDate(today.getDate() - dayOfWeek - 6)
  const lastSunday = new Date(lastMonday)
  lastSunday.setDate(lastMonday.getDate() + 6)

  const from = lastMonday.toISOString().split('T')[0]
  const to   = lastSunday.toISOString().split('T')[0]

  const fromD = lastMonday.getDate()
  const toD   = lastSunday.getDate()
  const fromM = lastMonday.getMonth()
  const toM   = lastSunday.getMonth()
  const year  = lastSunday.getFullYear()

  const label = fromM === toM
    ? `${fromD}–${toD} ${MONTHS_SHORT[toM]} ${year}`
    : `${fromD} ${MONTHS_SHORT[fromM]} – ${toD} ${MONTHS_SHORT[toM]} ${year}`

  return { from, to, label }
}

async function sendTg(threadId: number | null, text: string) {
  const body: Record<string, unknown> = {
    chat_id: TRAINING_CHAT_ID,
    text,
    parse_mode: 'HTML',
  }
  if (threadId) body.message_thread_id = threadId

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) console.error('[weekly-report] TG error:', JSON.stringify(json))
}

// Разбить длинный текст на части ≤ 4096 символов по строкам
function splitMessage(text: string, limit = 4000): string[] {
  if (text.length <= limit) return [text]
  const lines = text.split('\n')
  const parts: string[] = []
  let current = ''
  for (const line of lines) {
    if ((current + '\n' + line).length > limit) {
      parts.push(current)
      current = line
    } else {
      current = current ? current + '\n' + line : line
    }
  }
  if (current) parts.push(current)
  return parts
}

export async function GET() {
  if (!BOT_TOKEN || !TRAINING_CHAT_ID) {
    return NextResponse.json({ error: 'Telegram not configured' }, { status: 500 })
  }

  const { from, to, label } = prevWeekRange()

  // Группы с настроенными темами (без Индивидуальных)
  const { data: configs } = await supabase
    .from('training_group_config')
    .select('group_name, telegram_thread_id')

  if (!configs || configs.length === 0) {
    return NextResponse.json({ error: 'No group configs' }, { status: 500 })
  }

  for (const cfg of configs) {
    const groupName: string = cfg.group_name
    const threadId: number | null = cfg.telegram_thread_id ?? null

    // Активные ученики группы (алфавит)
    const { data: students } = await supabase
      .from('students')
      .select('id, name')
      .eq('group_name', groupName)
      .eq('status', 'active')
      .order('name')

    if (!students || students.length === 0) continue

    // Посещаемость за неделю
    const studentIds = students.map(s => s.id)
    const { data: attRows } = await supabase
      .from('attendance')
      .select('student_id, date')
      .in('student_id', studentIds)
      .eq('group_name', groupName)
      .eq('present', true)
      .gte('date', from)
      .lte('date', to + 'T23:59:59')

    // Группируем по ученику
    const byStudent: Record<string, string[]> = {}
    for (const row of attRows || []) {
      const dateKey = String(row.date).slice(0, 10)
      if (!byStudent[row.student_id]) byStudent[row.student_id] = []
      if (!byStudent[row.student_id].includes(dateKey)) {
        byStudent[row.student_id].push(dateKey)
      }
    }

    // Сортируем даты внутри каждого ученика
    for (const id of Object.keys(byStudent)) {
      byStudent[id].sort()
    }

    const attended = students.filter(s => (byStudent[s.id]?.length ?? 0) > 0)
    const absent   = students.filter(s => (byStudent[s.id]?.length ?? 0) === 0)

    // Формат дат: "21, 23, 26 апр" — если все в одном месяце, месяц один раз в конце
    function formatDates(dates: string[]): string {
      if (dates.length === 0) return ''
      const months = [...new Set(dates.map(d => new Date(d + 'T00:00:00').getMonth()))]
      if (months.length === 1) {
        return dates.map(fmtDay).join(', ') + ' ' + MONTHS_SHORT[months[0]]
      }
      return dates.map(fmtShort).join(', ')
    }

    let text = `📊 <b>Посещаемость · ${label}</b>\nГруппа: <b>${groupName}</b>\n`

    if (attended.length > 0) {
      text += '\n'
      for (const s of attended) {
        const dates = byStudent[s.id] || []
        const datesStr = formatDates(dates)
        text += `${s.name} — ${dates.length} зан. (${datesStr})\n`
      }
    } else {
      text += '\nНикто не посещал тренировки на этой неделе.\n'
    }

    if (absent.length > 0) {
      text += `\n➖ <b>Не были:</b>\n`
      text += absent.map(s => s.name).join('\n')
    }

    const parts = splitMessage(text.trim())
    for (const part of parts) {
      await sendTg(threadId, part)
    }
  }

  return NextResponse.json({ ok: true, week: { from, to } })
}
