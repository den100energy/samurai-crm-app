import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID!

async function sendTelegram(chat_id: string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
  })
}

export async function POST() {
  const today = new Date().toISOString().split('T')[0]
  const in3days = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]

  // Абонементы с 1-2 занятиями
  const { data: lowSessions } = await supabase
    .from('subscriptions')
    .select('id, sessions_left, students(name, phone)')
    .in('sessions_left', [1, 2])

  // Абонементы истекают через 3 дня
  const { data: expiringSoon } = await supabase
    .from('subscriptions')
    .select('id, end_date, students(name, phone)')
    .gte('end_date', today)
    .lte('end_date', in3days)

  // Абонементы с 0 занятий
  const { data: noSessions } = await supabase
    .from('subscriptions')
    .select('id, students(name, phone)')
    .eq('sessions_left', 0)

  let report = '📊 <b>Отчёт по абонементам</b>\n\n'
  let totalSent = 0

  if (noSessions && noSessions.length > 0) {
    report += `❗ <b>Закончились занятия (${noSessions.length}):</b>\n`
    for (const s of noSessions) {
      const st = s.students as any
      report += `• ${st?.name}${st?.phone ? ` — ${st.phone}` : ''}\n`
      totalSent++
    }
    report += '\n'
  }

  if (lowSessions && lowSessions.length > 0) {
    report += `⚠️ <b>Мало занятий (${lowSessions.length}):</b>\n`
    for (const s of lowSessions) {
      const st = s.students as any
      report += `• ${st?.name} — осталось ${s.sessions_left} зан.\n`
      totalSent++
    }
    report += '\n'
  }

  if (expiringSoon && expiringSoon.length > 0) {
    report += `📅 <b>Абонемент истекает через 3 дня (${expiringSoon.length}):</b>\n`
    for (const s of expiringSoon) {
      const st = s.students as any
      report += `• ${st?.name} — до ${s.end_date}\n`
      totalSent++
    }
  }

  if (totalSent === 0) {
    report = '✅ Всё в порядке — у всех учеников есть занятия!'
  }

  await sendTelegram(OWNER_CHAT_ID, report)

  return NextResponse.json({ ok: true, sent: totalSent })
}
