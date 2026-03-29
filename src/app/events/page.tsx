'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Event = {
  id: string
  name: string
  date: string
  time_start: string | null
  time_end: string | null
  price: number | null
  description: string | null
  bonus_type: string | null
  group_restriction: string | null
  trainer_name: string | null
  trainer_name_extra: string | null
  participant_count?: number
  paid_count?: number
}

const BONUS_TYPES = ['тренировка с оружием', 'мастер-класс', 'инд.тренировка']
const GROUPS = ['Дети 4-9', 'Подростки (нач)', 'Подростки (оп)', 'Цигун', 'Индивидуальные']

const BONUS_COLORS: Record<string, string> = {
  'тренировка с оружием': 'bg-orange-100 text-orange-700',
  'мастер-класс':         'bg-purple-100 text-purple-700',
  'инд.тренировка':       'bg-blue-100 text-blue-700',
}

export default function EventsPage() {
  const { role, permissions } = useAuth()
  const canEdit = role !== 'trainer' || permissions.includes('events.edit')
  const [events, setEvents] = useState<Event[]>([])
  const [trainers, setTrainers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', date: '', time_start: '', time_end: '', price: '', description: '', bonus_type: '', group_restriction: '', trainer_name: '', trainer_name_extra: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data }, { data: tr }] = await Promise.all([
      supabase.from('events').select('*, event_participants(id, paid)').order('date', { ascending: false }),
      supabase.from('trainers').select('name').order('name'),
    ])
    setTrainers((tr || []).map(t => t.name))

    const enriched = ((data as any[]) || []).map((e: any) => ({
      ...e,
      participant_count: e.event_participants?.length || 0,
      paid_count: e.event_participants?.filter((p: any) => p.paid).length || 0,
    }))
    setEvents(enriched)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('events').insert({
      name: form.name,
      date: form.date,
      time_start: form.time_start || null,
      time_end: form.time_end || null,
      price: form.price ? parseFloat(form.price) : null,
      description: form.description || null,
      bonus_type: form.bonus_type || null,
      group_restriction: form.group_restriction || null,
      trainer_name: form.trainer_name || null,
      trainer_name_extra: form.trainer_name_extra || null,
    })
    setForm({ name: '', date: '', time_start: '', time_end: '', price: '', description: '', bonus_type: '', group_restriction: '', trainer_name: '', trainer_name_extra: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function deleteEvent(id: string) {
    if (!confirm('Удалить мероприятие?')) return
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = events.filter(e => e.date >= today)
  const past = events.filter(e => e.date < today)

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Мероприятия</h1>
        {canEdit && (
          <button onClick={() => setShowForm(!showForm)}
            className="ml-auto bg-black text-white px-4 py-2 rounded-xl text-sm font-medium">
            + Создать
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <form onSubmit={addEvent} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 space-y-3">
          <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            placeholder="Название *" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <input required value={form.date} onChange={e => setForm({...form, date: e.target.value})}
            type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Начало</label>
              <input value={form.time_start} onChange={e => setForm({...form, time_start: e.target.value})}
                type="time" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Конец</label>
              <input value={form.time_end} onChange={e => setForm({...form, time_end: e.target.value})}
                type="time" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
          </div>
          <select value={form.bonus_type} onChange={e => setForm({...form, bonus_type: e.target.value, price: e.target.value === 'тренировка с оружием' ? '' : form.price})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            <option value="">Тип бонуса (если применяется)</option>
            {BONUS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {form.bonus_type !== 'тренировка с оружием' && (
            <input value={form.price} onChange={e => setForm({...form, price: e.target.value})}
              placeholder="Стоимость (₽)" type="number"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          )}
          <select value={form.group_restriction} onChange={e => setForm({...form, group_restriction: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            <option value="">Все группы</option>
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={form.trainer_name} onChange={e => setForm({...form, trainer_name: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            <option value="">Ответственный тренер</option>
            {trainers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={form.trainer_name_extra} onChange={e => setForm({...form, trainer_name_extra: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            <option value="">Доп. тренер (необязательно)</option>
            {trainers.filter(t => t !== form.trainer_name).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            placeholder="Описание" rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
          <button type="submit" disabled={saving}
            className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Создать мероприятие'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : events.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Мероприятий пока нет</div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-500 mb-2">Предстоящие</div>
              <div className="space-y-2">
                {upcoming.map(e => <EventCard key={e.id} event={e} bonusColors={BONUS_COLORS} onDelete={deleteEvent} canEdit={canEdit} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-2">Прошедшие</div>
              <div className="space-y-2">
                {past.map(e => <EventCard key={e.id} event={e} bonusColors={BONUS_COLORS} onDelete={deleteEvent} canEdit={canEdit} />)}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  )
}

function EventCard({ event, bonusColors, onDelete, canEdit }: { event: Event; bonusColors: Record<string, string>; onDelete: (id: string) => void; canEdit: boolean }) {
  return (
    <Link href={`/events/${event.id}`}
      className="block bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium text-gray-800">{event.name}</div>
            {event.bonus_type && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bonusColors[event.bonus_type] || 'bg-gray-100 text-gray-600'}`}>
                {event.bonus_type}
              </span>
            )}
            {event.group_restriction && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{event.group_restriction}</span>
            )}
          </div>
          <div className="text-sm text-gray-400 mt-0.5">
            📅 {event.date}
            {event.time_start && <span className="ml-2">🕐 {event.time_start.slice(0, 5)}{event.time_end ? `–${event.time_end.slice(0, 5)}` : ''}</span>}
          </div>
          {(event.trainer_name || event.trainer_name_extra) && (
            <div className="text-xs text-gray-500 mt-0.5">
              {event.trainer_name && <span>👤 {event.trainer_name}</span>}
              {event.trainer_name_extra && <span className="ml-2 text-gray-400">+ {event.trainer_name_extra}</span>}
            </div>
          )}
          {event.description && <div className="text-sm text-gray-500 mt-1">{event.description}</div>}
        </div>
        <div className="text-right ml-3">
          {event.price && <div className="font-semibold text-gray-800">{event.price} ₽</div>}
          <div className="text-xs text-gray-400 mt-1">👥 {event.participant_count} чел.</div>
        </div>
      </div>
    </Link>
  )
}
