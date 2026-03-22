'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Payment = {
  amount: number
  direction: 'income' | 'expense' | null
  category: string | null
  paid_at: string
  payment_type: string
}

const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

export default function FinanceAnalyticsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const year = new Date().getFullYear()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('payments')
        .select('amount, direction, category, paid_at, payment_type')
        .gte('paid_at', `${year}-01-01`)
        .lte('paid_at', `${year}-12-31`)
        .neq('status', 'pending')
      setPayments(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-center text-gray-400 py-16">Загрузка...</div>

  const isIncome = (p: Payment) => p.direction === 'income' || p.direction === null

  // Monthly totals
  const monthlyIncome = Array(12).fill(0)
  const monthlyExpense = Array(12).fill(0)
  for (const p of payments) {
    const m = new Date(p.paid_at).getMonth()
    if (isIncome(p)) monthlyIncome[m] += p.amount
    else monthlyExpense[m] += p.amount
  }

  const maxMonthly = Math.max(...monthlyIncome, ...monthlyExpense, 1)
  const totalIncome = monthlyIncome.reduce((s, v) => s + v, 0)
  const totalExpense = monthlyExpense.reduce((s, v) => s + v, 0)
  const totalBalance = totalIncome - totalExpense

  // Category breakdown
  const incomeByCategory: Record<string, number> = {}
  const expenseByCategory: Record<string, number> = {}
  const cashTotal = payments.filter(p => isIncome(p) && p.payment_type === 'cash').reduce((s, p) => s + p.amount, 0)
  const transferTotal = payments.filter(p => isIncome(p) && p.payment_type === 'transfer').reduce((s, p) => s + p.amount, 0)

  for (const p of payments) {
    const cat = p.category || 'Без категории'
    if (isIncome(p)) incomeByCategory[cat] = (incomeByCategory[cat] || 0) + p.amount
    else expenseByCategory[cat] = (expenseByCategory[cat] || 0) + p.amount
  }

  const topIncome = Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const topExpense = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxIncomeCat = topIncome[0]?.[1] || 1
  const maxExpenseCat = topExpense[0]?.[1] || 1

  // Current month
  const curMonth = new Date().getMonth()
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1
  const curIncome = monthlyIncome[curMonth]
  const prevIncome = monthlyIncome[prevMonth]
  const curExpense = monthlyExpense[curMonth]
  const prevExpense = monthlyExpense[prevMonth]

  function pct(val: number, prev: number) {
    if (prev === 0) return null
    const d = Math.round(((val - prev) / prev) * 100)
    return d
  }

  const incomeGrowth = pct(curIncome, prevIncome)
  const expenseGrowth = pct(curExpense, prevExpense)

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/finance" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Аналитика {year}</h1>
      </div>

      {/* Итоги года */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-3 text-center">
          <div className="text-base font-bold text-green-700">+{fmt(totalIncome)}</div>
          <div className="text-xs text-green-500 mt-0.5">Доходы</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
          <div className="text-base font-bold text-red-600">−{fmt(totalExpense)}</div>
          <div className="text-xs text-red-400 mt-0.5">Расходы</div>
        </div>
        <div className={`rounded-2xl p-3 border text-center ${totalBalance >= 0 ? 'bg-white border-gray-100' : 'bg-red-50 border-red-100'}`}>
          <div className={`text-base font-bold ${totalBalance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
            {totalBalance >= 0 ? '+' : ''}{fmt(totalBalance)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Баланс</div>
        </div>
      </div>

      {/* Сравнение с прошлым месяцем */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="text-sm font-medium text-gray-700 mb-3">
          {MONTHS_SHORT[curMonth]} vs {MONTHS_SHORT[prevMonth]}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-400 mb-1">Доходы</div>
            <div className="font-bold text-gray-800">{fmt(curIncome)} ₽</div>
            {incomeGrowth !== null && (
              <div className={`text-xs mt-0.5 ${incomeGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {incomeGrowth >= 0 ? '▲' : '▼'} {Math.abs(incomeGrowth)}% к прошлому месяцу
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Расходы</div>
            <div className="font-bold text-gray-800">{fmt(curExpense)} ₽</div>
            {expenseGrowth !== null && (
              <div className={`text-xs mt-0.5 ${expenseGrowth <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {expenseGrowth >= 0 ? '▲' : '▼'} {Math.abs(expenseGrowth)}% к прошлому месяцу
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-400 flex justify-between">
          <span>💵 Наличные: {fmt(cashTotal)} ₽</span>
          <span>💳 Перевод: {fmt(transferTotal)} ₽</span>
        </div>
      </div>

      {/* График по месяцам */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="text-sm font-medium text-gray-700 mb-3">Доходы и расходы по месяцам</div>
        <div className="flex items-end gap-1.5 h-32">
          {MONTHS_SHORT.map((m, i) => {
            const inc = monthlyIncome[i]
            const exp = monthlyExpense[i]
            const incH = Math.round((inc / maxMonthly) * 112)
            const expH = Math.round((exp / maxMonthly) * 112)
            const isCurrentMonth = i === curMonth
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end gap-0.5 justify-center" style={{ height: 112 }}>
                  <div
                    style={{ height: incH || 2 }}
                    className={`flex-1 rounded-t-sm ${isCurrentMonth ? 'bg-green-500' : 'bg-green-200'}`}
                    title={`Доход: ${fmt(inc)} ₽`}
                  />
                  <div
                    style={{ height: expH || 2 }}
                    className={`flex-1 rounded-t-sm ${isCurrentMonth ? 'bg-red-400' : 'bg-red-200'}`}
                    title={`Расход: ${fmt(exp)} ₽`}
                  />
                </div>
                <div className={`text-xs ${isCurrentMonth ? 'font-bold text-gray-700' : 'text-gray-400'}`}>{m}</div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-2 justify-center">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-3 h-3 rounded-sm bg-green-400" /> Доходы
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-3 h-3 rounded-sm bg-red-300" /> Расходы
          </div>
        </div>
      </div>

      {/* Топ категорий доходов */}
      {topIncome.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="text-sm font-medium text-gray-700 mb-3">Доходы по категориям</div>
          <div className="space-y-2.5">
            {topIncome.map(([cat, amt]) => (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 truncate max-w-[70%]">{cat}</span>
                  <span className="font-medium text-green-700">{fmt(amt)} ₽</span>
                </div>
                <div className="w-full bg-green-50 rounded-full h-1.5">
                  <div
                    className="bg-green-400 h-1.5 rounded-full"
                    style={{ width: `${Math.round((amt / maxIncomeCat) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Топ категорий расходов */}
      {topExpense.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="text-sm font-medium text-gray-700 mb-3">Расходы по категориям</div>
          <div className="space-y-2.5">
            {topExpense.map(([cat, amt]) => (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 truncate max-w-[70%]">{cat}</span>
                  <span className="font-medium text-red-600">{fmt(amt)} ₽</span>
                </div>
                <div className="w-full bg-red-50 rounded-full h-1.5">
                  <div
                    className="bg-red-400 h-1.5 rounded-full"
                    style={{ width: `${Math.round((amt / maxExpenseCat) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {payments.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          <div className="text-4xl mb-3">📊</div>
          <div>Нет данных за {year} год</div>
          <div className="text-sm mt-1">Добавьте платежи в разделе Финансы</div>
        </div>
      )}
    </main>
  )
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'М'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'К'
  return n.toLocaleString('ru-RU')
}
