import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TRAINING_CHAT_ID = process.env.TELEGRAM_TRAINING_CHAT_ID!

const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const MONTHS_NOMINATIVE = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

// Прошлый месяц: первый и последний день
function prevMonthRange(): { from: string; to: string; label: string; trainingLabel: string } {
  const today = new Date()
  const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastOfPrevMonth  = new Date(firstOfThisMonth.getTime() - 1)
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1)

  const from = firstOfPrevMonth.toISOString().split('T')[0]
  const to   = lastOfPrevMonth.toISOString().split('T')[0]

  const m    = lastOfPrevMonth.getMonth()
  const year = lastOfPrevMonth.getFullYear()
  const label = `${MONTHS_NOMINATIVE[m]} ${year}`
  const trainingLabel = `${MONTHS_GENITIVE[m]} ${year}`

  return { from, to, label, trainingLabel }
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
  if (!json.ok) console.error('[monthly-report] TG error:', JSON.stringify(json))
}

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

// Подсчёт уникальных дней тренировок группы за период
async function countGroupTrainingDays(groupName: string, from: string, to: string): Promise<number> {
  const { data } = await supabase
    .from('attendance')
    .select('date')
    .eq('group_name', groupName)
    .gte('date', from)
    .lte('date', to + 'T23:59:59')

  const uniqueDays = new Set((data || []).map(r => String(r.date).slice(0, 10)))
  return uniqueDays.size
}

export async function GET() {
  if (!BOT_TOKEN || !TRAINING_CHAT_ID) {
    return NextResponse.json({ error: 'Telegram not configured' }, { status: 500 })
  }

  const { from, to, label, trainingLabel } = prevMonthRange()

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

    // Активные ученики (алфавит)
    const { data: students } = await supabase
      .from('students')
      .select('id, name')
      .eq('group_name', groupName)
      .eq('status', 'active')
      .order('name')

    if (!students || students.length === 0) continue

    // Посещаемость за месяц
    const studentIds = students.map(s => s.id)
    const { data: attRows } = await supabase
      .from('attendance')
      .select('student_id, date')
      .in('student_id', studentIds)
      .eq('group_name', groupName)
      .eq('present', true)
      .gte('date', from)
      .lte('date', to + 'T23:59:59')

    // Считаем уникальные дни на ученика
    const countByStudent: Record<string, number> = {}
    for (const row of attRows || []) {
      const dateKey = String(row.date).slice(0, 10)
      if (!countByStudent[row.student_id]) countByStudent[row.student_id] = 0
      // Считаем уникальные дни через Set
    }
    // Уникальные дни через Set
    const daysSetByStudent: Record<string, Set<string>> = {}
    for (const row of attRows || []) {
      const dateKey = String(row.date).slice(0, 10)
      if (!daysSetByStudent[row.student_id]) daysSetByStudent[row.student_id] = new Set()
      daysSetByStudent[row.student_id].add(dateKey)
    }
    for (const id of Object.keys(daysSetByStudent)) {
      countByStudent[id] = daysSetByStudent[id].size
    }

    // Только те кто был хоть раз
    const attended = students
      .filter(s => (countByStudent[s.id] ?? 0) > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    // Кол-во тренировочных дней группы за месяц
    const trainingDays = await countGroupTrainingDays(groupName, from, to)

    let text = `📊 <b>${label} · Посещаемость</b>\n`
    text += `Группа: <b>${groupName}</b>`
    if (trainingDays > 0) text += ` · ${trainingDays} тренировок`
    text += '\n'

    if (attended.length > 0) {
      text += '\n'
      for (const s of attended) {
        text += `${s.name} — ${countByStudent[s.id]} зан.\n`
      }
    } else {
      text += '\nНикто не посещал тренировки в этом месяце.\n'
    }

    // Топ-5
    if (attended.length > 0) {
      const top5 = [...attended]
        .sort((a, b) => (countByStudent[b.id] ?? 0) - (countByStudent[a.id] ?? 0))
        .slice(0, 5)

      text += `\n🏆 <b>Топ-5 ${trainingLabel}:</b>\n`
      top5.forEach((s, i) => {
        const medals = ['🥇', '🥈', '🥉', '4.', '5.']
        text += `${medals[i]} ${s.name} — ${countByStudent[s.id]} зан.\n`
      })
    }

    const parts = splitMessage(text.trim())
    for (const part of parts) {
      await sendTg(threadId, part)
    }
  }

  return NextResponse.json({ ok: true, month: { from, to } })
}
