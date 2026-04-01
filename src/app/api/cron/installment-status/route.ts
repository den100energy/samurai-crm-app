import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  // 1. Найти все pending-платежи с истёкшей датой
  const { data: pendingOverdue } = await admin
    .from('installment_payments')
    .select('id, plan_id, due_date, installment_plans(grace_period_days, subscriptions(student_id))')
    .eq('status', 'pending')
    .lt('due_date', today)

  const overdueIds = (pendingOverdue ?? []).map(p => p.id)

  // 2. Обновить статус на overdue
  if (overdueIds.length > 0) {
    await admin.from('installment_payments')
      .update({ status: 'overdue' })
      .in('id', overdueIds)
  }

  // 3. Автоблокировка: просрочка > grace_period_days
  const studentsToBlock = new Set<string>()
  for (const payment of pendingOverdue ?? []) {
    const daysOverdue = Math.floor(
      (Date.now() - new Date(payment.due_date).getTime()) / 86400000
    )
    const plan = payment.installment_plans as any
    const gracePeriod = plan?.grace_period_days ?? 5
    const studentId = plan?.subscriptions?.student_id
    if (daysOverdue > gracePeriod && studentId) {
      studentsToBlock.add(studentId)
    }
  }

  let blockedCount = 0
  for (const studentId of studentsToBlock) {
    const { count } = await admin.from('installment_payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'overdue')
      .eq('installment_plans.subscriptions.student_id', studentId)
    if ((count ?? 0) > 0) {
      await admin.from('students')
        .update({ status: 'suspended' })
        .eq('id', studentId)
        .eq('status', 'active')
      blockedCount++
    }
  }

  // 4. Разблокировка: если у suspended-ученика нет overdue-платежей
  const { data: overdueNow } = await admin
    .from('installment_payments')
    .select('plan_id, installment_plans(subscriptions(student_id))')
    .eq('status', 'overdue')

  const studentsWithDebt = new Set(
    (overdueNow ?? []).map(p => (p.installment_plans as any)?.subscriptions?.student_id).filter(Boolean)
  )

  const { data: suspended } = await admin
    .from('students')
    .select('id')
    .eq('status', 'suspended')

  let unblockedCount = 0
  for (const s of suspended ?? []) {
    if (!studentsWithDebt.has(s.id)) {
      await admin.from('students').update({ status: 'active' }).eq('id', s.id)
      unblockedCount++
    }
  }

  return NextResponse.json({
    ok: true,
    overdue_marked: overdueIds.length,
    students_blocked: blockedCount,
    students_unblocked: unblockedCount,
  })
}
