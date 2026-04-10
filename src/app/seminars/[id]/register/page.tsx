'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Seminar = {
  id: string
  title: string
  discipline: string | null
  location: string | null
  description: string | null
  starts_at: string
  ends_at: string
  registration_deadline: string | null
  status: string
}

type Tariff = {
  id: string
  name: string
  description: string | null
  base_price: number | null
  increase_pct: number
  increase_every_days: number
  increase_starts_at: string | null
  min_deposit_pct: number
  max_participants: number | null
  sort_order: number
}

function currentPrice(tariff: Tariff, today = new Date()): number {
  if (!tariff.base_price) return 0
  if (!tariff.increase_starts_at || tariff.increase_pct === 0) return tariff.base_price
  const start = new Date(tariff.increase_starts_at)
  const daysElapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000))
  const periods = Math.floor(daysElapsed / (tariff.increase_every_days || 7))
  return Math.round(tariff.base_price * Math.pow(1 + tariff.increase_pct / 100, periods))
}

function nextPriceChange(tariff: Tariff, today = new Date()): { date: string; newPrice: number } | null {
  if (!tariff.increase_starts_at || tariff.increase_pct === 0) return null
  const start = new Date(tariff.increase_starts_at)
  const price = currentPrice(tariff)
  const newPrice = Math.round(price * (1 + tariff.increase_pct / 100))
  if (today < start) return { date: tariff.increase_starts_at, newPrice }
  const daysElapsed = Math.floor((today.getTime() - start.getTime()) / 86400000)
  const periods = Math.floor(daysElapsed / (tariff.increase_every_days || 7))
  const next = new Date(start)
  next.setDate(next.getDate() + (periods + 1) * (tariff.increase_every_days || 7))
  return { date: next.toISOString().split('T')[0], newPrice }
}

const DISCIPLINE_LABELS: Record<string, string> = {
  aikido: 'Айкидо', wushu: 'Ушу', both: 'Айкидо + Ушу', qigong: 'Цигун',
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

export default function SeminarRegisterPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref') // student id as referral

  const [seminar, setSeminar] = useState<Seminar | null>(null)
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null)
  const [regCount, setRegCount] = useState<Record<string, number>>({})

  const [form, setForm] = useState({
    participant_name: '',
    participant_phone: '',
    participant_telegram: '',
    school_status: '',
    tariff_id: '',
    referral_name: '',   // привёл друга (имя + тел)
    questions: '',
    source: '',
    attending_attestation: '',
  })

  async function load() {
    const [{ data: sem }, { data: tar }, { data: counts }] = await Promise.all([
      supabase.from('seminar_events').select('id, title, discipline, location, description, starts_at, ends_at, registration_deadline, status').eq('id', id).single(),
      supabase.from('seminar_tariffs').select('*').eq('seminar_id', id).order('sort_order'),
      supabase.from('seminar_registrations').select('tariff_id').eq('seminar_id', id).not('status', 'eq', 'cancelled'),
    ])
    setSeminar(sem)
    setTariffs(tar || [])
    // Count per tariff
    const map: Record<string, number> = {}
    for (const r of counts || []) {
      if (r.tariff_id) map[r.tariff_id] = (map[r.tariff_id] || 0) + 1
    }
    setRegCount(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function selectTariff(t: Tariff) {
    setSelectedTariff(t)
    setForm(f => ({ ...f, tariff_id: t.id }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!seminar || !form.tariff_id) return
    setSubmitting(true)

    const tariff = tariffs.find(t => t.id === form.tariff_id)
    const price = tariff ? currentPrice(tariff) : null

    // Check if external + referral discount
    const isExternal = form.school_status === 'external'
    const referralDiscount = isExternal && refCode ? 10 : 0
    const finalPrice = price && referralDiscount > 0 ? Math.round(price * (1 - referralDiscount / 100)) : price

    await supabase.from('seminar_registrations').insert({
      seminar_id: id,
      tariff_id: form.tariff_id,
      is_external: isExternal,
      participant_name: form.participant_name,
      participant_phone: form.participant_phone || null,
      participant_telegram: form.participant_telegram || null,
      school_status: form.school_status || null,
      questions: form.questions || null,
      source: form.source || null,
      attending_attestation: form.attending_attestation === 'yes' ? true : form.attending_attestation === 'no' ? false : null,
      referred_by_student_id: isExternal && refCode ? refCode : null,
      referral_discount_pct: referralDiscount,
      locked_price: finalPrice,
      status: 'pending',
    })

    // Notify owner
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `🥋 Новая заявка на семинар!\n${seminar.title}\nУчастник: ${form.participant_name}\nТелефон: ${form.participant_phone || '—'}\nTelegram: ${form.participant_telegram || '—'}\nТариф: ${tariff?.name || '—'} — ${finalPrice?.toLocaleString('ru') || '?'} ₽${referralDiscount > 0 ? ` (скидка ${referralDiscount}%)` : ''}\nСтатус: ${SCHOOL_STATUSES.find(s => s.value === form.school_status)?.label || '—'}`,
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

  if (!seminar) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-gray-500">Семинар не найден</div>
      </div>
    )
  }

  if (seminar.status !== 'open') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🥋</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">{seminar.title}</h1>
          <p className="text-gray-500">
            {seminar.status === 'completed' ? 'Семинар уже завершён.' : 'Приём заявок пока закрыт.'}
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    const tariff = tariffs.find(t => t.id === form.tariff_id)
    const price = tariff ? currentPrice(tariff) : 0
    const isExternal = form.school_status === 'external'
    const discount = isExternal && refCode ? 10 : 0
    const finalPrice = discount > 0 ? Math.round(price * (1 - discount / 100)) : price
    const deposit = tariff ? Math.ceil(finalPrice * (tariff.min_deposit_pct || 20) / 100) : 0

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-3xl p-6 shadow-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Заявка принята!</h2>
          <p className="text-gray-600 text-sm mb-4">
            Мы получили вашу заявку на участие в семинаре. После получения предоплаты мы внесём вас в список участников.
          </p>
          {tariff && (
            <div className="bg-gray-50 rounded-2xl p-4 text-left mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Тариф</span>
                <span className="font-medium">{tariff.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Стоимость</span>
                <span className="font-bold text-gray-900">{finalPrice.toLocaleString('ru')} ₽{discount > 0 ? ` (−${discount}%)` : ''}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Предоплата для фиксации цены</span>
                <span className="font-medium text-blue-700">от {deposit.toLocaleString('ru')} ₽</span>
              </div>
            </div>
          )}
          {tariff?.description && (
            <div className="bg-indigo-50 rounded-2xl p-4 text-left mb-4">
              <div className="text-xs font-medium text-indigo-600 mb-1">Расписание вашего тарифа</div>
              <div className="text-sm text-gray-700 whitespace-pre-line">{tariff.description}</div>
            </div>
          )}
          <p className="text-xs text-gray-400">
            Реквизиты для оплаты и подробности пришлём в Telegram. По вопросам обращайтесь к тренеру.
          </p>
        </div>
      </div>
    )
  }

  const today = new Date()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto p-4 pb-20">
        {/* Header */}
        <div className="text-center py-6">
          <div className="text-4xl mb-3">🥋</div>
          <h1 className="text-2xl font-bold text-gray-900">{seminar.title}</h1>
          {seminar.discipline && (
            <div className="text-sm text-indigo-600 mt-1">{DISCIPLINE_LABELS[seminar.discipline] || seminar.discipline}</div>
          )}
          <div className="text-gray-500 text-sm mt-2">
            📅 {seminar.starts_at}{seminar.ends_at !== seminar.starts_at ? ` — ${seminar.ends_at}` : ''}
            {seminar.location && <span className="ml-2">📍 {seminar.location}</span>}
          </div>
          {seminar.description && (
            <p className="text-gray-600 text-sm mt-3 leading-relaxed">{seminar.description}</p>
          )}
          {seminar.registration_deadline && (
            <div className="mt-2 text-xs text-orange-600 font-medium">
              ⏰ Приём заявок до {seminar.registration_deadline}
            </div>
          )}
        </div>

        {/* Tariff selection */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-gray-800 mb-3">Выберите тариф *</h2>
          <div className="space-y-3">
            {tariffs.map(t => {
              const price = currentPrice(t)
              const change = nextPriceChange(t, today)
              const deposit = Math.ceil(price * (t.min_deposit_pct || 20) / 100)
              const count = regCount[t.id] || 0
              const full = t.max_participants ? count >= t.max_participants : false
              const selected = selectedTariff?.id === t.id
              return (
                <button key={t.id} type="button" onClick={() => !full && selectTariff(t)} disabled={full}
                  className={`w-full text-left rounded-2xl p-4 border-2 transition-all ${full ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' : selected ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-200 bg-white hover:border-indigo-300'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-gray-500 mt-1 whitespace-pre-line leading-relaxed">{t.description}</div>
                      )}
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <div className="text-lg font-bold text-gray-900">{price.toLocaleString('ru')} ₽</div>
                      {t.base_price !== price && (
                        <div className="text-xs text-gray-400 line-through">{t.base_price?.toLocaleString('ru')} ₽</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs text-gray-500">
                      Предоплата для фиксации цены: <span className="font-medium text-blue-600">{deposit.toLocaleString('ru')} ₽</span>
                    </div>
                    {full && <span className="text-xs text-red-500 font-medium">Мест нет</span>}
                    {t.max_participants && !full && (
                      <span className="text-xs text-gray-400">{count}/{t.max_participants} мест</span>
                    )}
                  </div>
                  {change && change.date > today.toISOString().split('T')[0] && (
                    <div className="mt-1.5 text-xs text-orange-600 font-medium">
                      ⚡ С {change.date} цена вырастет до {change.newPrice.toLocaleString('ru')} ₽
                    </div>
                  )}
                  {selected && (
                    <div className="mt-2 text-xs text-indigo-600 font-medium">✓ Выбран</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-base font-bold text-gray-800">Ваши данные</h2>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Фамилия и Имя *</label>
            <input required value={form.participant_name} onChange={e => setForm({ ...form, participant_name: e.target.value })}
              placeholder="Иванов Иван"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 bg-white" />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Телефон *</label>
            <input required value={form.participant_phone} onChange={e => setForm({ ...form, participant_phone: e.target.value })}
              placeholder="+7 928 555-55-55" type="tel"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 bg-white" />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Ник в Telegram *</label>
            <input required value={form.participant_telegram} onChange={e => setForm({ ...form, participant_telegram: e.target.value })}
              placeholder="@username"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 bg-white" />
            <p className="text-xs text-gray-400 mt-1">Нужен для получения своевременной информации о семинаре, расписания и получения подарков</p>
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Ваш статус в "Школе самурая" *</label>
            <div className="space-y-2">
              {SCHOOL_STATUSES.map(s => (
                <label key={s.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.school_status === s.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <input type="radio" name="school_status" value={s.value} required
                    checked={form.school_status === s.value}
                    onChange={() => setForm({ ...form, school_status: s.value })}
                    className="accent-indigo-600" />
                  <span className="text-sm text-gray-700">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Referral discount banner */}
          {refCode && form.school_status === 'external' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
              🎁 Вы пришли по приглашению — вам автоматически применяется скидка <strong>10%</strong>!
            </div>
          )}

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Придёшь с другом/родственником/знакомым?</label>
            <input value={form.referral_name} onChange={e => setForm({ ...form, referral_name: e.target.value })}
              placeholder="Если да — напиши его Имя и телефон, чтобы он получил скидку 10%"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 bg-white" />
            <p className="text-xs text-gray-400 mt-1">А от нас тебе тоже скидка 10%</p>
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Есть ли вопросы?</label>
            <textarea value={form.questions} onChange={e => setForm({ ...form, questions: e.target.value })}
              placeholder="Напишите, что хотели бы спросить" rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 bg-white resize-none" />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Откуда узнали о семинаре? *</label>
            <div className="space-y-2">
              {SOURCES.map(s => (
                <label key={s} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.source === s ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
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
            <label className="text-sm text-gray-600 mb-1 block">Участвуешь в аттестации? *</label>
            <div className="flex gap-3">
              {['yes', 'no'].map(v => (
                <label key={v} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.attending_attestation === v ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <input type="radio" name="attestation" value={v} required
                    checked={form.attending_attestation === v}
                    onChange={() => setForm({ ...form, attending_attestation: v })}
                    className="accent-indigo-600" />
                  <span className="text-sm text-gray-700">{v === 'yes' ? 'Да' : 'Нет'}</span>
                </label>
              ))}
            </div>
          </div>

          {!form.tariff_id && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700">
              ⚠️ Выберите тариф выше
            </div>
          )}

          <button type="submit" disabled={submitting || !form.tariff_id}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-base font-semibold disabled:opacity-50 mt-2">
            {submitting ? 'Отправка...' : 'Записаться на семинар'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            После отправки заявки ждите реквизиты для предоплаты. Внесите предоплату, чтобы зафиксировать цену.
          </p>
        </form>
      </div>
    </div>
  )
}
