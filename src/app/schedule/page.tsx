'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ScheduleEntry = {
  id: string
  group_name: string
  trainer_id: string | null
  day_of_week: number
  start_time: string | null
  end_time: string | null
  trainers: { name: string } | null
}

type Trainer = { id: string; name: string }

const DAYS = [
  { num: 1, short: 'Пн', full: 'Понедельник' },
  { num: 2, short: 'Вт', full: 'Вторник' },
  { num: 3, short: 'Ср', full: 'Среда' },
  { num: 4, short: 'Чт', full: 'Четверг' },
  { num: 5, short: 'Пт', full: 'Пятница' },
  { num: 6, short: 'Сб', full: 'Суббота' },
  { num: 7, short: 'Вс', full: 'Воскресенье' },
]

const GROUPS = ['Дети 4-9', 'Подростки (нач)', 'Подростки (оп)', 'Цигун', 'Индивидуальные']

const GROUP_COLORS: Record<string, string> = {
  'Дети 4-9':        'bg-yellow-50 border-yellow-200 text-yellow-800',
  'Подростки (нач)': 'bg-blue-50 border-blue-200 text-blue-800',
  'Подростки (оп)':  'bg-purple-50 border-purple-200 text-purple-800',
  'Цигун':           'bg-green-50 border-green-200 text-green-800',
  'Индивидуальные':  'bg-orange-50 border-orange-200 text-orange-800',
}

const emptyForm = { group_name: '', trainer_id: '', day_of_week: '', start_time: '', end_time: '' }

export default function SchedulePage() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: sched }, { data: tr }] = await Promise.all([
      supabase.from('schedule').select('*, trainers(name)').order('day_of_week').order('start_time'),
      supabase.from('trainers').select('id, name').order('name'),
    ])
    setEntries(sched || [])
    setTrainers(tr || [])
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('schedule').insert({
      group_name: form.group_name,
      trainer_id: form.trainer_id || null,
      day_of_week: parseInt(form.day_of_week),
      start_time: form.start_time || null,
      end_time: form.end_time || null,
    })
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Удалить запись расписания?')) return
    await supabase.from('schedule').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  // Today's day of week (1=Mon...7=Sun, JS: 0=Sun,1=Mon...)
  const jsDay = new Date().getDay()
  const todayNum = jsDay === 0 ? 7 : jsDay

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Расписание</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="ml-auto bg-black text-white px-4 py-2 rounded-xl text-sm font-medium">
          + Добавить
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 space-y-3">
          <div className="text-sm font-medium text-gray-700">Новое занятие в расписании</div>
          <select required value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
            <option value="">Группа *</option>
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select required value={form.day_of_week} onChange={e => setForm({...form, day_of_week: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
            <option value="">День недели *</option>
            {DAYS.map(d => <option key={d.num} value={d.num}>{d.full}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              placeholder="Начало" />
            <input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              placeholder="Конец" />
          </div>
          <select value={form.trainer_id} onChange={e => setForm({...form, trainer_id: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
            <option value="">Тренер (необязательно)</option>
            {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 border border-gray-200 text-gray-500 py-2 rounded-xl text-sm">
              Отмена
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <div className="text-4xl mb-3">🗓</div>
          <div>Расписание не добавлено</div>
          <div className="text-sm mt-1">Нажмите "+ Добавить" чтобы начать</div>
        </div>
      ) : (
        <div className="space-y-3">
          {DAYS.map(day => {
            const dayEntries = entries.filter(e => e.day_of_week === day.num)
            if (dayEntries.length === 0) return null
            const isToday = day.num === todayNum
            return (
              <div key={day.num} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isToday ? 'border-black' : 'border-gray-100'}`}>
                <div className={`px-4 py-2 flex items-center justify-between ${isToday ? 'bg-black' : 'bg-gray-50'}`}>
                  <div className={`font-semibold text-sm ${isToday ? 'text-white' : 'text-gray-700'}`}>
                    {day.full} {isToday && <span className="text-xs font-normal opacity-70 ml-1">— сегодня</span>}
                  </div>
                  <div className={`text-xs ${isToday ? 'text-gray-300' : 'text-gray-400'}`}>
                    {dayEntries.length} {dayEntries.length === 1 ? 'группа' : 'группы'}
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {dayEntries.map(entry => {
                    const colorClass = GROUP_COLORS[entry.group_name] || 'bg-gray-50 border-gray-200 text-gray-700'
                    return (
                      <div key={entry.id} className={`flex items-center justify-between p-3 rounded-xl border ${colorClass}`}>
                        <div>
                          <div className="font-medium text-sm">{entry.group_name}</div>
                          <div className="text-xs opacity-70 mt-0.5 flex items-center gap-2">
                            {entry.start_time && entry.end_time && (
                              <span>🕐 {entry.start_time.slice(0,5)}–{entry.end_time.slice(0,5)}</span>
                            )}
                            {entry.trainers?.name && (
                              <span>👤 {entry.trainers.name}</span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => remove(entry.id)}
                          className="text-sm opacity-40 hover:opacity-70 ml-3">✕</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
