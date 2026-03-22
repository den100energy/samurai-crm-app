'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'

type ScheduleEntry = {
  id: string
  group_name: string
  trainer_name: string | null
  day_of_week: number
  time_start: string | null
  time_end: string | null
}

type Override = {
  id: string
  date: string
  group_name: string
  trainer_name: string | null
  time_start: string | null
  cancelled: boolean
  note: string | null
  notified_at: string | null
}

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

const GROUP_COLORS_LIGHT: Record<string, { card: string; label: string; sub: string }> = {
  'Дети 4-9':        { card: 'bg-yellow-50 border-yellow-200', label: 'text-yellow-900', sub: 'text-yellow-700' },
  'Подростки (нач)': { card: 'bg-blue-50 border-blue-200',     label: 'text-blue-900',   sub: 'text-blue-700' },
  'Подростки (оп)':  { card: 'bg-purple-50 border-purple-200', label: 'text-purple-900', sub: 'text-purple-700' },
  'Цигун':           { card: 'bg-green-50 border-green-200',   label: 'text-green-900',  sub: 'text-green-700' },
  'Индивидуальные':  { card: 'bg-orange-50 border-orange-200', label: 'text-orange-900', sub: 'text-orange-700' },
}

const GROUP_COLORS_DARK: Record<string, { card: string; label: string; sub: string }> = {
  'Дети 4-9':        { card: 'bg-yellow-950/60 border-yellow-700/40', label: 'text-yellow-200', sub: 'text-yellow-400' },
  'Подростки (нач)': { card: 'bg-blue-950/60 border-blue-700/40',     label: 'text-blue-200',   sub: 'text-blue-400' },
  'Подростки (оп)':  { card: 'bg-purple-950/60 border-purple-700/40', label: 'text-purple-200', sub: 'text-purple-400' },
  'Цигун':           { card: 'bg-green-950/60 border-green-700/40',   label: 'text-green-200',  sub: 'text-green-400' },
  'Индивидуальные':  { card: 'bg-orange-950/60 border-orange-700/40', label: 'text-orange-200', sub: 'text-orange-400' },
}

const GROUP_COLORS_FALLBACK_LIGHT = { card: 'bg-gray-50 border-gray-200', label: 'text-gray-800', sub: 'text-gray-500' }
const GROUP_COLORS_FALLBACK_DARK  = { card: 'bg-[#2C2C2E] border-[#3A3A3C]', label: 'text-[#E5E5E7]', sub: 'text-[#8E8E93]' }

const emptyForm = { group_name: '', trainer_name: '', days: [] as number[], time_start: '', time_end: '' }
const emptyOverride = { date: '', group_name: '', trainer_name: '', cancelled: false, note: '', time_start: '' }

// Get Monday of current week
function getWeekDates() {
  const now = new Date()
  const jsDay = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (jsDay === 0 ? 6 : jsDay - 1))
  const dates: Record<number, string> = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates[i + 1] = d.toISOString().split('T')[0]
  }
  return dates
}

// Get nearest future date for a given day of week
function nearestDateForDay(dayNum: number): string {
  const weekDates = getWeekDates()
  return weekDates[dayNum] || new Date().toISOString().split('T')[0]
}

export default function SchedulePage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const pageBg = dark ? 'bg-[#1C1C1E]' : 'bg-white'
  const textPrimary = dark ? 'text-[#E5E5E7]' : 'text-gray-800'
  const textSecondary = dark ? 'text-[#8E8E93]' : 'text-gray-500'
  const cardBase = dark ? 'bg-[#2C2C2E] border-[#3A3A3C]' : 'bg-white border-gray-100 shadow-sm'
  const inputCls = dark ? 'bg-[#1C1C1E] border-[#3A3A3C] text-[#E5E5E7]' : 'border-gray-200 bg-white text-gray-800'
  const selectCls = dark ? 'bg-[#1C1C1E] border-[#3A3A3C] text-[#E5E5E7]' : 'border-gray-200 bg-white text-gray-800'

  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [overrides, setOverrides] = useState<Override[]>([])
  const [trainers, setTrainers] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ group_name: '', trainer_name: '', days: [] as number[], time_start: '', time_end: '' })
  // Override modal
  const [overrideSlot, setOverrideSlot] = useState<ScheduleEntry | null>(null)
  const [overrideForm, setOverrideForm] = useState(emptyOverride)
  const [savingOverride, setSavingOverride] = useState(false)
  const [notifying, setNotifying] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const weekDates = getWeekDates()
    const monday = weekDates[1]
    const sunday = weekDates[7]

    const [{ data: sched }, { data: ov }, { data: tr }] = await Promise.all([
      supabase.from('schedule').select('*').order('day_of_week').order('time_start'),
      supabase.from('schedule_overrides').select('*')
        .gte('date', monday).lte('date', sunday)
        .order('date'),
      supabase.from('trainers').select('name').order('name'),
    ])
    setEntries(sched || [])
    setOverrides(ov || [])
    setTrainers((tr || []).map(t => t.name))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (form.days.length === 0) { alert('Выберите хотя бы один день'); return }
    setSaving(true)
    await supabase.from('schedule').insert(
      form.days.map(day => ({
        group_name: form.group_name,
        trainer_name: form.trainer_name || null,
        day_of_week: day,
        time_start: form.time_start || null,
        time_end: form.time_end || null,
      }))
    )
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
    load()
  }

  function startEdit(entry: ScheduleEntry) {
    setEditId(entry.id)
    setEditForm({
      group_name: entry.group_name,
      trainer_name: entry.trainer_name || '',
      days: [entry.day_of_week],
      time_start: entry.time_start || '',
      time_end: entry.time_end || '',
    })
  }

  function toggleEditDay(num: number) {
    setEditForm(prev => ({
      ...prev,
      days: prev.days.includes(num) ? prev.days.filter(d => d !== num) : [...prev.days, num]
    }))
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (editForm.days.length === 0) { alert('Выберите хотя бы один день'); return }
    await supabase.from('schedule').delete().eq('id', editId!)
    await supabase.from('schedule').insert(
      editForm.days.map(day => ({
        group_name: editForm.group_name,
        trainer_name: editForm.trainer_name || null,
        day_of_week: day,
        time_start: editForm.time_start || null,
        time_end: editForm.time_end || null,
      }))
    )
    setEditId(null)
    load()
  }

  function toggleDay(num: number) {
    setForm(prev => ({
      ...prev,
      days: prev.days.includes(num) ? prev.days.filter(d => d !== num) : [...prev.days, num]
    }))
  }

  async function remove(id: string) {
    if (!confirm('Удалить запись расписания?')) return
    await supabase.from('schedule').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  function openOverrideModal(entry: ScheduleEntry) {
    setOverrideSlot(entry)
    setOverrideForm({
      date: nearestDateForDay(entry.day_of_week),
      group_name: entry.group_name,
      trainer_name: entry.trainer_name || '',
      cancelled: false,
      note: '',
      time_start: entry.time_start || '',
    })
  }

  async function saveOverride(e: React.FormEvent) {
    e.preventDefault()
    setSavingOverride(true)
    await supabase.from('schedule_overrides').insert({
      date: overrideForm.date,
      group_name: overrideForm.group_name,
      trainer_name: overrideForm.cancelled ? null : (overrideForm.trainer_name || null),
      time_start: overrideForm.time_start || null,
      cancelled: overrideForm.cancelled,
      note: overrideForm.note || null,
    })
    setSavingOverride(false)
    setOverrideSlot(null)
    load()
  }

  async function deleteOverride(id: string) {
    if (!confirm('Удалить изменение?')) return
    await supabase.from('schedule_overrides').delete().eq('id', id)
    setOverrides(prev => prev.filter(o => o.id !== id))
  }

  async function notifyStudents(override: Override) {
    setNotifying(override.id)
    try {
      await fetch('/api/notify-schedule-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ override_id: override.id }),
      })
      load()
    } finally {
      setNotifying(null)
    }
  }

  const jsDay = new Date().getDay()
  const todayNum = jsDay === 0 ? 7 : jsDay
  const weekDates = getWeekDates()

  return (
    <main className="max-w-lg mx-auto p-4" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className={`text-xl font-bold leading-none hover:opacity-70 ${textSecondary}`}>←</Link>
        <h1 className={`text-xl font-bold ${textPrimary}`}>Расписание</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="ml-auto bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          + Добавить
        </button>
      </div>

      {/* Изменения на этой неделе */}
      {overrides.length > 0 && (
        <div className={`rounded-2xl p-4 mb-4 ${dark ? 'bg-amber-950/40 border border-amber-800/40' : 'bg-amber-50 border border-amber-100'}`}>
          <h2 className={`font-semibold text-sm mb-3 ${dark ? 'text-amber-300' : 'text-amber-800'}`}>⚡ Изменения на этой неделе</h2>
          <div className="space-y-2">
            {overrides.map(ov => {
              const d = new Date(ov.date + 'T00:00:00')
              const dayName = d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <div key={ov.id} className={`rounded-xl border p-3 flex items-start justify-between gap-2 ${dark ? 'bg-[#2C2C2E] border-[#3A3A3C]' : 'bg-white border-amber-100'}`}>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${textPrimary}`}>
                      {ov.cancelled ? '❌' : '🔄'} {ov.group_name}
                    </div>
                    <div className={`text-xs mt-0.5 ${textSecondary}`}>
                      {dayName}
                      {!ov.cancelled && ov.trainer_name && <span> · {ov.trainer_name}</span>}
                      {ov.cancelled && <span className="text-red-400"> · отменено</span>}
                      {ov.note && <span> · {ov.note}</span>}
                    </div>
                    {ov.notified_at && (
                      <div className="text-xs text-green-500 mt-0.5">
                        ✓ Уведомлено {new Date(ov.notified_at).toLocaleDateString('ru-RU')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!ov.notified_at && (
                      <button
                        onClick={() => notifyStudents(ov)}
                        disabled={notifying === ov.id}
                        className="text-xs bg-black text-white px-2 py-1 rounded-lg disabled:opacity-50"
                      >
                        {notifying === ov.id ? '...' : '📨'}
                      </button>
                    )}
                    <button onClick={() => deleteOverride(ov.id)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${dark ? 'border-red-800/50 bg-red-900/30 text-red-400 hover:bg-red-900/60' : 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'}`}>
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className={`rounded-2xl p-4 border mb-4 space-y-3 ${cardBase}`}>
          <div className={`text-sm font-medium ${textPrimary}`}>Новое занятие в расписании</div>
          <select required value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})}
            className={`w-full border rounded-xl px-3 py-2 text-sm outline-none ${selectCls}`}>
            <option value="">Группа *</option>
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <div>
            <div className={`text-xs mb-1.5 ${textSecondary}`}>Дни недели *</div>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map(d => (
                <button key={d.num} type="button" onClick={() => toggleDay(d.num)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                    ${form.days.includes(d.num)
                      ? 'bg-black text-white border-black'
                      : dark ? 'bg-[#3A3A3C] text-[#8E8E93] border-[#48484A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                  {d.short}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input type="time" value={form.time_start} onChange={e => setForm({...form, time_start: e.target.value})}
              className={`flex-1 border rounded-xl px-3 py-2 text-sm outline-none ${inputCls}`} />
            <input type="time" value={form.time_end} onChange={e => setForm({...form, time_end: e.target.value})}
              className={`flex-1 border rounded-xl px-3 py-2 text-sm outline-none ${inputCls}`} />
          </div>
          <select value={form.trainer_name} onChange={e => setForm({...form, trainer_name: e.target.value})}
            className={`w-full border rounded-xl px-3 py-2 text-sm outline-none ${selectCls}`}>
            <option value="">Тренер (необязательно)</option>
            {trainers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className={`px-4 border py-2 rounded-xl text-sm ${dark ? 'border-[#3A3A3C] text-[#8E8E93]' : 'border-gray-200 text-gray-500'}`}>
              Отмена
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <div className={`text-center py-16 ${textSecondary}`}>
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
            const dateStr = weekDates[day.num]
            return (
              <div key={day.num} className={`rounded-2xl border overflow-hidden ${isToday ? 'border-red-700' : dark ? 'border-[#3A3A3C]' : 'border-gray-100 shadow-sm'}`}>
                <div className={`px-4 py-2.5 flex items-center justify-between ${isToday ? 'bg-red-700' : dark ? 'bg-[#2C2C2E]' : 'bg-gray-50'}`}>
                  <div className={`font-semibold text-sm ${isToday ? 'text-white' : textPrimary}`}>
                    {day.full}
                    {isToday && <span className="text-xs font-normal opacity-70 ml-1">— сегодня</span>}
                    {dateStr && <span className={`text-xs font-normal ml-2 ${isToday ? 'opacity-70' : textSecondary}`}>
                      {new Date(dateStr + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </span>}
                  </div>
                  <div className={`text-xs ${isToday ? 'text-red-200' : textSecondary}`}>
                    {dayEntries.length} {dayEntries.length === 1 ? 'группа' : 'группы'}
                  </div>
                </div>
                <div className={`p-3 space-y-2 ${dark ? 'bg-[#1C1C1E]' : 'bg-white'}`}>
                  {dayEntries.map(entry => {
                    const colors = dark
                      ? (GROUP_COLORS_DARK[entry.group_name] || GROUP_COLORS_FALLBACK_DARK)
                      : (GROUP_COLORS_LIGHT[entry.group_name] || GROUP_COLORS_FALLBACK_LIGHT)
                    const hasOverride = overrides.some(o => o.group_name === entry.group_name && o.date === dateStr)

                    if (editId === entry.id) return (
                      <form key={entry.id} onSubmit={saveEdit} className={`p-3 rounded-xl border space-y-2 ${cardBase}`}>
                        <select value={editForm.group_name} onChange={e => setEditForm({...editForm, group_name: e.target.value})}
                          className={`w-full border rounded-lg px-2 py-1.5 text-sm outline-none ${selectCls}`}>
                          {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <div>
                          <div className={`text-xs mb-1 ${textSecondary}`}>Дни недели</div>
                          <div className="flex gap-1 flex-wrap">
                            {DAYS.map(d => (
                              <button key={d.num} type="button" onClick={() => toggleEditDay(d.num)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors
                                  ${editForm.days.includes(d.num)
                                    ? 'bg-black text-white border-black'
                                    : dark ? 'bg-[#3A3A3C] text-[#8E8E93] border-[#48484A]' : 'bg-white text-gray-600 border-gray-200'}`}>
                                {d.short}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input type="time" value={editForm.time_start} onChange={e => setEditForm({...editForm, time_start: e.target.value})}
                            className={`flex-1 border rounded-lg px-2 py-1.5 text-sm outline-none ${inputCls}`} />
                          <input type="time" value={editForm.time_end} onChange={e => setEditForm({...editForm, time_end: e.target.value})}
                            className={`flex-1 border rounded-lg px-2 py-1.5 text-sm outline-none ${inputCls}`} />
                        </div>
                        <select value={editForm.trainer_name} onChange={e => setEditForm({...editForm, trainer_name: e.target.value})}
                          className={`w-full border rounded-lg px-2 py-1.5 text-sm outline-none ${selectCls}`}>
                          <option value="">Тренер (необязательно)</option>
                          {trainers.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <button type="submit" className="flex-1 bg-black text-white py-1.5 rounded-lg text-sm font-medium">Сохранить</button>
                          <button type="button" onClick={() => setEditId(null)}
                            className={`px-3 border py-1.5 rounded-lg text-sm ${dark ? 'border-[#3A3A3C] text-[#8E8E93]' : 'border-gray-200 text-gray-500'}`}>
                            Отмена
                          </button>
                        </div>
                      </form>
                    )

                    return (
                      <div key={entry.id} className={`flex items-center justify-between p-3 rounded-xl border ${colors.card} ${hasOverride ? 'opacity-60' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-sm ${colors.label}`}>{entry.group_name}</div>
                          <div className={`text-xs mt-0.5 flex items-center gap-2 ${colors.sub}`}>
                            {entry.time_start && entry.time_end && (
                              <span>🕐 {entry.time_start.slice(0,5)}–{entry.time_end.slice(0,5)}</span>
                            )}
                            {entry.trainer_name && (
                              <span>👤 {entry.trainer_name}</span>
                            )}
                            {hasOverride && <span className="text-amber-500 font-medium">⚡ изменено</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3 shrink-0">
                          <button
                            onClick={() => openOverrideModal(entry)}
                            className="text-xs text-amber-600 border border-amber-400/60 bg-amber-400/20 px-2 py-1 rounded-lg hover:bg-amber-400/30 font-medium transition-colors"
                            title="Изменить на этой неделе"
                          >
                            ⚡
                          </button>
                          <button
                            onClick={() => startEdit(entry)}
                            className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${dark ? 'border-[#48484A] bg-[#3A3A3C] text-[#8E8E93] hover:bg-[#48484A]' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}
                            title="Редактировать"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => remove(entry.id)}
                            className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${dark ? 'border-red-800/50 bg-red-900/30 text-red-400 hover:bg-red-900/60' : 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'}`}
                            title="Удалить"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Override Modal */}
      {overrideSlot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <form onSubmit={saveOverride} className={`rounded-2xl p-5 w-full max-w-sm shadow-xl space-y-3 ${dark ? 'bg-[#2C2C2E]' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className={`font-semibold ${textPrimary}`}>Изменить на неделе</div>
              <button type="button" onClick={() => setOverrideSlot(null)} className={`text-lg ${textSecondary} hover:opacity-70`}>✕</button>
            </div>
            <div className={`text-sm ${textSecondary}`}>{overrideSlot.group_name} · {DAYS.find(d => d.num === overrideSlot.day_of_week)?.full}</div>

            <div>
              <label className={`text-xs mb-1 block ${textSecondary}`}>Дата</label>
              <input type="date" required value={overrideForm.date}
                onChange={e => setOverrideForm({...overrideForm, date: e.target.value})}
                className={`w-full border rounded-xl px-3 py-2 text-sm outline-none ${inputCls}`} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={overrideForm.cancelled}
                onChange={e => setOverrideForm({...overrideForm, cancelled: e.target.checked})}
                className="w-4 h-4 rounded" />
              <span className="text-sm text-red-500 font-medium">❌ Тренировка отменена</span>
            </label>

            {!overrideForm.cancelled && (
              <div>
                <label className={`text-xs mb-1 block ${textSecondary}`}>Тренер (если замена)</label>
                <select value={overrideForm.trainer_name}
                  onChange={e => setOverrideForm({...overrideForm, trainer_name: e.target.value})}
                  className={`w-full border rounded-xl px-3 py-2 text-sm outline-none ${selectCls}`}>
                  <option value="">Без изменений</option>
                  {trainers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={`text-xs mb-1 block ${textSecondary}`}>Комментарий (причина)</label>
              <input type="text" value={overrideForm.note}
                onChange={e => setOverrideForm({...overrideForm, note: e.target.value})}
                placeholder="Например: болезнь тренера"
                className={`w-full border rounded-xl px-3 py-2 text-sm outline-none ${inputCls}`} />
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={savingOverride}
                className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {savingOverride ? 'Сохранение...' : 'Сохранить изменение'}
              </button>
              <button type="button" onClick={() => setOverrideSlot(null)}
                className={`px-4 border py-2.5 rounded-xl text-sm ${dark ? 'border-[#3A3A3C] text-[#8E8E93]' : 'border-gray-200 text-gray-500'}`}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
