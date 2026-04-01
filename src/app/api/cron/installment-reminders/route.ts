import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

async function tgSend(chat_id: string | number, text: string) {
  if (!BOT_TOKEN || !chat_id) return false
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

  const today = new Date().toISOString().split('T')[0]

  // Загрузить все pending-платежи с данными плана и студента
  const { data: upcoming } = await admin
    .from('installment_payments')
    .select(`
      id, amount, due_date,
      installment_plans (
        reminder_days,
        subscriptions (
          student_id,
          students ( name, telegram_chat_id )
        )
      )
    `)
    .eq('status', 'pending')
    .gte('due_date', today)

  let sentCount = 0

  for (const p of upcoming ?? []) {
    const plan = p.installment_plans as any
    const sub = plan?.subscriptions
    const student = sub?.students
    const reminderDays = plan?.reminder_days ?? 3

    const daysUntil = Math.ceil(
      (new Date(p.due_date).getTime() - new Date(today).getTime()) / 86400000
    )

    if (daysUntil !== reminderDays) continue

    const dueDateStr = new Date(p.due_date + 'T00:00:00').toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long'
    })
    const amountStr = p.amount.toLocaleString('ru-RU')

    const text = `🗓 <b>Напоминание о платеже по рассрочке</b>\n\nЗдравствуйте, ${student?.name ?? ''}!\n\nЧерез <b>${daysUntil} дн.</b> (${dueDateStr}) необходимо внести платёж <b>${amountStr} ₽</b> по рассрочке за абонемент.\n\nВаш личный кабинет доступен на сайте школы.`

    if (student?.telegram_chat_id) {
      const ok = await tgSend(student.telegram_chat_id, text)
      if (ok) sentCount++
    }
  }

  return NextResponse.json({ ok: true, reminders_sent: sentCount })
}
