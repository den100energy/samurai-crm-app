import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://samurai-crm-app.vercel.app'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function tgSend(chat_id: number | string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
  })
  const json = await res.json()
  if (!json.ok) console.error('TG send error:', JSON.stringify(json), 'chat_id:', chat_id)
  return json.ok
}

export async function GET(req: NextRequest) {
  // Vercel cron auth
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const day28ago = new Date(today); day28ago.setDate(today.getDate() - 28)
  const day35ago = new Date(today); day35ago.setDate(today.getDate() - 35)

  const from28 = day28ago.toISOString().split('T')[0]
  const from35 = day35ago.toISOString().split('T')[0]

  // Find students with first attendance 28–35 days ago
  const { data: firstAttendances } = await admin
    .from('attendance')
    .select('student_id, date')
    .eq('present', true)
    .gte('date', from35)
    .lte('date', from28)
    .order('date', { ascending: true })

  if (!firstAttendances?.length) return NextResponse.json({ ok: true, sent: 0 })

  // Group: keep only earliest attendance per student
  const firstByStudent = new Map<string, string>()
  for (const a of firstAttendances) {
    if (!firstByStudent.has(a.student_id)) {
      firstByStudent.set(a.student_id, a.date)
    }
  }

  // Exclude students who attended before the 35-day window (they joined earlier)
  const studentIds = [...firstByStudent.keys()]
  const { data: olderAttendances } = await admin
    .from('attendance')
    .select('student_id')
    .eq('present', true)
    .lt('date', from35)
    .in('student_id', studentIds)

  const olderSet = new Set((olderAttendances || []).map(a => a.student_id))
  const eligible = studentIds.filter(id => !olderSet.has(id))

  if (!eligible.length) return NextResponse.json({ ok: true, sent: 0 })

  // Exclude students who already have a progress_survey with parent_sent_at set
  const { data: existingSurveys } = await admin
    .from('progress_surveys')
    .select('student_id, id, survey_token, parent_sent_at')
    .in('student_id', eligible)

  const surveyMap = new Map<string, { id: string; survey_token: string; parent_sent_at: string | null }>()
  for (const s of (existingSurveys || [])) {
    surveyMap.set(s.student_id, s)
  }

  const toSend = eligible.filter(id => {
    const s = surveyMap.get(id)
    return !s || !s.parent_sent_at
  })

  if (!toSend.length) return NextResponse.json({ ok: true, sent: 0 })

  // Fetch student info + contacts
  const { data: students } = await admin
    .from('students')
    .select('id, name, telegram_chat_id')
    .in('id', toSend)

  const { data: contacts } = await admin
    .from('student_contacts')
    .select('student_id, telegram_chat_id')
    .in('student_id', toSend)
    .not('telegram_chat_id', 'is', null)

  const contactsByStudent = new Map<string, number[]>()
  for (const c of (contacts || [])) {
    if (!contactsByStudent.has(c.student_id)) contactsByStudent.set(c.student_id, [])
    contactsByStudent.get(c.student_id)!.push(c.telegram_chat_id)
  }

  let sent = 0

  for (const student of (students || [])) {
    // Get or create progress_survey
    let survey = surveyMap.get(student.id)
    if (!survey) {
      const { data } = await admin
        .from('progress_surveys')
        .insert({ student_id: student.id })
        .select('id, survey_token, parent_sent_at')
        .single()
      if (!data) continue
      survey = data
    }

    const surveyUrl = `${APP_URL}/survey2/${survey.survey_token}`
    const now = new Date().toISOString()
    let anySent = false

    // Send to student
    if (student.telegram_chat_id) {
      const ok = await tgSend(student.telegram_chat_id,
        `Привет! 🥋 Прошёл твой первый месяц в Школе Самурая — это серьёзно!\n\n` +
        `Тренер хочет знать твои ощущения о прогрессе. Заполни короткую анкету (3–4 мин) — ` +
        `программа на следующий месяц будет построена с учётом твоего мнения:\n\n${surveyUrl}`
      )
      if (ok) anySent = true
    }

    // Send to contacts (parents)
    const parentIds = contactsByStudent.get(student.id) || []
    for (const chatId of parentIds) {
      const ok = await tgSend(chatId,
        `Здравствуйте! 🥋 Прошёл первый месяц занятий <b>${student.name}</b> в Школе Самурая.\n\n` +
        `Нам важен ваш взгляд на прогресс — это займёт 3–4 минуты и поможет тренеру ` +
        `скорректировать программу под цели вашего ребёнка:\n\n${surveyUrl}`
      )
      if (ok) anySent = true
    }

    if (anySent) {
      await admin.from('progress_surveys').update({ parent_sent_at: now }).eq('id', survey.id)
      sent++
    }
  }

  console.log(`send-survey2 cron: sent to ${sent} students`)
  return NextResponse.json({ ok: true, sent })
}
