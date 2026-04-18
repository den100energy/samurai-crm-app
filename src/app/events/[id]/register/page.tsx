'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { StudentAutocomplete } from '@/components/StudentAutocomplete'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Event = {
  id: string
  name: string
  date: string
  time_start: string | null
  time_end: string | null
  price: number | null
  description: string | null
  bonus_type: string | null
  trainer_name: string | null
  trainer_name_extra: string | null
  group_restriction: string[] | null
}

const BONUS_ICONS: Record<string, string> = {
  'тренировка с оружием': '⚔️',
  'мастер-класс': '🎓',
  'индивидуальное занятие': '👤',
}

const SCHOOL_STATUSES = [
  { value: 'start',    label: 'Ученик, группа Старт' },
  { value: 'combat',   label: 'Ученик, группа Комбат' },
  { value: 'neygyn',   label: 'Ученик группа Нейгун' },
  { value: 'parent',   label: 'Родитель/родственник/знакомый ученика' },
  { value: 'external', label: 'Не занимаюсь у вас' },
]

const SOURCES = [
  'Из учебных групп, чатов "Школы самурая"',
  'Из публичного канала "Школа самурая" в телеграм',
  'Из городских пабликов',
  'От друзей/знакомых/родственников',
  'Другое',
]

export default function EventRegisterPage() {
  const { id } = useParams<{ id: string }>()

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    participant_name: '',
    participant_phone: '',
    participant_telegram: '',
    school_status: '',
    source: '',
    questions: '',
  })
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [updatedFields, setUpdatedFields] = useState<string[]>([])

  async function load() {
    const { data } = await supabase
      .from('events')
      .select('id, name, date, time_start, time_end, price, description, bonus_type, trainer_name, trainer_name_extra, group_restriction')
      .eq('id', id)
      .single()
    setEvent(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function handleStudentSelect(s: { id: string; name: string; phone: string | null }) {
    setSelectedStudentId(s.id)
    setForm(prev => ({
      ...prev,
      participant_name: s.name,
      participant_phone: s.phone || prev.participant_phone,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!event) return
    setSubmitting(true)

    // Используем выбранного ученика или ищем по телефону / имени
    let matchedStudentId: string | null = selectedStudentId
    if (!matchedStudentId) {
      const { data: students } = await supabase
        .from('students').select('id, name, phone').eq('status', 'active')

      if (form.participant_phone) {
        const phone = form.participant_phone.replace(/\D/g, '')
        const match = (students || []).find(s => s.phone && s.phone.replace(/\D/g, '') === phone)
        if (match) matchedStudentId = match.id
      }

      if (!matchedStudentId && form.participant_name) {
        const normalizedName = form.participant_name.trim().toLowerCase()
        const nameMatches = (students || []).filter(s => s.name.trim().toLowerCase() === normalizedName)
        if (nameMatches.length === 1) matchedStudentId = nameMatches[0].id
      }
    }

    await supabase.from('event_participants').insert({
      event_id: id,
      student_id: matchedStudentId,
      participant_name: form.participant_name,
      participant_phone: form.participant_phone || null,
      participant_telegram: form.participant_telegram || null,
      school_status: form.school_status || null,
      source: form.source || null,
      questions: form.questions || null,
      is_external: !matchedStudentId,
      paid: false,
      attendance_type: 'regular',
    })

    // Обновить карточку ученика если данных не хватало
    if (matchedStudentId && form.participant_phone) {
      const res = await fetch('/api/students/update-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: matchedStudentId, phone: form.participant_phone }),
      }).catch(() => null)
      if (res?.ok) {
        const data = await res.json()
        if (data.updated?.length > 0) setUpdatedFields(data.updated)
      }
    }

    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `${BONUS_ICONS[event.bonus_type || ''] || '📅'} Новая запись на мероприятие!\n${event.name}\n📅 ${event.date}${event.time_start ? ` в ${event.time_start.slice(0, 5)}` : ''}\n👤 ${form.participant_name}\n📞 ${form.participant_phone || '—'}\n✈️ ${form.participant_telegram || '—'}\nСтатус: ${SCHOOL_STATUSES.find(s => s.value === form.school_status)?.label || '—'}`,
      }),
    }).catch(() => {})

    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-gray-500">Мероприятие не найдено</div>
      </div>
    )
  }

  const icon = BONUS_ICONS[event.bonus_type || ''] || '📅'
  const timeStr = event.time_start
    ? `${event.time_start.slice(0, 5)}${event.time_end ? ` — ${event.time_end.slice(0, 5)}` : ''}`
    : null

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-3xl p-6 shadow-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Заявка принята!</h2>
          <p className="text-gray-600 text-sm mb-4">
            Мы получили вашу заявку на участие. Свяжемся с вами в ближайшее время.
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Мероприятие</span>
              <span className="font-medium text-right max-w-[60%]">{event.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Дата</span>
              <span className="font-medium">
                {new Date(event.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                {timeStr && <span className="text-gray-400"> · {timeStr}</span>}
              </span>
            </div>
            {event.price != null && event.price > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Стоимость</span>
                <span className="font-bold text-gray-900">{event.price.toLocaleString('ru')} ₽</span>
              </div>
            )}
          </div>
          {updatedFields.length > 0 && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-700 text-left">
              ✅ Ваши данные обновлены в системе: <b>{updatedFields.join(', ')}</b>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4">
            По вопросам обращайтесь к тренеру.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto p-4 pb-20">

        {/* Header */}
        <div className="text-center py-6">
          <div className="text-4xl mb-3">{icon}</div>
          <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
          {event.bonus_type && (
            <div className="text-sm text-indigo-600 mt-1">{event.bonus_type}</div>
          )}
          <div className="text-gray-500 text-sm mt-2">
            📅 {new Date(event.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            {timeStr && <span className="ml-2">🕐 {timeStr}</span>}
          </div>
          {event.trainer_name && (
            <div className="text-gray-500 text-sm mt-1">
              👤 {event.trainer_name}{event.trainer_name_extra ? `, ${event.trainer_name_extra}` : ''}
            </div>
          )}
          {event.price != null && event.price > 0 && (
            <div className="mt-2 inline-block bg-indigo-50 text-indigo-700 text-sm font-semibold px-4 py-1.5 rounded-full">
              {event.price.toLocaleString('ru')} ₽
            </div>
          )}
          {event.price === 0 && (
            <div className="mt-2 inline-block bg-green-50 text-green-700 text-sm font-semibold px-4 py-1.5 rounded-full">
              Бесплатно
            </div>
          )}
          {event.description && (
            <p className="text-gray-600 text-sm mt-3 leading-relaxed">{event.description}</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-base font-bold text-gray-800">Ваши данные</h2>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Фамилия и Имя *</label>
            <StudentAutocomplete
              required
              value={form.participant_name}
              onChange={v => { setForm({ ...form, participant_name: v }); setSelectedStudentId(null) }}
              onSelect={handleStudentSelect}
              placeholder="Иванов Иван"
              inputClassName="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 bg-white"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Телефон *</label>
            <input required value={form.participant_phone}
              onChange={e => setForm({ ...form, participant_phone: e.target.value })}
              placeholder="+7 928 555-55-55" type="tel"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 bg-white" />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Ник в Telegram *</label>
            <input required value={form.participant_telegram}
              onChange={e => setForm({ ...form, participant_telegram: e.target.value })}
              placeholder="@username"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 bg-white" />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Ваш статус в "Школе самурая" *</label>
            <div className="space-y-2">
              {SCHOOL_STATUSES.map(s => (
                <label key={s.value}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.school_status === s.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <input type="radio" name="school_status" value={s.value} required
                    checked={form.school_status === s.value}
                    onChange={() => setForm({ ...form, school_status: s.value })}
                    className="accent-indigo-600" />
                  <span className="text-sm text-gray-700">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Откуда узнали о мероприятии? *</label>
            <div className="space-y-2">
              {SOURCES.map(s => (
                <label key={s}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.source === s ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <input type="radio" name="source" value={s} required
                    checked={form.source === s}
                    onChange={() => setForm({ ...form, source: s })}
                    className="accent-indigo-600" />
                  <span className="text-sm text-gray-700">{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Есть вопросы?</label>
            <textarea value={form.questions}
              onChange={e => setForm({ ...form, questions: e.target.value })}
              placeholder="Напишите, если есть вопросы" rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 bg-white resize-none" />
          </div>

          <button type="submit" disabled={submitting}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-base font-semibold disabled:opacity-50 mt-2">
            {submitting ? 'Отправка...' : 'Записаться'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            После отправки заявки мы свяжемся с вами в Telegram для подтверждения.
          </p>
        </form>
      </div>
    </div>
  )
}
