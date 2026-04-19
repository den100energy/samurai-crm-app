import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { lead_id } = await req.json()
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  // Fetch lead
  const { data: lead } = await admin.from('leads').select('id, name, telegram_chat_id').eq('id', lead_id).single()
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  // No Telegram — skip silently
  if (!lead.telegram_chat_id) return NextResponse.json({ ok: false, reason: 'no_telegram' })

  // Get or create diagnostic_survey
  let { data: survey } = await admin.from('diagnostic_surveys').select('id, survey_token').eq('lead_id', lead_id).maybeSingle()
  if (!survey) {
    const { data } = await admin.from('diagnostic_surveys').insert({ lead_id }).select('id, survey_token').single()
    survey = data
  }
  if (!survey) return NextResponse.json({ error: 'failed to create survey' }, { status: 500 })

  const surveyUrl = `${APP_URL}/survey/${survey.survey_token}`

  const message =
    `👋 <b>Привет!</b> Вы записались на пробное занятие в Школу Самурая.\n\n` +
    `📋 Пожалуйста, заполните короткую анкету — это займёт 2–3 минуты и поможет тренеру подготовиться:\n\n` +
    `${surveyUrl}`

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: lead.telegram_chat_id,
      text: message,
      parse_mode: 'HTML',
    }),
  })

  const tg = await res.json()
  if (!tg.ok) {
    console.error('TG send error:', JSON.stringify(tg))
    return NextResponse.json({ ok: false, reason: tg.description })
  }

  return NextResponse.json({ ok: true })
}
