'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { localDateStr } from '@/lib/dates'

type InstallmentPayment = {
  id: string
  plan_id: string
  amount: number
  due_date: string
  status: 'pending' | 'paid' | 'overdue'
  paid_at: string | null
  actual_amount: number | null
  payment_id: string | null
}

type InstallmentPlan = {
  id: string
  subscription_id: string
  total_amount: number
  deposit_amount: number
  deposit_paid_at: string | null
  status: 'active' | 'completed' | 'cancelled'
  grace_period_days: number
  notes: string | null
  created_at: string
  subscriptions: {
    id: string
    type: string
    student_id: string
    students: { id: string; name: string } | null
  } | null
  installment_payments: InstallmentPayment[]
}

export default function InstallmentsPage() {
  const [plans, setPlans] = useState<InstallmentPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)
  const [paying, setPaying] = useState<string | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', date: localDateStr(), type: 'cash' })

  useEffect(() => { loadPlans() }, [])

  async function loadPlans() {
    const { data } = await supabase
      .from('installment_plans')
      .select(`
        *,
        subscriptions (
          id, type, student_id,
          students ( id, name )
        ),
        installment_payments ( * )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setPlans((data as InstallmentPlan[]) || [])
    setLoading(false)
  }

  async function markPaid(plan: InstallmentPlan, payment: InstallmentPayment) {
    if (paying === payment.id) return
    setPaying(payment.id)

    const studentId = plan.subscriptions?.student_id ?? null
    const studentName = plan.subscriptions?.students?.name ?? ''
    const amount = parseFloat(payForm.amount) || payment.amount

    // 1. Создать запись в payments
    const { data: payRecord } = await supabase.from('payments').insert({
      amount,
      direction: 'income',
      category: 'Доплата за абон.',
      payment_type: payForm.type,
      description: `Рассрочка: ${studentName}`,
      paid_at: payForm.date,
      status: 'confirmed',
      student_id: studentId,
    }).select('id').single()

    // 2. Обновить платёж
    await supabase.from('installment_payments').update({
      status: 'paid',
      paid_at: payForm.date,
      actual_amount: amount,
      payment_id: payRecord?.id ?? null,
    }).eq('id', payment.id)

    // 3. Проверить завершение плана
    const updatedPayments = plan.installment_payments.map(p =>
      p.id === payment.id ? { ...p, status: 'paid' as const } : p
    )
    const allPaid = updatedPayments.every(p => p.status === 'paid')
    if (allPaid) {
      await supabase.from('installment_plans').update({ status: 'completed' }).eq('id', plan.id)
    }

    setPaying(null)
    setExpandedPlan(null)
    await loadPlans()
  }

  const today = localDateStr()

  // Вычисляемые метрики
  const allPayments = plans.flatMap(p => p.installment_payments)
  const overduePayments = allPayments.filter(p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < today))
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const upcomingPayments = allPayments.filter(p => p.status === 'pending' && p.due_date >= today && p.due_date <= weekFromNow)
  const totalDebt = allPayments
    .filter(p => p.status === 'pending' || p.status === 'overdue')
    .reduce((s, p) => s + p.amount, 0)

  // Группировка просроченных по плану
  const overduePlanIds = new Set(overduePayments.map(p => p.plan_id))

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Рассрочки</h1>
      </div>

      {/* Виджеты */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{overduePlanIds.size}</div>
          <div className="text-xs text-red-400 mt-0.5">Просрочено</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{upcomingPayments.length}</div>
          <div className="text-xs text-yellow-500 mt-0.5">На этой неделе</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
          <div className="text-lg font-bold text-blue-700">{totalDebt.toLocaleString('ru-RU')}</div>
          <div className="text-xs text-blue-400 mt-0.5">Дебиторка, ₽</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : plans.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Активных рассрочек нет</div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const student = plan.subscriptions?.students
            const payments = [...plan.installment_payments].sort((a, b) => a.due_date.localeCompare(b.due_date))
            const paidAmount = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.actual_amount ?? p.amount), 0) + plan.deposit_amount
            const progress = Math.min(100, Math.round((paidAmount / plan.total_amount) * 100))
            const hasOverdue = payments.some(p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < today))
            const isExpanded = expandedPlan === plan.id

            return (
              <div key={plan.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${hasOverdue ? 'border-red-200' : 'border-gray-100'}`}>
                {/* Шапка */}
                <button className="w-full text-left px-4 py-3" onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">{student?.name ?? '—'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {plan.subscriptions?.type?.includes('|')
                          ? plan.subscriptions.type.split('|')[1]
                          : plan.subscriptions?.type ?? '—'}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      {hasOverdue && <div className="text-xs text-red-500 font-medium mb-0.5">⚠ Просрочка</div>}
                      <div className="text-xs text-gray-500">
                        {paidAmount.toLocaleString('ru-RU')} / {plan.total_amount.toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  </div>
                  {/* Прогресс-бар */}
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : hasOverdue ? 'bg-red-400' : 'bg-blue-500'}`}
                      style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{progress}% оплачено</div>
                </button>

                {/* Раскрытый вид */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    {/* Аванс */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-50">
                      <span className="text-xs text-gray-500">Аванс ({plan.deposit_paid_at ?? '—'})</span>
                      <span className="text-xs font-medium text-green-600">✓ {plan.deposit_amount.toLocaleString('ru-RU')} ₽</span>
                    </div>

                    {/* Платежи по графику */}
                    {payments.map(p => {
                      const isOverdue = p.status === 'overdue' || (p.status === 'pending' && p.due_date < today)
                      const isPaid = p.status === 'paid'
                      const isPayingThis = paying === p.id

                      return (
                        <div key={p.id}>
                          <div className={`flex items-center justify-between py-2 border-b border-gray-50`}>
                            <div>
                              <div className={`text-xs font-medium ${isPaid ? 'text-green-600' : isOverdue ? 'text-red-500' : 'text-gray-700'}`}>
                                {isPaid ? '✓' : isOverdue ? '⚠' : '○'}{' '}
                                {new Date(p.due_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                                {isOverdue && ` (+${Math.floor((Date.now() - new Date(p.due_date).getTime()) / 86400000)} дн.)`}
                              </div>
                              {isPaid && p.paid_at && (
                                <div className="text-xs text-gray-400">оплачено {p.paid_at}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${isPaid ? 'text-green-600' : isOverdue ? 'text-red-500' : 'text-gray-700'}`}>
                                {(p.actual_amount ?? p.amount).toLocaleString('ru-RU')} ₽
                              </span>
                              {!isPaid && (
                                <button
                                  onClick={() => { setPayForm({ amount: String(p.amount), date: localDateStr(), type: 'cash' }); setPaying(p.id) }}
                                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                  disabled={isPayingThis}>
                                  Оплачено
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Мини-форма оплаты */}
                          {paying === p.id && (
                            <div className="bg-blue-50 rounded-xl p-3 my-2 space-y-2">
                              <div className="flex gap-2">
                                <input type="number" value={payForm.amount}
                                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                                  placeholder="Сумма ₽"
                                  className="flex-1 border border-blue-200 rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
                                <input type="date" value={payForm.date}
                                  onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))}
                                  className="flex-1 border border-blue-200 rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
                              </div>
                              <div className="flex gap-2">
                                {['cash', 'transfer'].map(t => (
                                  <button key={t} type="button"
                                    onClick={() => setPayForm(f => ({ ...f, type: t }))}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors
                                      ${payForm.type === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 bg-white'}`}>
                                    {t === 'cash' ? '💵 Наличные' : '💳 Перевод'}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => markPaid(plan, p)}
                                  className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-green-700">
                                  Подтвердить
                                </button>
                                <button onClick={() => setPaying(null)}
                                  className="px-3 border border-gray-200 text-gray-500 py-1.5 rounded-lg text-xs">
                                  Отмена
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Ссылки */}
                    <div className="flex gap-3 mt-3">
                      {plan.subscriptions?.student_id && (
                        <Link href={`/students/${plan.subscriptions.student_id}`}
                          className="text-xs text-blue-500 hover:text-blue-700">
                          → Карточка ученика
                        </Link>
                      )}
                      <Link href={`/print/installment/${plan.id}`} target="_blank"
                        className="text-xs text-gray-500 hover:text-gray-700">
                        📄 Приложение к договору
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
