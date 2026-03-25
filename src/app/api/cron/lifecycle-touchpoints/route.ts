import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const OWNER_CHAT_ID = process.env.FOUNDER_TELEGRAM_CHAT_ID || process.env.TELEGRAM_OWNER_CHAT_ID!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://samurai-crm-app.vercel.app'

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

async function createTicket(student_id: string, description: string) {
  await admin.from('tickets').insert({
    student_id,
    type: 'crm_задача',
    description,
    status: 'pending',
  })
}

async function markEvent(student_id: string, event_type: string) {
  await admin.from('lifecycle_events').upsert(
    { student_id, event_type, triggered_at: new Date().toISOString() },
    { onConflict: 'student_id,event_type' }
  )
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Все активные ученики
  const { data: students } = await admin
    .from('students')
    .select('id, name, created_at, birth_date, telegram_chat_id')
    .eq('status', 'active')

  if (!students?.length) return NextResponse.json({ ok: true, actions: 0 })

  const studentIds = students.map(s => s.id)

  // Все уже отработанные события (дедупликация)
  const { data: doneEvents } = await admin
    .from('lifecycle_events')
    .select('student_id, event_type')
    .in('student_id', studentIds)

  const doneSet = new Set<string>()
  for (const e of (doneEvents || [])) doneSet.add(`${e.student_id}:${e.event_type}`)

  const isDone = (sid: string, evt: string) => doneSet.has(`${sid}:${evt}`)

  // Общее кол-во посещений на студента
  const { data: allAtt } = await admin
    .from('attendance')
    .select('student_id, present')
    .in('student_id', studentIds)
    .eq('present', true)

  const totalVisits = new Map<string, number>()
  for (const a of (allAtt || [])) {
    totalVisits.set(a.student_id, (totalVisits.get(a.student_id) ?? 0) + 1)
  }

  // Посещения за последние 14 дней (для онбординг-алерта)
  const ago14 = new Date(now.getTime() - 14 * 86400000).toISOString().split('T')[0]
  const { data: recentAtt } = await admin
    .from('attendance')
    .select('student_id')
    .in('student_id', studentIds)
    .eq('present', true)
    .gte('date', ago14)

  const recentSet = new Set((recentAtt || []).map(a => a.student_id))

  // Первое занятие каждого ученика (для onboarding_day1)
  const { data: firstAtt } = await admin
    .from('attendance')
    .select('student_id, date')
    .in('student_id', studentIds)
    .eq('present', true)
    .order('date', { ascending: true })

  const firstVisitMap = new Map<string, string>()
  for (const a of (firstAtt || [])) {
    if (!firstVisitMap.has(a.student_id)) firstVisitMap.set(a.student_id, a.date)
  }

  // Контакты (родители) для Telegram-уведомлений
  const { data: contacts } = await admin
    .from('student_contacts')
    .select('student_id, telegram_chat_id')
    .in('student_id', studentIds)
    .not('telegram_chat_id', 'is', null)

  const parentIds = new Map<string, number[]>()
  for (const c of (contacts || [])) {
    if (!parentIds.has(c.student_id)) parentIds.set(c.student_id, [])
    parentIds.get(c.student_id)!.push(c.telegram_chat_id)
  }

  async function notifyParents(studentId: string, text: string) {
    const ids = parentIds.get(studentId) ?? []
    for (const chatId of ids) await tgSend(chatId, text)
    // Также самому ученику, если есть
    const student = students!.find(s => s.id === studentId)
    if (student?.telegram_chat_id) await tgSend(student.telegram_chat_id, text)
  }

  let actions = 0

  for (const student of students) {
    const daysSinceEnrollment = Math.floor(
      (now.getTime() - new Date(student.created_at).getTime()) / 86400000
    )
    const visits = totalVisits.get(student.id) ?? 0
    const hasRecentVisit = recentSet.has(student.id)
    const firstVisitDate = firstVisitMap.get(student.id)
    const daysSinceFirstVisit = firstVisitDate
      ? Math.floor((now.getTime() - new Date(firstVisitDate).getTime()) / 86400000)
      : null

    // ── ОНБОРДИНГ: день рождения первого занятия (задача тренеру)
    if (
      firstVisitDate && daysSinceFirstVisit !== null &&
      daysSinceFirstVisit >= 0 && daysSinceFirstVisit <= 2 &&
      !isDone(student.id, 'onboarding_day1')
    ) {
      await createTicket(student.id,
        `📋 Написать после первого занятия: «Как прошло? Всё понравилось?»`)
      await markEvent(student.id, 'onboarding_day1')
      actions++
    }

    // ── ОНБОРДИНГ: день 7 — удобно ли расписание?
    if (
      daysSinceEnrollment >= 6 && daysSinceEnrollment <= 9 &&
      !isDone(student.id, 'onboarding_day7')
    ) {
      await createTicket(student.id,
        `📞 День 7: позвонить или написать — удобно ли расписание? Все ли вопросы закрыты?`)
      await markEvent(student.id, 'onboarding_day7')
      actions++
    }

    // ── ОНБОРДИНГ: алерт — нет визитов за 14 дней с начала
    if (
      daysSinceEnrollment >= 14 && daysSinceEnrollment <= 21 &&
      visits === 0 &&
      !isDone(student.id, 'onboarding_no_visits')
    ) {
      await createTicket(student.id,
        `⚠️ СРОЧНО: ${student.name} записался ${daysSinceEnrollment} дней назад, но ни разу не пришёл. Свяжитесь сегодня!`)
      await markEvent(student.id, 'onboarding_no_visits')
      if (OWNER_CHAT_ID) {
        await tgSend(OWNER_CHAT_ID,
          `⚠️ <b>Нет визитов у нового ученика</b>\n\n` +
          `<b>${student.name}</b> записался ${daysSinceEnrollment} дней назад, но ни разу не появился.\n` +
          `Свяжитесь сегодня!`)
      }
      actions++
    }

    // ── ОНБОРДИНГ: день 30 — итог месяца родителю
    if (
      daysSinceEnrollment >= 28 && daysSinceEnrollment <= 35 &&
      !isDone(student.id, 'onboarding_day30')
    ) {
      const visitWord = visits === 1 ? 'занятие' : visits < 5 ? 'занятия' : 'занятий'
      await notifyParents(student.id,
        `🥋 <b>Первый месяц в Школе Самурая!</b>\n\n` +
        `<b>${student.name}</b> провёл с нами уже 1 месяц 🎉\n` +
        `За это время: <b>${visits} ${visitWord}</b>\n\n` +
        `Тренер работает над индивидуальной программой. ` +
        `Следите за прогрессом в личном кабинете: ${APP_URL}/cabinet`)
      await markEvent(student.id, 'onboarding_day30')
      actions++
    }

    // ── MILESTONE: 30-е занятие
    if (visits >= 30 && !isDone(student.id, 'milestone_30')) {
      await notifyParents(student.id,
        `🔥 <b>30 занятий!</b>\n\n` +
        `<b>${student.name}</b> посетил 30 тренировок в Школе Самурая — это серьёзный результат!\n\n` +
        `Так держать! 💪`)
      await createTicket(student.id, `🏅 30-е занятие — поздравить лично на тренировке!`)
      await markEvent(student.id, 'milestone_30')
      actions++
    }

    // ── MILESTONE: 60-е занятие
    if (visits >= 60 && !isDone(student.id, 'milestone_60')) {
      await notifyParents(student.id,
        `⚡ <b>60 занятий!</b>\n\n` +
        `<b>${student.name}</b> — уже 60 тренировок за плечами. Настоящий самурай! 🥋`)
      await markEvent(student.id, 'milestone_60')
      actions++
    }

    // ── MILESTONE: 100-е занятие
    if (visits >= 100 && !isDone(student.id, 'milestone_100')) {
      await notifyParents(student.id,
        `🏆 <b>100 занятий!</b>\n\n` +
        `<b>${student.name}</b> достиг отметки в 100 тренировок! ` +
        `Это большой путь — гордимся! 🎌`)
      await createTicket(student.id, `🏆 100-е занятие — особое поздравление на тренировке, фото для соцсетей!`)
      await markEvent(student.id, 'milestone_100')
      actions++
    }

    // ── MILESTONE: 3 месяца — предложить годовой абонемент
    if (
      daysSinceEnrollment >= 88 && daysSinceEnrollment <= 95 &&
      !isDone(student.id, 'milestone_3months')
    ) {
      await createTicket(student.id,
        `💳 3 месяца в школе — предложить годовой абонемент со скидкой 15%.`)
      await markEvent(student.id, 'milestone_3months')
      actions++
    }

    // ── MILESTONE: 6 месяцев — "разговор о прогрессе"
    if (
      daysSinceEnrollment >= 178 && daysSinceEnrollment <= 185 &&
      !isDone(student.id, 'milestone_6months')
    ) {
      await createTicket(student.id,
        `🗣️ 6 месяцев в школе — провести «разговор о прогрессе»: цели на следующие 6 месяцев, пояса, соревнования.`)
      await markEvent(student.id, 'milestone_6months')
      actions++
    }

    // ── MILESTONE: 12 месяцев — годовщина
    if (
      daysSinceEnrollment >= 363 && daysSinceEnrollment <= 368 &&
      !isDone(student.id, 'milestone_12months')
    ) {
      await notifyParents(student.id,
        `🎌 <b>Год в Школе Самурая!</b>\n\n` +
        `<b>${student.name}</b> — ровно год на пути воина! ` +
        `Это достижение, которым можно гордиться.\n\n` +
        `Спасибо, что вы с нами 🙏`)
      await createTicket(student.id,
        `🎂 Годовщина в школе — личное поздравление от тренера, сертификат или подарок.`)
      await markEvent(student.id, 'milestone_12months')
      actions++
    }

    // ── ДЕНЬ РОЖДЕНИЯ (ежегодно)
    if (student.birth_date) {
      const bMD = student.birth_date.slice(5, 10) // MM-DD
      const birthdayEventKey = `birthday_${now.getFullYear()}`
      if (bMD === todayMD && !isDone(student.id, birthdayEventKey)) {
        await createTicket(student.id,
          `🎂 Сегодня день рождения у ${student.name}! Написать личное поздравление от тренера.`)
        await markEvent(student.id, birthdayEventKey)
        actions++
      }
    }
  }

  console.log(`lifecycle-touchpoints: ${actions} actions`)
  return NextResponse.json({ ok: true, actions })
}
