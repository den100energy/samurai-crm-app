import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatDate } from '@/lib/dates'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function tgSend(chat_id: string | number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
  })
  const json = await res.json()
  if (!json.ok) console.error('TG notify-expiring-subscriptions error:', json.description, 'chat_id:', chat_id)
}

async function isDone(student_id: string, event_type: string): Promise<boolean> {
  const { data } = await admin
    .from('lifecycle_events')
    .select('id')
    .eq('student_id', student_id)
    .eq('event_type', event_type)
    .maybeSingle()
  return !!data
}

async function markEvent(student_id: string, event_type: string) {
  await admin.from('lifecycle_events').upsert(
    { student_id, event_type, triggered_at: new Date().toISOString() },
    { onConflict: 'student_id,event_type' }
  )
}

// Порог первого уведомления по занятиям (null = нет первого уведомления)
function firstSessionsThreshold(total: number | null): number | null {
  if (!total || total <= 16) return null
  if (total <= 24) return 4
  if (total <= 36) return 5
  if (total <= 48) return 6
  return 7
}

// Порог первого уведомления по сроку (в днях)
function firstDaysThreshold(total: number | null): number {
  if (!total || total <= 16) return 7
  if (total <= 36) return 10
  return 14
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]
  let sent = 0

  // Все активные не-ожидающие абонементы
  const { data: subs } = await admin
    .from('subscriptions')
    .select('id, type, sessions_total, sessions_left, end_date, student_id')
    .eq('is_pending', false)
    .or('sessions_left.is.null,sessions_left.gt.0')
    .or(`end_date.is.null,end_date.gte.${today}`)

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

  const studentIds = [...new Set(subs.map(s => s.student_id))]

  // Ученики (telegram_chat_id)
  const { data: students } = await admin
    .from('students')
    .select('id, name, telegram_chat_id')
    .in('id', studentIds)
  const studentMap = new Map(students?.map(s => [s.id, s]) ?? [])

  // Родители / контакты (telegram_chat_id)
  const { data: contacts } = await admin
    .from('student_contacts')
    .select('student_id, telegram_chat_id')
    .in('student_id', studentIds)
    .not('telegram_chat_id', 'is', null)

  const parentMap = new Map<string, number[]>()
  for (const c of (contacts ?? [])) {
    if (!parentMap.has(c.student_id)) parentMap.set(c.student_id, [])
    parentMap.get(c.student_id)!.push(c.telegram_chat_id)
  }

  async function notify(studentId: string, text: string) {
    const student = studentMap.get(studentId)
    const parents = parentMap.get(studentId) ?? []
    const ids: (string | number)[] = [...parents]
    if (student?.telegram_chat_id) ids.push(student.telegram_chat_id)
    for (const id of ids) await tgSend(id, text)
  }

  for (const sub of subs) {
    const student = studentMap.get(sub.student_id)
    if (!student) continue
    const name = student.name
    const total = sub.sessions_total
    const left = sub.sessions_left

    // ── Уведомления по занятиям ──────────────────────────────────
    if (left !== null) {
      const firstThreshold = firstSessionsThreshold(total)

      // Первое уведомление (для больших абонементов)
      if (firstThreshold !== null && left === firstThreshold) {
        const key = `sub_sessions_first_${sub.id}`
        if (!await isDone(sub.student_id, key)) {
          await notify(sub.student_id,
            `🥋 <b>Школа Самурая</b>\n\n` +
            `У <b>${name}</b> заканчивается абонемент — осталось <b>${left} занятия</b>.\n\n` +
            `Самое время подготовиться к продлению 💳`)
          await markEvent(sub.student_id, key)
          sent++
        }
      }

      // Финальное уведомление — осталось 2 занятия
      if (left === 2) {
        const key = `sub_sessions_final_${sub.id}`
        if (!await isDone(sub.student_id, key)) {
          await notify(sub.student_id,
            `⚠️ <b>Школа Самурая</b>\n\n` +
            `У <b>${name}</b> осталось только <b>2 занятия</b>.\n\n` +
            `Продлите абонемент, чтобы не прерывать тренировки 🙏`)
          await markEvent(sub.student_id, key)
          sent++
        }
      }
    }

    // ── Уведомления по сроку ─────────────────────────────────────
    if (sub.end_date) {
      const daysLeft = Math.ceil(
        (new Date(sub.end_date).getTime() - new Date(today).getTime()) / 86400000
      )
      const firstDays = firstDaysThreshold(total)

      // Первое уведомление по сроку
      if (daysLeft === firstDays) {
        const key = `sub_date_first_${sub.id}`
        if (!await isDone(sub.student_id, key)) {
          await notify(sub.student_id,
            `📅 <b>Школа Самурая</b>\n\n` +
            `Абонемент <b>${name}</b> заканчивается <b>${formatDate(sub.end_date)}</b> — через ${daysLeft} дней.\n\n` +
            `Продлите заранее, чтобы не потерять место в группе 💳`)
          await markEvent(sub.student_id, key)
          sent++
        }
      }

      // Финальное уведомление — за 2 дня
      if (daysLeft === 2) {
        const key = `sub_date_final_${sub.id}`
        if (!await isDone(sub.student_id, key)) {
          await notify(sub.student_id,
            `🚨 <b>Школа Самурая</b>\n\n` +
            `Абонемент <b>${name}</b> заканчивается послезавтра — <b>${formatDate(sub.end_date)}</b>.\n\n` +
            `Успейте продлить! 🙏`)
          await markEvent(sub.student_id, key)
          sent++
        }
      }
    }
  }

  console.log(`notify-expiring-subscriptions: ${sent} notifications sent`)
  return NextResponse.json({ ok: true, sent })
}
