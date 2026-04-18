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
  group_restriction: string[] | null
  trainer_name: string | null
  trainer_name_extra: string | null
  participant_count?: number
  paid_count?: number
}

type Seminar = {
  id: string
  title: string
  discipline: string | null
  location: string | null
  starts_at: string
  ends_at: string
  status: string
  reg_count?: number
}

const BONUS_TYPES = ['тренировка с оружием', 'мастер-класс', 'инд.тренировка']
const GROUPS = ['Старт', 'Основная (нач.)', 'Основная (оп.)', 'Цигун', 'Индивидуальные']
const DISCIPLINES = ['aikido', 'wushu', 'both', 'qigong']
const DISCIPLINE_LABELS: Record<string, string> = { aikido: 'Айкидо', wushu: 'Ушу', both: 'Айкидо + Ушу', qigong: 'Цигун' }

const BONUS_COLORS: Record<string, string> = {
  'тренировка с оружием': 'bg-orange-100 text-orange-700',
  'мастер-класс':         'bg-purple-100 text-purple-700',
  'инд.тренировка':       'bg-blue-100 text-blue-700',
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-500',
  open:      'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-500',
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', open: 'Приём заявок', completed: 'Завершён', cancelled: 'Отменён',
}

export default function EventsPage() {
  const { role, permissions } = useAuth()
  const canEdit = role !== 'trainer' || permissions.includes('events.edit')

  const [events, setEvents] = useState<Event[]>([])
  const [seminars, setSeminars] = useState<Seminar[]>([])
  const [trainers, setTrainers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // event form
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventForm, setEventForm] = useState({ name: '', date: '', time_start: '', time_end: '', price: '', description: '', bonus_type: '', group_restriction: [] as string[], trainer_name: '', trainer_name_extra: '' })

  // seminar form
  const [showSeminarForm, setShowSeminarForm] = useState(false)
  const [seminarForm, setSeminarForm] = useState({ title: '', discipline: '', location: '', starts_at: '', ends_at: '', registration_deadline: '', description: '', schedule_text: '' })

  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: evData }, { data: tr }, { data: semData }] = await Promise.all([
      supabase.from('events').select('*, event_participants(id, paid)').order('date', { ascending: false }),
      supabase.from('trainers').select('name').order('name'),
      supabase.from('seminar_events').select('id, title, discipline, location, starts_at, ends_at, status, seminar_registrations(id)').order('starts_at', { ascending: false }),
    ])
    setTrainers((tr || []).map(t => t.name))
    const enrichedEvents = ((evData as any[]) || []).map((e: any) => ({
      ...e,
      participant_count: e.event_participants?.length || 0,
      paid_count: e.event_participants?.filter((p: any) => p.paid).length || 0,
    }))
    setEvents(enrichedEvents)
    const enrichedSeminars = ((semData as any[]) || []).map((s: any) => ({
      ...s,
      reg_count: s.seminar_registrations?.length || 0,
    }))
    setSeminars(enrichedSeminars)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('events').insert({
      name: eventForm.name,
      date: eventForm.date,
      time_start: eventForm.time_start || null,
      time_end: eventForm.time_end || null,
      price: eventForm.price !== '' ? parseFloat(eventForm.price) : null,
      description: eventForm.description || null,
      bonus_type: eventForm.bonus_type || null,
      group_restriction: eventForm.group_restriction.length > 0 ? eventForm.group_restriction : null,
      trainer_name: eventForm.trainer_name || null,
      trainer_name_extra: eventForm.trainer_name_extra || null,
    })
    setEventForm({ name: '', date: '', time_start: '', time_end: '', price: '', description: '', bonus_type: '', group_restriction: [], trainer_name: '', trainer_name_extra: '' })
    setShowEventForm(false)
    setSaving(false)
    load()
  }

  async function addSeminar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('seminar_events').insert({
      title: seminarForm.title,
      discipline: seminarForm.discipline || null,
      location: seminarForm.location || null,
      starts_at: seminarForm.starts_at,
      ends_at: seminarForm.ends_at,
      registration_deadline: seminarForm.registration_deadline || null,
      description: seminarForm.description || null,
      schedule_text: seminarForm.schedule_text || null,
      status: 'draft',
    })
    setSeminarForm({ title: '', discipline: '', location: '', starts_at: '', ends_at: '', registration_deadline: '', description: '', schedule_text: '' })
    setShowSeminarForm(false)
    setSaving(false)
    load()
  }

  async function deleteEvent(id: string) {
    if (!confirm('Удалить мероприятие?')) return
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  async function deleteSeminar(id: string) {
    if (!confirm('Удалить семинар? Все заявки будут удалены.')) return
    await supabase.from('seminar_events').delete().eq('id', id)
    setSeminars(prev => prev.filter(s => s.id !== id))
  }

  const today = new Date().toISOString().split('T')[0]
  const upcomingEvents = events.filter(e => e.date >= today)
  const pastEvents = events.filter(e => e.date < today)
  const upcomingSeminars = seminars.filter(s => s.ends_at >= today)
  const pastSeminars = seminars.filter(s => s.ends_at < today)

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Мероприятия</h1>
        {canEdit && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setShowSeminarForm(!showSeminarForm); setShowEventForm(false) }}
              className="bg-indigo-600 text-white px-3 py-2 rounded-xl text-sm font-medium">
              + Семинар
            </button>
            <button onClick={() => { setShowEventForm(!showEventForm); setShowSeminarForm(false) }}
              className="bg-black text-white px-3 py-2 rounded-xl text-sm font-medium">
              + Событие
            </button>
          </div>
        )}
      </div>

      {/* Seminar creation form */}
      {showSeminarForm && canEdit && (
        <form onSubmit={addSeminar} className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm mb-4 space-y-3">
          <div className="text-sm font-semibold text-indigo-700 mb-1">🥋 Новый семинар</div>
          <input required value={seminarForm.title} onChange={e => setSeminarForm({ ...seminarForm, title: e.target.value })}
            placeholder="Название *" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <select value={seminarForm.discipline} onChange={e => setSeminarForm({ ...seminarForm, discipline: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            <option value="">Дисциплина (необязательно)</option>
            {DISCIPLINES.map(d => <option key={d} value={d}>{DISCIPLINE_LABELS[d]}</option>)}
          </select>
          <input value={seminarForm.location} onChange={e => setSeminarForm({ ...seminarForm, location: e.target.value })}
            placeholder="Место проведения" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Начало *</label>
              <input required type="date" value={seminarForm.starts_at} onChange={e => setSeminarForm({ ...seminarForm, starts_at: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Конец *</label>
              <input required type="date" value={seminarForm.ends_at} onChange={e => setSeminarForm({ ...seminarForm, ends_at: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Приём заявок до</label>
            <input type="date" value={seminarForm.registration_deadline} onChange={e => setSeminarForm({ ...seminarForm, registration_deadline: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          </div>
          <textarea value={seminarForm.description} onChange={e => setSeminarForm({ ...seminarForm, description: e.target.value })}
            placeholder="Описание (покажется участникам)" rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
          <p className="text-xs text-gray-400">💡 Тарифы и цены добавляются после создания семинара</p>
          <button type="submit" disabled={saving}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Создать семинар'}
          </button>
        </form>
      )}

      {/* Event creation form */}
      {showEventForm && canEdit && (
        <form onSubmit={addEvent} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 space-y-3">
          <div className="text-sm font-semibold text-gray-700 mb-1">📅 Новое мероприятие</div>
          <input required value={eventForm.name} onChange={e => setEventForm({ ...eventForm, name: e.target.value })}
            placeholder="Название *" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <input required value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })}
            type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Начало</label>
              <input value={eventForm.time_start} onChange={e => setEventForm({ ...eventForm, time_start: e.target.value })}
                type="time" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Конец</label>
              <input value={eventForm.time_end} onChange={e => setEventForm({ ...eventForm, time_end: e.target.value })}
                type="time" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
          </div>
          <select value={eventForm.bonus_type} onChange={e => setEventForm({ ...eventForm, bonus_type: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            <option value="">Тип бонуса (если применяется)</option>
            {BONUS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {eventForm.bonus_type !== 'тренировка с оружием' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setEventForm({ ...eventForm, price: '0' })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${eventForm.price === '0' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-500'}`}>
                  Бесплатное
                </button>
                <button type="button"
                  onClick={() => setEventForm({ ...eventForm, price: eventForm.price === '0' ? '' : eventForm.price })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${eventForm.price !== '0' ? 'bg-black text-white border-black' : 'bg-white border-gray-200 text-gray-500'}`}>
                  Платное
                </button>
              </div>
              {eventForm.price !== '0' && (
                <input value={eventForm.price} onChange={e => setEventForm({ ...eventForm, price: e.target.value })}
                  placeholder="Стоимость (₽)" type="number" min="1"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
              )}
            </div>
          )}
          <div className="border border-gray-200 rounded-xl px-3 py-2.5">
            <div className="text-xs text-gray-400 mb-2">Группы (пусто = все)</div>
            <div className="flex flex-wrap gap-2">
              {GROUPS.map(g => (
                <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={eventForm.group_restriction.includes(g)}
                    onChange={e => setEventForm({ ...eventForm, group_restriction: e.target.checked ? [...eventForm.group_restriction, g] : eventForm.group_restriction.filter(x => x !== g) })}
                    className="rounded" />
                  <span className="text-sm text-gray-700">{g}</span>
                </label>
              ))}
            </div>
          </div>
          <select value={eventForm.trainer_name} onChange={e => setEventForm({ ...eventForm, trainer_name: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            <option value="">Ответственный тренер</option>
            {trainers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={eventForm.trainer_name_extra} onChange={e => setEventForm({ ...eventForm, trainer_name_extra: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            <option value="">Доп. тренер (необязательно)</option>
            {trainers.filter(t => t !== eventForm.trainer_name).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
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
      ) : (
        <>
          {/* Seminars section */}
          {(upcomingSeminars.length > 0 || pastSeminars.length > 0) && (
            <div className="mb-6">
              <div className="text-base font-bold text-gray-700 mb-3">🥋 Семинары</div>
              {upcomingSeminars.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Предстоящие</div>
                  <div className="space-y-2">
                    {upcomingSeminars.map(s => (
                      <SeminarCard key={s.id} seminar={s} onDelete={deleteSeminar} canEdit={canEdit} />
                    ))}
                  </div>
                </div>
              )}
              {pastSeminars.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Прошедшие</div>
                  <div className="space-y-2">
                    {pastSeminars.map(s => (
                      <SeminarCard key={s.id} seminar={s} onDelete={deleteSeminar} canEdit={canEdit} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Events section */}
          {(upcomingEvents.length > 0 || pastEvents.length > 0) && (
            <div>
              <div className="text-base font-bold text-gray-700 mb-3">📅 Мероприятия</div>
              {upcomingEvents.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Предстоящие</div>
                  <div className="space-y-2">
                    {upcomingEvents.map(e => <EventCard key={e.id} event={e} bonusColors={BONUS_COLORS} onDelete={deleteEvent} canEdit={canEdit} />)}
                  </div>
                </div>
              )}
              {pastEvents.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Прошедшие</div>
                  <div className="space-y-2">
                    {pastEvents.map(e => <EventCard key={e.id} event={e} bonusColors={BONUS_COLORS} onDelete={deleteEvent} canEdit={canEdit} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {seminars.length === 0 && events.length === 0 && (
            <div className="text-center text-gray-400 py-12">Мероприятий пока нет</div>
          )}
        </>
      )}
    </main>
  )
}

function SeminarCard({ seminar, onDelete, canEdit }: { seminar: Seminar; onDelete: (id: string) => void; canEdit: boolean }) {
  const DISCIPLINE_LABELS: Record<string, string> = { aikido: 'Айкидо', wushu: 'Ушу', both: 'Айкидо + Ушу', qigong: 'Цигун' }
  const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-500', open: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-500',
  }
  const STATUS_LABELS: Record<string, string> = { draft: 'Черновик', open: 'Приём заявок', completed: 'Завершён', cancelled: 'Отменён' }
  return (
    <Link href={`/seminars/${seminar.id}`}
      className="block bg-white rounded-xl p-4 border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium text-gray-800">{seminar.title}</div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[seminar.status] || 'bg-gray-100 text-gray-500'}`}>
              {STATUS_LABELS[seminar.status] || seminar.status}
            </span>
            {seminar.discipline && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                {DISCIPLINE_LABELS[seminar.discipline] || seminar.discipline}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400 mt-0.5">
            📅 {seminar.starts_at}{seminar.ends_at !== seminar.starts_at ? ` — ${seminar.ends_at}` : ''}
          </div>
          {seminar.location && <div className="text-xs text-gray-400 mt-0.5">📍 {seminar.location}</div>}
        </div>
        <div className="text-right ml-3 flex flex-col items-end gap-1">
          <div className="text-xs text-gray-400">👥 {seminar.reg_count} заявок</div>
          {canEdit && (
            <button onClick={e => { e.preventDefault(); onDelete(seminar.id) }}
              className="text-gray-300 hover:text-red-400 text-lg leading-none mt-1">×</button>
          )}
        </div>
      </div>
    </Link>
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
            {event.group_restriction && event.group_restriction.map(g => (
              <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{g}</span>
            ))}
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
        <div className="text-right ml-3 flex flex-col items-end gap-1">
          {event.price && <div className="font-semibold text-gray-800">{event.price} ₽</div>}
          <div className="text-xs text-gray-400">👥 {event.participant_count} чел.</div>
          {canEdit && (
            <button onClick={e => { e.preventDefault(); onDelete(event.id) }}
              className="text-gray-300 hover:text-red-400 text-lg leading-none mt-1">×</button>
          )}
        </div>
      </div>
    </Link>
  )
}
