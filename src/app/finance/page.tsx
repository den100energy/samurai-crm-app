'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Payment = {
  id: string
  amount: number
  direction: 'income' | 'expense' | null
  category: string | null
  payment_type: string
  description: string | null
  paid_at: string
  status: string | null
  student_id: string | null
  students: { name: string }[] | null
}

type Student = { id: string; name: string }

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

const INCOME_CATEGORIES = [
  'Абонементы', 'Доплата за абон.', 'Мероприятия+', 'Товары+', 'Услуги+',
  'Проб.зан', 'МК+', 'Интенсив+', 'Аттестация+', 'Курсы+',
  'Получение кредита', 'Взнос основателя', 'Поступлений инвестиций',
]

const EXPENSE_CATEGORIES = [
  'АНО Вакикай', 'Аренда', 'Возврат', 'Возврат инвестиций',
  'ГСМ+транспорт', 'Кредит возврат', 'Маркетинг Абонементы',
  'Маркетинг Доп.Продажи', 'Маркетинг Мероп.', 'Налоги',
  'Обслуживание денег', 'Выплата Основателю', 'Промоутеры',
  'Расходники', 'Связь/интернет', 'Сервисы', 'ФОНД ОТ',
  'ФОТ - оклады', 'ФОТ бонус', 'Юрист', 'Мероприятия-', 'Товары-',
]

export default function FinancePage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year] = useState(now.getFullYear())
  const [payments, setPayments] = useState<Payment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [form, setForm] = useState({
    direction: 'income' as 'income' | 'expense',
    category: 'Абонементы',
    amount: '',
    payment_type: 'cash',
    description: '',
    paid_at: now.toISOString().split('T')[0],
    student_id: '',
  })

  async function loadPayments(m: number) {
    setLoading(true)
    const from = `${year}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, m + 1, 0).getDate()
    const to = `${year}-${String(m + 1).padStart(2, '0')}-${lastDay}`

    const [{ data }, { data: studs }] = await Promise.all([
      supabase
        .from('payments')
        .select('id, amount, direction, category, payment_type, description, paid_at, status, student_id, students(name)')
        .gte('paid_at', from)
        .lte('paid_at', to)
        .neq('status', 'pending')
        .order('paid_at', { ascending: false }),
      supabase.from('students').select('id, name').eq('status', 'active').order('name'),
    ])

    setPayments(data || [])
    setStudents(studs || [])
    setLoading(false)
  }

  useEffect(() => { loadPayments(month) }, [])

  function changeMonth(m: number) {
    setMonth(m)
    loadPayments(m)
  }

  function changeDirection(dir: 'income' | 'expense') {
    const defaultCat = dir === 'income' ? 'Абонементы' : 'Аренда'
    setForm(f => ({ ...f, direction: dir, category: defaultCat }))
  }

  const emptyForm = { direction: 'income' as 'income' | 'expense', category: 'Абонементы', amount: '', payment_type: 'cash', description: '', paid_at: now.toISOString().split('T')[0], student_id: '' }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault()
    const { data } = await supabase.from('payments').insert({
      amount: parseFloat(form.amount),
      direction: form.direction,
      category: form.category,
      payment_type: form.payment_type,
      description: form.description || null,
      paid_at: form.paid_at,
      status: 'confirmed',
      student_id: form.student_id || null,
    }).select('id, amount, direction, category, payment_type, description, paid_at, status, student_id, students(name)').single()

    if (data) setPayments(prev => [data as any, ...prev].sort((a, b) => b.paid_at.localeCompare(a.paid_at)))
    setShowForm(false)
    setStudentSearch('')
    setForm(emptyForm)
  }

  async function deletePayment(id: string) {
    if (!confirm('Удалить запись?')) return
    await supabase.from('payments').delete().eq('id', id)
    setPayments(prev => prev.filter(p => p.id !== id))
  }

  function exportCSV() {
    const monthName = MONTHS[month]
    const rows = [['Дата', 'Доход', 'Расход', 'Категория', 'Комментарий', 'Тип оплаты']]
    const sorted = [...payments].sort((a, b) => a.paid_at.localeCompare(b.paid_at))
    for (const p of sorted) {
      const isIncome = p.direction === 'income' || p.direction === null
      rows.push([
        p.paid_at,
        isIncome ? String(p.amount) : '',
        !isIncome ? String(p.amount) : '',
        p.category || '',
        p.description || '',
        p.payment_type === 'cash' ? 'Наличные' : 'Перевод',
      ])
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ОДДС_${monthName}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Итоги
  const income = payments.filter(p => p.direction === 'income' || p.direction === null).reduce((s, p) => s + p.amount, 0)
  const expense = payments.filter(p => p.direction === 'expense').reduce((s, p) => s + p.amount, 0)
  const balance = income - expense
  const cash = payments.filter(p => p.payment_type === 'cash' && (p.direction === 'income' || p.direction === null)).reduce((s, p) => s + p.amount, 0)
  const transfer = payments.filter(p => p.payment_type === 'transfer' && (p.direction === 'income' || p.direction === null)).reduce((s, p) => s + p.amount, 0)

  const categories = form.direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Финансы</h1>
        <Link href="/finance/analytics" className="ml-auto text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl">
          📊 Аналитика
        </Link>
        <button onClick={exportCSV} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl">
          ⬇ CSV
        </button>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-black text-white px-4 py-2 rounded-xl text-sm font-medium">
          + Добавить
        </button>
      </div>

      {/* Выбор месяца */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {MONTHS.map((m, i) => (
          <button key={i} onClick={() => changeMonth(i)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${month === i ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Итоги */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-3 text-center">
          <div className="text-lg font-bold text-green-700">+{income.toLocaleString()} ₽</div>
          <div className="text-xs text-green-500">Доходы</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
          <div className="text-lg font-bold text-red-600">−{expense.toLocaleString()} ₽</div>
          <div className="text-xs text-red-400">Расходы</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className={`rounded-2xl p-3 border text-center ${balance >= 0 ? 'bg-white border-gray-100' : 'bg-red-50 border-red-100'}`}>
          <div className={`text-base font-bold ${balance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString()} ₽
          </div>
          <div className="text-xs text-gray-400">Баланс</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
          <div className="text-base font-bold text-gray-700">{cash.toLocaleString()} ₽</div>
          <div className="text-xs text-gray-400">💵 Касса</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
          <div className="text-base font-bold text-gray-700">{transfer.toLocaleString()} ₽</div>
          <div className="text-xs text-gray-400">💳 Счёт</div>
        </div>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <form onSubmit={addPayment} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 space-y-3">
          {/* Доход / Расход */}
          <div className="flex gap-2">
            <button type="button" onClick={() => changeDirection('income')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                ${form.direction === 'income' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600'}`}>
              💰 Доход
            </button>
            <button type="button" onClick={() => changeDirection('expense')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                ${form.direction === 'expense' ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600'}`}>
              💸 Расход
            </button>
          </div>

          {/* Категория */}
          <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Сумма */}
          <input required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
            placeholder="Сумма (₽) *" type="number" min="0"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />

          {/* Нал / Безнал */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({...form, payment_type: 'cash'})}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                ${form.payment_type === 'cash' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
              💵 Наличные
            </button>
            <button type="button" onClick={() => setForm({...form, payment_type: 'transfer'})}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                ${form.payment_type === 'transfer' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
              💳 Перевод
            </button>
          </div>

          {/* Ученик (для доходов) */}
          {form.direction === 'income' && (
            <div>
              <input
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="Поиск ученика (необязательно)..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none mb-1"
              />
              {studentSearch.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                  {students
                    .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
                    .slice(0, 5)
                    .map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { setForm({...form, student_id: s.id}); setStudentSearch(s.name) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0">
                        {s.name}
                      </button>
                    ))}
                </div>
              )}
              {form.student_id && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    👤 {studentSearch}
                  </span>
                  <button type="button" onClick={() => { setForm({...form, student_id: ''}); setStudentSearch('') }}
                    className="text-xs text-gray-400 hover:text-red-400">✕</button>
                </div>
              )}
            </div>
          )}

          {/* Комментарий */}
          <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            placeholder="Комментарий (назначение...)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />

          {/* Дата */}
          <input required value={form.paid_at} onChange={e => setForm({...form, paid_at: e.target.value})}
            type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />

          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-medium">
              Сохранить
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Список операций */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : payments.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Операций в {MONTHS[month]} нет</div>
      ) : (
        <div className="space-y-2">
          {payments.map(p => {
            const isIncome = p.direction === 'income' || p.direction === null
            return (
              <div key={p.id} className="bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                  ${isIncome ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {isIncome ? '+' : '−'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 text-sm">{p.category || '—'}</div>
                  <div className="text-xs text-gray-400 truncate">
                    {p.students?.[0]?.name && <span className="text-blue-500">👤 {p.students[0].name} · </span>}
                    {p.description || ''}
                    {p.description ? ' · ' : ''}
                    {p.payment_type === 'cash' ? '💵' : '💳'} · {p.paid_at.slice(5).replace('-', '.')}
                  </div>
                </div>
                <div className={`font-bold text-sm shrink-0 ${isIncome ? 'text-green-700' : 'text-red-500'}`}>
                  {isIncome ? '+' : '−'}{p.amount.toLocaleString()} ₽
                </div>
                <button onClick={() => deletePayment(p.id)} className="text-gray-300 hover:text-red-400 text-lg shrink-0">×</button>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
