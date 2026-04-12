import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CLIENT_BOT_TOKEN = process.env.TELEGRAM_CLIENT_BOT_TOKEN!
const OWNER_CHAT_ID = process.env.FOUNDER_TELEGRAM_CHAT_ID || process.env.TELEGRAM_OWNER_CHAT_ID!

async function tgSend(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${CLIENT_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

function localDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })
    .split('.').reverse().join('-')
    .replace(/(\d{4})-(\d{2})-(\d{2})/, '$1-$2-$3')
}

function isoDate(d: Date): string {
  // YYYY-MM-DD в московском времени
  const msk = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }))
  const y = msk.getFullYear()
  const m = String(msk.getMonth() + 1).padStart(2, '0')
  const day = String(msk.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateRu(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', weekday: 'short',
  })
}

export async function GET() {
  if (!OWNER_CHAT_ID) return NextResponse.json({ error: 'no owner chat id' }, { status: 500 })

  // Вчерашняя дата (по Москве)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = isoDate(yesterday)

  // День недели вчера (1=Пн … 7=Вс)
  const msk = new Date(yesterday.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }))
  const jsDay = msk.getDay()
  const dayOfWeek = jsDay === 0 ? 7 : jsDay

  // Расписание на этот день
  const { data: schedules } = await admin
    .from('schedule')
    .select('group_name, trainer_name')
    .eq('day_of_week', dayOfWeek)

  if (!schedules || schedules.length === 0) {
    return NextResponse.json({ skipped: 'no schedule yesterday' })
  }

  // Отменённые тренировки вчера
  const { data: overrides } = await admin
    .from('schedule_overrides')
    .select('group_name, cancelled')
    .eq('date', yesterdayStr)

  const cancelledGroups = new Set<string>(
    (overrides || []).filter(o => o.cancelled).map(o => o.group_name)
  )

  // Оставляем только не отменённые
  const expected = schedules.filter(s => !cancelledGroups.has(s.group_name))
  if (expected.length === 0) return NextResponse.json({ skipped: 'all cancelled' })

  // Проверяем attendance за вчера
  const groups = expected.map(e => e.group_name)
  const { data: attData } = await admin
    .from('attendance')
    .select('group_name')
    .eq('date', yesterdayStr)
    .in('group_name', groups)

  const markedGroups = new Set<string>((attData || []).map(a => a.group_name))

  // Пропущенные — группируем по тренеру
  const missingByTrainer = new Map<string, string[]>()
  for (const e of expected) {
    if (!markedGroups.has(e.group_name)) {
      const trainer = e.trainer_name || 'Без тренера'
      if (!missingByTrainer.has(trainer)) missingByTrainer.set(trainer, [])
      missingByTrainer.get(trainer)!.push(e.group_name)
    }
  }

  if (missingByTrainer.size === 0) {
    return NextResponse.json({ ok: true, missing: 0 })
  }

  // Формируем сообщение основателю
  const dateLabel = formatDateRu(yesterdayStr)
  const lines: string[] = []
  for (const [trainer, groups] of missingByTrainer.entries()) {
    lines.push(`👤 <b>${trainer}</b>: ${groups.join(', ')}`)
  }

  const text =
    `⚠️ <b>Посещаемость не отмечена</b>\n` +
    `📅 ${dateLabel}\n\n` +
    lines.join('\n') +
    `\n\nНапомните тренеру отметить учеников.`

  await tgSend(OWNER_CHAT_ID, text)

  return NextResponse.json({ ok: true, missing: missingByTrainer.size, date: yesterdayStr })
}
