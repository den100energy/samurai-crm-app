'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Payment = {
  id: string
  amount: number
  payment_type: string
  description: string | null
  paid_at: string
  students: { name: string } | null
}

type Student = { id: string; name: string }

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

export default function FinancePage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year] = useState(now.getFullYear())
  const [payments, setPayments] = useState<Payment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    student_id: '', amount: '', payment_type: 'cash', description: '', paid_at: now.toISOString().split('T')[0]
  })

  async function loadPayments(m: number) {
    setLoading(true)
    const from = `${year}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, m + 1, 0).getDate()
    const to = `${year}-${String(m + 1).padStart(2, '0')}-${lastDay}`

    const { data } = await supabase
      .from('payments')
      .select('*, students(name)')
      .gte('paid_at', from)
      .lte('paid_at', to)
      .order('paid_at', { ascending: false })

    setPayments(data || [])
    setLoading(false)
  }

  useEffect(() => {
    supabase.from('students').select('id, name').eq('status', 'active').order('name')
      .then(({ data }) => setStudents(data || []))
    loadPayments(month)
  }, [])

  function changeMonth(m: number) {
    setMonth(m)
    loadPayments(m)
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault()
    const { data } = await supabase.from('payments').insert({
      student_id: form.student_id || null,
      amount: parseFloat(form.amount),
      payment_type: form.payment_type,
      description: form.description || null,
      paid_at: form.paid_at,
    }).select('*, students(name)').single()

    if (data) setPayments(prev => [data, ...prev])
    setShowForm(false)
    setForm({ student_id: '', amount: '', payment_type: 'cash', description: '', paid_at: now.toISOString().split('T')[0] })
  }

  async function deletePayment(id: string) {
    if (!confirm('Удалить платёж?')) return
    await supabase.from('payments').delete().eq('id', id)
    setPayments(prev => prev.filter(p => p.id !== id))
  }

  const totalAll = payments.reduce((sum, p) => sum + p.amount, 0)
  const totalCash = payments.filter(p => p.payment_type === 'cash').reduce((sum, p) => sum + p.amount, 0)
  const totalTransfer = payments.filter(p => p.payment_type === 'transfer').reduce((sum, p) => sum + p.amount, 0)

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Финансы</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="ml-auto bg-black text-white px-4 py-2 rounded-xl text-sm font-medium">
          + Платёж
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
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-lg font-bold text-gray-800">{totalAll.toLocaleString()} ₽</div>
          <div className="text-xs text-gray-400">Всего</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-lg font-bold text-green-600">{totalCash.toLocaleString()} ₽</div>
          <div className="text-xs text-gray-400">Наличные</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-lg font-bold text-blue-600">{totalTransfer.toLocaleString()} ₽</div>
          <div className="text-xs text-gray-400">Перевод</div>
        </div>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <form onSubmit={addPayment} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 space-y-3">
          <select value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            <option value="">Ученик (необязательно)</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
            placeholder="Сумма (₽) *" type="number" min="0"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
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
          <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            placeholder="Комментарий (абонемент, взнос...)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <input required value={form.paid_at} onChange={e => setForm({...form, paid_at: e.target.value})}
            type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <button type="submit" className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium">
            Сохранить
          </button>
        </form>
      )}

      {/* Список платежей */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : payments.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Платежей в {MONTHS[month]} нет</div>
      ) : (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="text-xl">{p.payment_type === 'cash' ? '💵' : '💳'}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800">{p.students?.name || 'Без ученика'}</div>
                <div className="text-xs text-gray-400">{p.description || '—'} · {p.paid_at}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-800">{p.amount.toLocaleString()} ₽</div>
              </div>
              <button onClick={() => deletePayment(p.id)} className="text-gray-300 hover:text-red-400 text-lg ml-1">×</button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
