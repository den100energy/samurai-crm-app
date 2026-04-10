'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

// ─── Types ───────────────────────────────────────────────────────────────────

type Seminar = {
  id: string
  title: string
  discipline: string | null
  location: string | null
  description: string | null
  schedule_text: string | null
  starts_at: string
  ends_at: string
  registration_deadline: string | null
  status: string
  notes: string | null
}

type Tariff = {
  id: string
  seminar_id: string
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

type Registration = {
  id: string
  tariff_id: string | null
  student_id: string | null
  is_external: boolean
  participant_name: string
  participant_phone: string | null
  participant_telegram: string | null
  school_status: string | null
  locked_price: number | null
  deposit_amount: number | null
  deposit_paid_at: string | null
  total_paid: number
  status: string
  attended: boolean
  seminar_tariffs: { name: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentPrice(tariff: Tariff, today = new Date()): number {
  if (!tariff.base_price) return 0
  if (!tariff.increase_starts_at || tariff.increase_pct === 0) return tariff.base_price
  const start = new Date(tariff.increase_starts_at)
  const daysElapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000))
  const periods = Math.floor(daysElapsed / (tariff.increase_every_days || 7))
  return Math.round(tariff.base_price * Math.pow(1 + tariff.increase_pct / 100, periods))
}

function nextPriceDate(tariff: Tariff, today = new Date()): string | null {
  if (!tariff.increase_starts_at || tariff.increase_pct === 0) return null
  const start = new Date(tariff.increase_starts_at)
  const daysElapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000))
  const periods = Math.floor(daysElapsed / (tariff.increase_every_days || 7))
  const next = new Date(start)
  next.setDate(next.getDate() + (periods + 1) * (tariff.increase_every_days || 7))
  return next.toISOString().split('T')[0]
}

function minDeposit(tariff: Tariff): number {
  return Math.ceil(currentPrice(tariff) * (tariff.min_deposit_pct || 20) / 100)
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:      { label: 'Заявка',    color: 'bg-yellow-100 text-yellow-700' },
  deposit_paid: { label: 'Предоплата',color: 'bg-blue-100 text-blue-700' },
  fully_paid:   { label: 'Оплачен',   color: 'bg-green-100 text-green-700' },
  no_show:      { label: 'Не пришёл', color: 'bg-red-100 text-red-500' },
  cancelled:    { label: 'Отменён',   color: 'bg-gray-100 text-gray-500' },
}

const SEMINAR_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', open: 'Приём заявок', completed: 'Завершён', cancelled: 'Отменён',
}

const DISCIPLINE_LABELS: Record<string, string> = {
  aikido: 'Айкидо', wushu: 'Ушу', both: 'Айкидо + Ушу', qigong: 'Цигун',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SeminarPage() {
  const { id } = useParams<{ id: string }>()
  const { role } = useAuth()
  const canEdit = role === 'founder' || role === 'admin'

  const [seminar, setSeminar] = useState<Seminar | null>(null)
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [regs, setRegs] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Tariff form
  const [showTariffForm, setShowTariffForm] = useState(false)
  const [tariffForm, setTariffForm] = useState({
    name: '', description: '', base_price: '', increase_pct: '10',
    increase_every_days: '7', increase_starts_at: '', min_deposit_pct: '20', max_participants: '',
  })

  // Tariff edit
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null)
  const [editTariffForm, setEditTariffForm] = useState({
    name: '', description: '', base_price: '', increase_pct: '10',
    increase_every_days: '7', increase_starts_at: '', min_deposit_pct: '20', max_participants: '',
  })

  // Manual registration form
  const [showRegForm, setShowRegForm] = useState(false)
  const [regForm, setRegForm] = useState({
    participant_name: '', participant_phone: '', participant_telegram: '',
    school_status: '', tariff_id: '', questions: '', source: '',
    attending_attestation: false, is_external: false,
  })

  async function load() {
    const [{ data: sem }, { data: tar }, { data: reg }] = await Promise.all([
      supabase.from('seminar_events').select('*').eq('id', id).single(),
      supabase.from('seminar_tariffs').select('*').eq('seminar_id', id).order('sort_order'),
      supabase.from('seminar_registrations')
        .select('id, tariff_id, student_id, is_external, participant_name, participant_phone, participant_telegram, school_status, locked_price, deposit_amount, deposit_paid_at, total_paid, status, attended, seminar_tariffs(name)')
        .eq('seminar_id', id)
        .order('submitted_at', { ascending: false }),
    ])
    setSeminar(sem)
    setTariffs(tar || [])
    setRegs(((reg || []) as unknown) as Registration[])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function updateStatus(status: string) {
    setSaving('status')
    await supabase.from('seminar_events').update({ status }).eq('id', id)
    setSeminar(prev => prev ? { ...prev, status } : prev)
    setSaving(null)
  }

  async function addTariff(e: React.FormEvent) {
    e.preventDefault()
    setSaving('tariff')
    await supabase.from('seminar_tariffs').insert({
      seminar_id: id,
      name: tariffForm.name,
      description: tariffForm.description || null,
      base_price: tariffForm.base_price ? parseFloat(tariffForm.base_price) : null,
      increase_pct: parseInt(tariffForm.increase_pct) || 0,
      increase_every_days: parseInt(tariffForm.increase_every_days) || 7,
      increase_starts_at: tariffForm.increase_starts_at || null,
      min_deposit_pct: parseInt(tariffForm.min_deposit_pct) || 20,
      max_participants: tariffForm.max_participants ? parseInt(tariffForm.max_participants) : null,
      sort_order: tariffs.length,
    })
    setTariffForm({ name: '', description: '', base_price: '', increase_pct: '10', increase_every_days: '7', increase_starts_at: '', min_deposit_pct: '20', max_participants: '' })
    setShowTariffForm(false)
    setSaving(null)
    load()
  }

  async function deleteTariff(tariffId: string) {
    if (!confirm('Удалить тариф?')) return
    await supabase.from('seminar_tariffs').delete().eq('id', tariffId)
    setTariffs(prev => prev.filter(t => t.id !== tariffId))
  }

  function startEditTariff(t: Tariff) {
    setEditingTariffId(t.id)
    setEditTariffForm({
      name: t.name,
      description: t.description || '',
      base_price: t.base_price?.toString() || '',
      increase_pct: t.increase_pct.toString(),
      increase_every_days: t.increase_every_days.toString(),
      increase_starts_at: t.increase_starts_at || '',
      min_deposit_pct: t.min_deposit_pct.toString(),
      max_participants: t.max_participants?.toString() || '',
    })
  }

  async function saveTariff(e: React.FormEvent, tariffId: string) {
    e.preventDefault()
    setSaving('edit-tariff')
    await supabase.from('seminar_tariffs').update({
      name: editTariffForm.name,
      description: editTariffForm.description || null,
      base_price: editTariffForm.base_price ? parseFloat(editTariffForm.base_price) : null,
      increase_pct: parseInt(editTariffForm.increase_pct) || 0,
      increase_every_days: parseInt(editTariffForm.increase_every_days) || 7,
      increase_starts_at: editTariffForm.increase_starts_at || null,
      min_deposit_pct: parseInt(editTariffForm.min_deposit_pct) || 20,
      max_participants: editTariffForm.max_participants ? parseInt(editTariffForm.max_participants) : null,
    }).eq('id', tariffId)
    setEditingTariffId(null)
    setSaving(null)
    load()
  }

  async function addRegistration(e: React.FormEvent) {
    e.preventDefault()
    setSaving('reg')
    const tariff = tariffs.find(t => t.id === regForm.tariff_id)
    const price = tariff ? currentPrice(tariff) : null
    await supabase.from('seminar_registrations').insert({
      seminar_id: id,
      tariff_id: regForm.tariff_id || null,
      is_external: regForm.is_external,
      participant_name: regForm.participant_name,
      participant_phone: regForm.participant_phone || null,
      participant_telegram: regForm.participant_telegram || null,
      school_status: regForm.school_status || null,
      questions: regForm.questions || null,
      source: regForm.source || null,
      attending_attestation: regForm.attending_attestation,
      locked_price: price,
      status: 'pending',
    })
    setRegForm({ participant_name: '', participant_phone: '', participant_telegram: '', school_status: '', tariff_id: '', questions: '', source: '', attending_attestation: false, is_external: false })
    setShowRegForm(false)
    setSaving(null)
    load()
  }

  // ─── Financial summary ───────────────────────────────────────────────────

  const totalDeposit = regs.reduce((s, r) => s + (r.deposit_amount || 0), 0)
  const totalPaid = regs.reduce((s, r) => s + (r.total_paid || 0), 0)
  const totalCollected = totalDeposit + totalPaid
  const expectedTotal = regs.reduce((s, r) => s + (r.locked_price || 0), 0)
  const remaining = expectedTotal - totalCollected

  const today = new Date().toISOString().split('T')[0]
  const regLink = typeof window !== 'undefined'
    ? `${window.location.origin}/seminars/${id}/register`
    : `/seminars/${id}/register`

  if (loading) return <div className="text-center py-12 text-gray-400">Загрузка...</div>
  if (!seminar) return <div className="text-center py-12 text-gray-400">Семинар не найден</div>

  const statusFlow = ['draft', 'open', 'completed', 'cancelled']
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', open: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-500',
  }

  return (
    <main className="max-w-lg mx-auto p-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/events" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-800 truncate">{seminar.title}</h1>
          <div className="text-xs text-gray-400">
            📅 {seminar.starts_at}{seminar.ends_at !== seminar.starts_at ? ` — ${seminar.ends_at}` : ''}
            {seminar.location && <span className="ml-2">📍 {seminar.location}</span>}
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusColors[seminar.status] || 'bg-gray-100 text-gray-500'}`}>
          {SEMINAR_STATUS_LABELS[seminar.status] || seminar.status}
        </span>
      </div>

      {/* Status controls */}
      {canEdit && (
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm mb-4">
          <div className="text-xs text-gray-400 mb-2">Статус семинара</div>
          <div className="flex gap-2 flex-wrap">
            {statusFlow.map(s => (
              <button key={s} onClick={() => updateStatus(s)}
                disabled={seminar.status === s || saving === 'status'}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${seminar.status === s ? statusColors[s] : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                {SEMINAR_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {seminar.status === 'open' && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="text-xs text-gray-500">Ссылка для записи:</div>
              <div className="flex items-center gap-2 mt-1">
                <input readOnly value={regLink} className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-600" />
                <button onClick={() => navigator.clipboard.writeText(regLink)}
                  className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-indigo-100">
                  Копировать
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Financial summary */}
      {regs.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">💰 Финансы</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-green-700">{totalCollected.toLocaleString('ru')} ₽</div>
              <div className="text-xs text-gray-400">Получено</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange-600">{remaining > 0 ? remaining.toLocaleString('ru') : 0} ₽</div>
              <div className="text-xs text-gray-400">Ожидается</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-700">{regs.filter(r => r.attended).length}/{regs.length}</div>
              <div className="text-xs text-gray-400">Пришли</div>
            </div>
          </div>
          {/* By tariff breakdown */}
          {tariffs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              {tariffs.map(t => {
                const tRegs = regs.filter(r => r.tariff_id === t.id)
                return tRegs.length > 0 ? (
                  <div key={t.id} className="flex justify-between text-xs text-gray-500">
                    <span>{t.name}</span>
                    <span>{tRegs.length} чел.</span>
                  </div>
                ) : null
              })}
            </div>
          )}
        </div>
      )}

      {/* Tariffs */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">Тарифы</div>
          {canEdit && (
            <button onClick={() => setShowTariffForm(!showTariffForm)}
              className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
              + Добавить тариф
            </button>
          )}
        </div>

        {showTariffForm && canEdit && (
          <form onSubmit={addTariff} className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm mb-3 space-y-3">
            <input required value={tariffForm.name} onChange={e => setTariffForm({ ...tariffForm, name: e.target.value })}
              placeholder="Название тарифа *" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            <textarea value={tariffForm.description} onChange={e => setTariffForm({ ...tariffForm, description: e.target.value })}
              placeholder="Расписание / описание тарифа" rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
            <input value={tariffForm.base_price} onChange={e => setTariffForm({ ...tariffForm, base_price: e.target.value })}
              placeholder="Стартовая цена (₽) *" type="number" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            <div className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="text-xs font-medium text-gray-500">Повышение цены</div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 mb-1 block">% повышения</label>
                  <input value={tariffForm.increase_pct} onChange={e => setTariffForm({ ...tariffForm, increase_pct: e.target.value })}
                    type="number" min="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 mb-1 block">каждые N дней</label>
                  <input value={tariffForm.increase_every_days} onChange={e => setTariffForm({ ...tariffForm, increase_every_days: e.target.value })}
                    type="number" min="1" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Начало роста цены</label>
                <input value={tariffForm.increase_starts_at} onChange={e => setTariffForm({ ...tariffForm, increase_starts_at: e.target.value })}
                  type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Мин. предоплата %</label>
                <input value={tariffForm.min_deposit_pct} onChange={e => setTariffForm({ ...tariffForm, min_deposit_pct: e.target.value })}
                  type="number" min="0" max="100" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Макс. участников</label>
                <input value={tariffForm.max_participants} onChange={e => setTariffForm({ ...tariffForm, max_participants: e.target.value })}
                  type="number" min="1" placeholder="без лимита"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              </div>
            </div>
            <button type="submit" disabled={saving === 'tariff'}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving === 'tariff' ? 'Сохранение...' : 'Добавить тариф'}
            </button>
          </form>
        )}

        {tariffs.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">Тарифы не добавлены</div>
        ) : (
          <div className="space-y-2">
            {tariffs.map(t => {
              const price = currentPrice(t)
              const nextDate = nextPriceDate(t)
              const deposit = minDeposit(t)
              const tRegCount = regs.filter(r => r.tariff_id === t.id).length
              const isEditing = editingTariffId === t.id
              return (
                <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {isEditing ? (
                    <form onSubmit={e => saveTariff(e, t.id)} className="p-3 space-y-3">
                      <div className="text-xs font-medium text-indigo-600 mb-1">Редактирование тарифа</div>
                      <input required value={editTariffForm.name} onChange={e => setEditTariffForm({ ...editTariffForm, name: e.target.value })}
                        placeholder="Название *" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                      <textarea value={editTariffForm.description} onChange={e => setEditTariffForm({ ...editTariffForm, description: e.target.value })}
                        placeholder="Расписание / описание" rows={3}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none" />
                      <input value={editTariffForm.base_price} onChange={e => setEditTariffForm({ ...editTariffForm, base_price: e.target.value })}
                        placeholder="Стартовая цена (₽) *" type="number" required
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                      <div className="border border-gray-100 rounded-xl p-3 space-y-2">
                        <div className="text-xs font-medium text-gray-500">Повышение цены</div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-gray-400 mb-1 block">% повышения</label>
                            <input value={editTariffForm.increase_pct} onChange={e => setEditTariffForm({ ...editTariffForm, increase_pct: e.target.value })}
                              type="number" min="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-400 mb-1 block">каждые N дней</label>
                            <input value={editTariffForm.increase_every_days} onChange={e => setEditTariffForm({ ...editTariffForm, increase_every_days: e.target.value })}
                              type="number" min="1" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Начало роста цены</label>
                          <input value={editTariffForm.increase_starts_at} onChange={e => setEditTariffForm({ ...editTariffForm, increase_starts_at: e.target.value })}
                            type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-gray-400 mb-1 block">Мин. предоплата %</label>
                          <input value={editTariffForm.min_deposit_pct} onChange={e => setEditTariffForm({ ...editTariffForm, min_deposit_pct: e.target.value })}
                            type="number" min="0" max="100" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-400 mb-1 block">Макс. участников</label>
                          <input value={editTariffForm.max_participants} onChange={e => setEditTariffForm({ ...editTariffForm, max_participants: e.target.value })}
                            type="number" min="1" placeholder="без лимита"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={saving === 'edit-tariff'}
                          className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                          {saving === 'edit-tariff' ? 'Сохранение...' : 'Сохранить'}
                        </button>
                        <button type="button" onClick={() => setEditingTariffId(null)}
                          className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl text-sm">
                          Отмена
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 text-sm">{t.name}</div>
                          {t.description && <div className="text-xs text-gray-500 mt-1 whitespace-pre-line">{t.description}</div>}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-base font-bold text-gray-900">{price.toLocaleString('ru')} ₽</span>
                            {t.base_price !== price && (
                              <span className="text-xs text-gray-400 line-through">{t.base_price?.toLocaleString('ru')} ₽</span>
                            )}
                            <span className="text-xs text-gray-500">предоплата от {deposit.toLocaleString('ru')} ₽</span>
                          </div>
                          {nextDate && nextDate > today && (
                            <div className="text-xs text-orange-600 mt-1">
                              ⚡ Цена вырастет до {Math.round(price * (1 + t.increase_pct / 100)).toLocaleString('ru')} ₽ с {nextDate}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            👥 {tRegCount}{t.max_participants ? `/${t.max_participants}` : ''} записей
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-2 ml-2">
                            <button onClick={() => startEditTariff(t)}
                              className="text-gray-400 hover:text-indigo-600 text-sm px-1">✏️</button>
                            <button onClick={() => deleteTariff(t.id)}
                              className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Registrations */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">Участники ({regs.length})</div>
          {canEdit && (
            <button onClick={() => setShowRegForm(!showRegForm)}
              className="text-xs bg-black text-white px-3 py-1.5 rounded-lg">
              + Добавить вручную
            </button>
          )}
        </div>

        {showRegForm && canEdit && (
          <form onSubmit={addRegistration} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-3 space-y-3">
            <input required value={regForm.participant_name} onChange={e => setRegForm({ ...regForm, participant_name: e.target.value })}
              placeholder="Фамилия Имя *" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            <input value={regForm.participant_phone} onChange={e => setRegForm({ ...regForm, participant_phone: e.target.value })}
              placeholder="Телефон" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            <input value={regForm.participant_telegram} onChange={e => setRegForm({ ...regForm, participant_telegram: e.target.value })}
              placeholder="Ник в Telegram (@...)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            <select value={regForm.tariff_id} onChange={e => setRegForm({ ...regForm, tariff_id: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
              <option value="">Выберите тариф</option>
              {tariffs.map(t => <option key={t.id} value={t.id}>{t.name} — {currentPrice(t).toLocaleString('ru')} ₽</option>)}
            </select>
            <select value={regForm.school_status} onChange={e => setRegForm({ ...regForm, school_status: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
              <option value="">Статус в школе</option>
              <option value="start">Ученик, группа Старт</option>
              <option value="combat">Ученик, группа Комбат</option>
              <option value="neygyn">Ученик, группа Нейгун</option>
              <option value="parent">Родитель/родственник ученика</option>
              <option value="external">Не занимается у нас</option>
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={regForm.is_external} onChange={e => setRegForm({ ...regForm, is_external: e.target.checked })} />
              <span className="text-sm text-gray-700">Внешний участник</span>
            </label>
            <textarea value={regForm.questions} onChange={e => setRegForm({ ...regForm, questions: e.target.value })}
              placeholder="Вопросы / примечания" rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
            <button type="submit" disabled={saving === 'reg'}
              className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving === 'reg' ? 'Сохранение...' : 'Добавить участника'}
            </button>
          </form>
        )}

        {regs.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-8 bg-gray-50 rounded-xl">Заявок пока нет</div>
        ) : (
          <div className="space-y-2">
            {regs.map(r => {
              const st = STATUS_LABELS[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-500' }
              return (
                <Link key={r.id} href={`/seminars/${id}/${r.id}`}
                  className="block bg-white rounded-xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800 text-sm">{r.participant_name}</span>
                        {r.is_external && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">внешний</span>}
                        {r.attended && <span className="text-xs">✅</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {(r.seminar_tariffs as any)?.name || '—'}
                        {r.locked_price ? ` · ${r.locked_price.toLocaleString('ru')} ₽` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      <span className="text-gray-300">›</span>
                    </div>
                  </div>
                  {r.deposit_amount && r.deposit_amount > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      Предоплата: {r.deposit_amount.toLocaleString('ru')} ₽
                      {r.total_paid > 0 && ` · Итого: ${(r.deposit_amount + r.total_paid).toLocaleString('ru')} ₽`}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
