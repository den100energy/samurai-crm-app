import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function tgSend(chat_id: number | string, text: string, inline_keyboard?: object) {
  const body: Record<string, unknown> = { chat_id, text, parse_mode: 'HTML' }
  if (inline_keyboard) body.reply_markup = { inline_keyboard }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

  // 3 месяца назад
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const cutoff = threeMonthsAgo.toISOString()

  // Ищем студентов у кого последний заполненный срез был ~3 месяца назад
  // и нет незаполненного нового среза
  const { data: oldSurveys } = await admin
    .from('progress_surveys')
    .select('student_id, created_at')
    .not('filled_at', 'is', null)
    .lte('created_at', cutoff)
    .order('created_at', { ascending: false })

  if (!oldSurveys?.length) return NextResponse.json({ ok: true, notified: 0 })

  // Группируем: берём самый последний срез на каждого студента
  const latestByStudent = new Map<string, string>()
  for (const s of oldSurveys) {
    if (!latestByStudent.has(s.student_id)) {
      latestByStudent.set(s.student_id, s.created_at)
    }
  }

  const studentIds = [...latestByStudent.keys()]

  // Исключаем тех, у кого уже есть незаполненный срез
  const { data: pendingSurveys } = await admin
    .from('progress_surveys')
    .select('student_id')
    .in('student_id', studentIds)
    .is('filled_at', null)

  const pendingSet = new Set((pendingSurveys || []).map(s => s.student_id))
  const eligible = studentIds.filter(id => !pendingSet.has(id))

  if (!eligible.length) return NextResponse.json({ ok: true, notified: 0 })

  // Загружаем имена студентов и их тренеров
  const { data: students } = await admin
    .from('students')
    .select('id, name, group_name')
    .in('id', eligible)
    .eq('status', 'active')

  if (!students?.length) return NextResponse.json({ ok: true, notified: 0 })

  // Получаем тренеров из расписания (группа → тренер)
  const groupNames = [...new Set(students.map(s => s.group_name).filter(Boolean))]
  const { data: scheduleSlots } = await admin
    .from('schedule')
    .select('group_name, trainer_name')
    .in('group_name', groupNames)

  // group_name → trainer_name
  const groupToTrainer = new Map<string, string>()
  for (const slot of (scheduleSlots || [])) {
    if (slot.group_name && slot.trainer_name) {
      groupToTrainer.set(slot.group_name, slot.trainer_name)
    }
  }

  // trainer_name → telegram_chat_id (из user_profiles + trainers)
  const trainerNames = [...new Set([...groupToTrainer.values()])]
  const { data: trainerProfiles } = await admin
    .from('user_profiles')
    .select('name, trainer_id')
    .in('name', trainerNames)

  // Получаем Telegram chat_id основателя как fallback
  const founderChatId = process.env.FOUNDER_TELEGRAM_CHAT_ID || process.env.TELEGRAM_OWNER_CHAT_ID

  // trainer_name → список учеников
  const trainerStudents = new Map<string, { id: string; name: string }[]>()
  for (const student of students) {
    const trainerName = student.group_name ? groupToTrainer.get(student.group_name) : null
    const key = trainerName || '__founder__'
    if (!trainerStudents.has(key)) trainerStudents.set(key, [])
    trainerStudents.get(key)!.push({ id: student.id, name: student.name })
  }

  // Получаем chat_id для каждого тренера через Telegram-бот
  // (у тренера должен быть linked telegram в боте, иначе шлём основателю)
  const { data: trainerBotLinks } = await admin
    .from('students')
    .select('id')
    .limit(0) // просто проверка соединения

  let notified = 0

  for (const [trainerKey, trainerStudentList] of trainerStudents.entries()) {
    const isFounder = trainerKey === '__founder__'

    // Формируем список студентов для сообщения
    const studentLines = trainerStudentList
      .map(s => `• ${s.name}`)
      .join('\n')

    const count = trainerStudentList.length
    const text =
      `📊 <b>Пора провести срез прогресса!</b>\n\n` +
      `У ${count} ${count === 1 ? 'ученика' : count < 5 ? 'учеников' : 'учеников'} прошло 3 месяца с последней оценки:\n\n` +
      `${studentLines}\n\n` +
      `Зайди в карточку ученика и запусти новый срез "Рост".`

    const keyboard = [[{
      text: '📋 Открыть CRM',
      url: `${APP_URL}/students`,
    }]]

    // Отправляем основателю (у него всегда есть chat_id)
    // В будущем можно добавить персональные chat_id тренеров
    if (founderChatId) {
      const ok = await tgSend(founderChatId, text, keyboard)
      if (ok) notified += trainerStudentList.length

      // Помечаем что уведомление отправлено
      await admin
        .from('progress_surveys')
        .update({ reminder_sent_at: new Date().toISOString() })
        .in('student_id', trainerStudentList.map(s => s.id))
        .is('filled_at', null)
    }
  }

  return NextResponse.json({ ok: true, notified })
}
