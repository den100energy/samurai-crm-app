'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Trainer = {
  id: string
  name: string
  rate_per_session: number
}

export default function SalaryPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', rate_per_session: '' })
  const [saving, setSaving] = useState(false)

  // Salary calculator
  const [selectedTrainer, setSelectedTrainer] = useState('')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [calculating, setCalculating] = useState(false)

  useEffect(() => {
    loadTrainers()
  }, [])

  async function loadTrainers() {
    const { data } = await supabase.from('trainers').select('*').order('name')
    setTrainers(data || [])
  }

  async function addTrainer(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('trainers').insert({
      name: form.name,
      rate_per_session: parseFloat(form.rate_per_session) || 0,
    })
    setForm({ name: '', rate_per_session: '' })
    setShowForm(false)
    setSaving(false)
    loadTrainers()
  }

  async function deleteTrainer(id: string) {
    if (!confirm('Удалить тренера?')) return
    await supabase.from('trainers').delete().eq('id', id)
    loadTrainers()
  }

  async function calculate() {
    setCalculating(true)
    setSessionCount(null)
    // Count distinct training dates in selected month
    const from = `${month}-01`
    const to = `${month}-31`
    const { data } = await supabase
      .from('attendance')
      .select('date')
      .eq('present', true)
      .gte('date', from)
      .lte('date', to)

    if (data) {
      const uniqueDates = new Set(data.map(r => r.date))
      setSessionCount(uniqueDates.size)
    }
    setCalculating(false)
  }

  const trainer = trainers.find(t => t.id === selectedTrainer)
  const salary = (trainer && sessionCount !== null) ? sessionCount * trainer.rate_per_session : null

  const monthLabel = new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Зарплата тренеров</h1>
      </div>

      {/* Salary calculator */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="font-semibold text-gray-800 mb-4">Расчёт зарплаты</div>

        <div className="space-y-3 mb-4">
          <select
            value={selectedTrainer}
            onChange={e => { setSelectedTrainer(e.target.value); setSessionCount(null) }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
          >
            <option value="">Выберите тренера</option>
            {trainers.map(t => (
              <option key={t.id} value={t.id}>{t.name} — {t.rate_per_session} ₽/тренировка</option>
            ))}
          </select>

          <input
            type="month"
            value={month}
            onChange={e => { setMonth(e.target.value); setSessionCount(null) }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none"
          />

          <button
            onClick={calculate}
            disabled={!selectedTrainer || calculating}
            className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
          >
            {calculating ? 'Считаем...' : 'Рассчитать'}
          </button>
        </div>

        {salary !== null && trainer && (
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">{monthLabel}</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Тренировок проведено</span>
                <span className="font-medium">{sessionCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ставка</span>
                <span className="font-medium">{trainer.rate_per_session} ₽</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-semibold text-gray-700">Итого к выплате</span>
                <span className="text-xl font-bold text-gray-800">{salary.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trainers list */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-gray-800">Тренеры</div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl"
          >
            + Добавить
          </button>
        </div>

        {showForm && (
          <form onSubmit={addTrainer} className="space-y-2 mb-4 p-3 bg-gray-50 rounded-xl">
            <input
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Имя тренера"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            />
            <input
              required
              type="number"
              value={form.rate_per_session}
              onChange={e => setForm({ ...form, rate_per_session: e.target.value })}
              placeholder="Ставка за тренировку (₽)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            />
            <button type="submit" disabled={saving}
              className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Добавить тренера'}
            </button>
          </form>
        )}

        {trainers.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4">Тренеров нет — добавьте первого</div>
        ) : (
          <div className="space-y-2">
            {trainers.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-medium text-gray-800 text-sm">{t.name}</div>
                  <div className="text-xs text-gray-400">{t.rate_per_session} ₽ за тренировку</div>
                </div>
                <button onClick={() => deleteTrainer(t.id)} className="text-xs text-red-400 hover:text-red-600">
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
