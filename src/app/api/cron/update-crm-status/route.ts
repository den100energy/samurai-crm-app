import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const OWNER_CHAT_ID = process.env.FOUNDER_TELEGRAM_CHAT_ID || process.env.TELEGRAM_OWNER_CHAT_ID!

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
  if (!json.ok) console.error('TG error:', json.description, 'chat_id:', chat_id)
  return json.ok
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const ago30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]

  // Все активные ученики
  const { data: students } = await admin
    .from('students')
    .select('id, name, created_at, enrollment_date, crm_status, crm_status_changed_at')
    .eq('status', 'active')

  if (!students?.length) return NextResponse.json({ ok: true, updated: 0, at_risk_new: 0 })

  const studentIds = students.map(s => s.id)

  // Последние визиты (берём самый последний на каждого)
  const { data: allVisits } = await admin
    .from('attendance')
    .select('student_id, date')
    .in('student_id', studentIds)
    .eq('present', true)
    .order('date', { ascending: false })

  const lastVisitMap = new Map<string, string>()
  for (const v of (allVisits || [])) {
    if (!lastVisitMap.has(v.student_id)) lastVisitMap.set(v.student_id, v.date)
  }

  // Посещаемость за последние 30 дней (считаем rate)
  const { data: recentAtt } = await admin
    .from('attendance')
    .select('student_id, present')
    .in('student_id', studentIds)
    .gte('date', ago30)

  const att30Map = new Map<string, { present: number; total: number }>()
  for (const a of (recentAtt || [])) {
    if (!att30Map.has(a.student_id)) att30Map.set(a.student_id, { present: 0, total: 0 })
    const m = att30Map.get(a.student_id)!
    m.total++
    if (a.present) m.present++
  }

  // Последний абонемент каждого ученика
  const { data: subs } = await admin
    .from('subscriptions')
    .select('student_id, sessions_left, end_date')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false })

  const subMap = new Map<string, { sessions_left: number | null; end_date: string | null }>()
  for (const s of (subs || [])) {
    if (!subMap.has(s.student_id)) subMap.set(s.student_id, s)
  }

  const updates: {
    id: string
    crm_status: string
    risk_score: number
    crm_status_changed_at: string
  }[] = []

  const newAtRisk: { name: string; daysSince: number | null; riskScore: number }[] = []

  for (const student of students) {
    const lastVisit = lastVisitMap.get(student.id)
    const daysSince = lastVisit
      ? Math.floor((now.getTime() - new Date(lastVisit).getTime()) / 86400000)
      : null

    const sub = subMap.get(student.id)
    const hasActiveSub =
      sub != null &&
      (sub.sessions_left === null || sub.sessions_left > 0) &&
      (!sub.end_date || sub.end_date >= today)

    const att = att30Map.get(student.id)
    const attendanceRate = att && att.total > 0 ? att.present / att.total : null

    // — Балл риска —
    let riskScore = 0

    if (hasActiveSub) {
      // Пропуск при активном абонементе
      if (daysSince !== null && daysSince >= 14) riskScore += 3
      else if (daysSince !== null && daysSince >= 7) riskScore += 1
    } else {
      // Нет активного абонемента
      riskScore += 3
    }

    // Низкая посещаемость за месяц
    if (attendanceRate !== null && attendanceRate < 0.5) riskScore += 2

    // — CRM статус —
    const enrollmentDate = student.enrollment_date || student.created_at
    const daysSinceEnrollment = Math.floor(
      (now.getTime() - new Date(enrollmentDate).getTime()) / 86400000
    )

    let newStatus: string

    if (riskScore >= 5) {
      newStatus = 'at_risk'
    } else if (!hasActiveSub && (daysSince === null || daysSince >= 45)) {
      newStatus = 'lapsed'
    } else if (daysSinceEnrollment <= 30) {
      newStatus = 'onboarding'
    } else if (daysSinceEnrollment >= 180 && (attendanceRate === null || attendanceRate >= 0.6)) {
      newStatus = 'established'
    } else {
      newStatus = 'active'
    }

    const statusChanged = newStatus !== (student.crm_status ?? 'active')
    const changedAt = statusChanged
      ? now.toISOString()
      : (student.crm_status_changed_at ?? now.toISOString())

    updates.push({ id: student.id, crm_status: newStatus, risk_score: riskScore, crm_status_changed_at: changedAt })

    if (newStatus === 'at_risk' && student.crm_status !== 'at_risk') {
      newAtRisk.push({ name: student.name, daysSince, riskScore })
    }
  }

  // Сохраняем все обновления
  let updated = 0
  for (const upd of updates) {
    const { error } = await admin
      .from('students')
      .update({
        crm_status: upd.crm_status,
        risk_score: upd.risk_score,
        crm_status_changed_at: upd.crm_status_changed_at,
      })
      .eq('id', upd.id)
    if (!error) updated++
  }

  // Telegram-алерт если появились новые at_risk
  if (newAtRisk.length > 0 && OWNER_CHAT_ID) {
    const lines = newAtRisk
      .map(s => {
        const days = s.daysSince !== null ? `${s.daysSince} дн. без визита` : 'нет визитов'
        return `• <b>${s.name}</b> — ${days}, балл: ${s.riskScore}`
      })
      .join('\n')

    await tgSend(
      OWNER_CHAT_ID,
      `⚠️ <b>Новые ученики в зоне риска: ${newAtRisk.length}</b>\n\n` +
        `${lines}\n\n` +
        `Рекомендуется связаться с каждым в течение 48 часов.`
    )
  }

  console.log(`update-crm-status: updated=${updated}, at_risk_new=${newAtRisk.length}`)
  return NextResponse.json({ ok: true, updated, at_risk_new: newAtRisk.length })
}
