'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Tariff = {
  id: string
  name: string
  base_price: number | null
  increase_pct: number
  increase_every_days: number
  increase_starts_at: string | null
  min_deposit_pct: number
  description: string | null
}

type Registration = {
  id: string
  seminar_id: string
  tariff_id: string | null
  student_id: string | null
  is_external: boolean
  participant_name: string
  participant_phone: string | null
  participant_telegram: string | null
  school_status: string | null
  questions: string | null
  source: string | null
  attending_attestation: boolean | null
  referred_by_student_id: string | null
  referral_discount_pct: number
  locked_price: number | null
  price_locked_at: string | null
  discount_pct: number
  discount_reason: string | null
  deposit_amount: number | null
  deposit_paid_at: string | null
  deposit_method: string | null
  total_paid: number
  total_paid_at: string | null
  total_method: string | null
  attended: boolean
  certificate_issued: boolean
  status: string
  notes: string | null
  submitted_at: string
  seminar_events: { title: string; starts_at: string } | null
  seminar_tariffs: Tariff | null
}

type Session = {
  id: string
  seminar_id: string
  title: string
  session_date: string | null
  sort_order: number
}

type SessionAttendance = {
  session_id: string
  attended: boolean
}

type Student = { id: string; name: string; referral_credits: number | null }

function currentPrice(tariff: Tariff, today = new Date()): number {
  if (!tariff.base_price) return 0
  if (!tariff.increase_starts_at || tariff.increase_pct === 0) return tariff.base_price
  const start = new Date(tariff.increase_starts_at)
  if (today < start) return tariff.base_price
  const daysElapsed = Math.floor((today.getTime() - start.getTime()) / 86400000)
  const periods = Math.floor(daysElapsed / (tariff.increase_every_days || 7))
  return Math.round(tariff.base_price * Math.pow(1 + tariff.increase_pct / 100, periods))
}

const STAGES = ['pending', 'deposit_paid', 'fully_paid'] as const
const STAGE_LABELS: Record<string, string> = {
  pending: 'Заявка',
  deposit_paid: 'Предоплата',
  fully_paid: 'Оплачен',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:      { label: 'Заявка',      color: 'bg-yellow-100 text-yellow-700' },
  deposit_paid: { label: 'Предоплата',  color: 'bg-blue-100 text-blue-700' },
  fully_paid:   { label: 'Оплачен',     color: 'bg-green-100 text-green-700' },
  no_show:      { label: 'Не пришёл',   color: 'bg-red-100 text-red-500' },
  cancelled:    { label: 'Отменён',     color: 'bg-gray-100 text-gray-500' },
}

const SCHOOL_STATUS_LABELS: Record<string, string> = {
  start: 'Ученик, группа Старт',
  combat: 'Ученик, группа Комбат',
  neygyn: 'Ученик, группа Нейгун',
  parent: 'Родитель/родственник ученика',
  external: 'Не занимается у нас',
}

const PAYMENT_METHODS = ['cash', 'card', 'transfer']
const PAYMENT_METHOD_LABELS: Record<string, string> = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод' }

export default function RegDetailPage() {
  const { id, regId } = useParams<{ id: string; regId: string }>()
  const { role } = useAuth()
  const canEdit = role === 'founder' || role === 'admin'

  const [reg, setReg] = useState<Registration | null>(null)
  const [referrer, setReferrer] = useState<Student | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionAttendance, setSessionAttendance] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const [depositForm, setDepositForm] = useState({ amount: '', method: 'cash', date: new Date().toISOString().split('T')[0] })
  const [showDepositForm, setShowDepositForm] = useState(false)

  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', date: new Date().toISOString().split('T')[0] })
  const [showPayForm, setShowPayForm] = useState(false)

  const [discountForm, setDiscountForm] = useState({ discount_pct: '', discount_reason: '' })
  const [showDiscountForm, setShowDiscountForm] = useState(false)

  const [notes, setNotes] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)

  const [allTariffs, setAllTariffs] = useState<Tariff[]>([])
  const [showTariffEdit, setShowTariffEdit] = useState(false)
  const [newTariffId, setNewTariffId] = useState('')

  const [allStudents, setAllStudents] = useState<{id: string; name: string; phone: string | null; group_name: string | null}[]>([])
  const [showLinkStudent, setShowLinkStudent] = useState(false)
  const [linkGroup, setLinkGroup] = useState('')
  const [linkStudentId, setLinkStudentId] = useState('')

  async function load() {
    const [{ data: regData }, { data: sessData }, { data: attData }, { data: tarData }] = await Promise.all([
      supabase.from('seminar_registrations')
        .select('*, seminar_events(title, starts_at), seminar_tariffs(*)')
        .eq('id', regId).single(),
      supabase.from('seminar_sessions')
        .select('*').eq('seminar_id', id).order('sort_order'),
      supabase.from('seminar_session_attendance')
        .select('session_id, attended').eq('registration_id', regId),
      supabase.from('seminar_tariffs')
        .select('*').eq('seminar_id', id).order('sort_order'),
    ])

    if (regData) {
      setReg(regData as Registration)
      setNotes(regData.notes || '')
      setDiscountForm({ discount_pct: String(regData.discount_pct || 0), discount_reason: regData.discount_reason || '' })
      if (regData.referred_by_student_id) {
        const { data: stu } = await supabase.from('students').select('id, name, referral_credits').eq('id', regData.referred_by_student_id).single()
        setReferrer(stu)
      }
    }

    setSessions(sessData || [])
    setAllTariffs(tarData || [])

    const attMap: Record<string, boolean> = {}
    for (const row of (attData || [])) attMap[row.session_id] = row.attended
    setSessionAttendance(attMap)

    setLoading(false)
  }

  useEffect(() => { load() }, [regId])

  async function updateStatus(status: string) {
    setSaving('status')
    await supabase.from('seminar_registrations').update({ status }).eq('id', regId)
    setReg(prev => prev ? { ...prev, status } : prev)
    setSaving(null)
  }

  async function toggleSessionAttendance(sessionId: string) {
    const current = sessionAttendance[sessionId] ?? false
    const next = !current
    setSessionAttendance(prev => ({ ...prev, [sessionId]: next }))
    await supabase.from('seminar_session_attendance').upsert(
      { session_id: sessionId, registration_id: regId, attended: next },
      { onConflict: 'session_id,registration_id' }
    )
  }

  async function saveDeposit(e: React.FormEvent) {
    e.preventDefault()
    if (!reg) return
    setSaving('deposit')
    const amount = parseFloat(depositForm.amount)
    const tariff = reg.seminar_tariffs as Tariff | null
    const price = tariff ? currentPrice(tariff) : (reg.locked_price || 0)
    const effectivePrice = Math.round(price * (1 - (reg.discount_pct || 0) / 100))
    const locked = reg.locked_price ?? effectivePrice

    const updates = {
      deposit_amount: amount,
      deposit_paid_at: depositForm.date,
      deposit_method: depositForm.method,
      locked_price: locked,
      price_locked_at: new Date().toISOString(),
      status: 'deposit_paid',
    }
    const { error: regErr } = await supabase.from('seminar_registrations').update(updates).eq('id', regId)
    if (regErr) { alert('Ошибка сохранения предоплаты: ' + regErr.message); setSaving(null); return }

    const { error: payErr } = await supabase.from('payments').insert({
      amount,
      direction: 'income',
      category: 'Семинар',
      payment_type: depositForm.method,
      description: `Предоплата семинар: ${(reg.seminar_events as any)?.title || ''} — ${reg.participant_name}`,
      paid_at: depositForm.date,
      status: 'confirmed',
      student_id: reg.student_id || null,
    })
    if (payErr) { alert('Ошибка записи оплаты в финансы: ' + payErr.message); setSaving(null); return }

    if (reg.is_external && reg.referred_by_student_id) {
      const credit = Math.round(amount * 0.1)
      const { data: refStu } = await supabase.from('students').select('referral_credits').eq('id', reg.referred_by_student_id).single()
      await supabase.from('students').update({ referral_credits: ((refStu?.referral_credits as number) || 0) + credit }).eq('id', reg.referred_by_student_id)
    }

    if (reg.participant_telegram) {
      const minDep = tariff ? Math.ceil(effectivePrice * (tariff.min_deposit_pct || 20) / 100) : 0
      if (amount >= minDep) {
        const remaining = locked - amount
        await fetch('/api/notify-seminar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram: reg.participant_telegram,
            message: `✅ Предоплата ${amount.toLocaleString('ru')} ₽ получена!\n🥋 ${(reg.seminar_events as any)?.title || 'Семинар'}\nЦена зафиксирована: ${locked.toLocaleString('ru')} ₽\nОстаток к оплате: ${Math.max(0, remaining).toLocaleString('ru')} ₽`,
          }),
        }).catch(() => {})
      }
    }

    setShowDepositForm(false)
    setDepositForm({ amount: '', method: 'cash', date: new Date().toISOString().split('T')[0] })
    load()
    setSaving(null)
  }

  async function saveFinalPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!reg) return
    setSaving('payment')
    const amount = parseFloat(payForm.amount)
    const newTotal = (reg.total_paid || 0) + amount

    const { error: regErr2 } = await supabase.from('seminar_registrations').update({
      total_paid: newTotal,
      total_paid_at: payForm.date,
      total_method: payForm.method,
      status: 'fully_paid',
    }).eq('id', regId)
    if (regErr2) { alert('Ошибка сохранения оплаты: ' + regErr2.message); setSaving(null); return }

    const { error: payErr2 } = await supabase.from('payments').insert({
      amount,
      direction: 'income',
      category: 'Семинар',
      payment_type: payForm.method,
      description: `Оплата семинара: ${(reg.seminar_events as any)?.title || ''} — ${reg.participant_name}`,
      paid_at: payForm.date,
      status: 'confirmed',
      student_id: reg.student_id || null,
    })
    if (payErr2) { alert('Ошибка записи оплаты в финансы: ' + payErr2.message); setSaving(null); return }

    if (reg.participant_telegram) {
      await fetch('/api/notify-seminar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram: reg.participant_telegram,
          message: `✅ Оплата семинара подтверждена!\n🥋 ${(reg.seminar_events as any)?.title || 'Семинар'}\nСпасибо, ждём вас!`,
        }),
      }).catch(() => {})
    }

    setShowPayForm(false)
    setPayForm({ amount: '', method: 'cash', date: new Date().toISOString().split('T')[0] })
    load()
    setSaving(null)
  }

  async function saveDiscount() {
    setSaving('discount')
    const pct = parseInt(discountForm.discount_pct) || 0
    await supabase.from('seminar_registrations').update({
      discount_pct: pct,
      discount_reason: discountForm.discount_reason || null,
    }).eq('id', regId)
    setReg(prev => prev ? { ...prev, discount_pct: pct, discount_reason: discountForm.discount_reason } : prev)
    setShowDiscountForm(false)
    setSaving(null)
  }

  async function saveNotes() {
    setSaving('notes')
    await supabase.from('seminar_registrations').update({ notes: notes || null }).eq('id', regId)
    setReg(prev => prev ? { ...prev, notes: notes || null } : prev)
    setEditingNotes(false)
    setSaving(null)
  }

  async function saveTariff() {
    if (!newTariffId) return
    setSaving('tariff')
    const t = allTariffs.find(x => x.id === newTariffId)
    await supabase.from('seminar_registrations').update({
      tariff_id: newTariffId,
      locked_price: null,
      price_locked_at: null,
    }).eq('id', regId)
    setShowTariffEdit(false)
    setNewTariffId('')
    setSaving(null)
    load()
  }

  async function loadStudents() {
    if (allStudents.length > 0) return
    const { data } = await supabase.from('students').select('id, name, phone, group_name').eq('status', 'active').order('name')
    setAllStudents(data || [])
  }

  async function linkStudent() {
    if (!linkStudentId) return
    setSaving('link')
    await supabase.from('seminar_registrations').update({ student_id: linkStudentId }).eq('id', regId)
    setReg(prev => prev ? { ...prev, student_id: linkStudentId } : prev)
    setShowLinkStudent(false)
    setLinkStudentId('')
    setSaving(null)
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Загрузка...</div>
  if (!reg) return <div className="text-center py-12 text-gray-400">Запись не найдена</div>

  const tariff = reg.seminar_tariffs as Tariff | null
  const basePrice = tariff ? currentPrice(tariff) : (reg.locked_price || 0)
  const discountedPrice = reg.locked_price ?? Math.round(basePrice * (1 - (reg.discount_pct || 0) / 100))
  const totalReceived = (reg.deposit_amount || 0) + (reg.total_paid || 0)
  const outstanding = Math.max(0, discountedPrice - totalReceived)
  const st = STATUS_LABELS[reg.status] || { label: reg.status, color: 'bg-gray-100 text-gray-500' }
  const minDep = tariff ? Math.ceil(discountedPrice * (tariff.min_deposit_pct || 20) / 100) : 0

  const mainStageIndex = STAGES.indexOf(reg.status as typeof STAGES[number])
  const isMainStage = mainStageIndex >= 0
  const sessionAttended = sessions.filter(s => sessionAttendance[s.id]).length

  return (
    <main className="max-w-lg mx-auto p-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/seminars/${id}`} className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-800 truncate">{reg.participant_name}</h1>
          <div className="text-xs text-gray-400">{(reg.seminar_events as any)?.title}</div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${st.color}`}>{st.label}</span>
      </div>

      {/* Progress stepper */}
      {canEdit && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            {STAGES.map((stage, i) => {
              const done = isMainStage && mainStageIndex > i
              const active = isMainStage && mainStageIndex === i
              return (
                <div key={stage} className="flex items-center flex-1">
                  <button
                    onClick={() => updateStatus(stage)}
                    disabled={saving === 'status'}
                    className="flex flex-col items-center gap-1 flex-1"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                      ${done ? 'bg-green-500 border-green-500 text-white'
                        : active ? 'bg-black border-black text-white'
                        : 'bg-white border-gray-300 text-gray-400'}`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <div className={`text-xs font-medium ${active ? 'text-black' : done ? 'text-green-600' : 'text-gray-400'}`}>
                      {STAGE_LABELS[stage]}
                    </div>
                  </button>
                  {i < STAGES.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 rounded ${mainStageIndex > i ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Extra statuses */}
          {(!isMainStage || reg.status === 'no_show' || reg.status === 'cancelled') && (
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              {['no_show', 'cancelled'].map(s => (
                <button key={s} onClick={() => updateStatus(s)}
                  disabled={saving === 'status'}
                  className={`flex-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-all
                    ${reg.status === s ? STATUS_LABELS[s]?.color : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  {STATUS_LABELS[s]?.label}
                </button>
              ))}
            </div>
          )}

          {/* Extra status toggle for active registrations */}
          {isMainStage && (
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              {['no_show', 'cancelled'].map(s => (
                <button key={s} onClick={() => updateStatus(s)}
                  disabled={saving === 'status'}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100">
                  {STATUS_LABELS[s]?.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payment block */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">💰 Оплата</div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Тариф</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-800">{tariff?.name || '—'}</span>
              {canEdit && (
                <button onClick={() => { setNewTariffId(reg.tariff_id || ''); setShowTariffEdit(v => !v) }}
                  className="text-xs text-gray-400 hover:text-indigo-600">✏️</button>
              )}
            </div>
          </div>
          {showTariffEdit && canEdit && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <select value={newTariffId} onChange={e => setNewTariffId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white">
                <option value="">Без тарифа</option>
                {allTariffs.map(t => (
                  <option key={t.id} value={t.id}>{t.name} — {currentPrice(t).toLocaleString('ru')} ₽</option>
                ))}
              </select>
              <div className="text-xs text-amber-600">Смена тарифа сбросит зафиксированную цену</div>
              <div className="flex gap-2">
                <button onClick={saveTariff} disabled={saving === 'tariff'}
                  className="flex-1 bg-black text-white py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                  {saving === 'tariff' ? '...' : 'Сохранить'}
                </button>
                <button onClick={() => setShowTariffEdit(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-xs">Отмена</button>
              </div>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">Стоимость</span>
            <div className="text-right">
              <span className="font-semibold text-gray-900">{discountedPrice.toLocaleString('ru')} ₽</span>
              {reg.discount_pct > 0 && (
                <div className="text-xs text-green-600">скидка {reg.discount_pct}%{reg.discount_reason ? ` (${reg.discount_reason})` : ''}</div>
              )}
              {reg.price_locked_at && <div className="text-xs text-gray-400">🔒 зафиксирована</div>}
            </div>
          </div>
          {(reg.deposit_amount || 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Предоплата</span>
              <span className="text-green-700 font-medium">+{reg.deposit_amount!.toLocaleString('ru')} ₽
                {reg.deposit_paid_at && <span className="text-xs text-gray-400 ml-1">({reg.deposit_paid_at})</span>}
              </span>
            </div>
          )}
          {(reg.total_paid || 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Доплата</span>
              <span className="text-green-700 font-medium">+{reg.total_paid.toLocaleString('ru')} ₽
                {reg.total_paid_at && <span className="text-xs text-gray-400 ml-1">({reg.total_paid_at})</span>}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-2">
            <span className="text-gray-600 font-medium">Остаток</span>
            <span className={`font-bold ${outstanding > 0 ? 'text-red-600' : 'text-green-700'}`}>
              {outstanding > 0 ? `${outstanding.toLocaleString('ru')} ₽` : '✅ Оплачено'}
            </span>
          </div>
        </div>

        {reg.status === 'pending' && tariff && !reg.price_locked_at && (
          <div className="mt-3 p-2 bg-blue-50 rounded-xl text-xs text-blue-700">
            Для фиксации цены нужна предоплата от {minDep.toLocaleString('ru')} ₽
          </div>
        )}

        {canEdit && (
          <div className="mt-3 space-y-2">
            {/* Скидка */}
            {!showDiscountForm ? (
              <button onClick={() => setShowDiscountForm(true)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Изменить скидку
              </button>
            ) : (
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input value={discountForm.discount_pct} onChange={e => setDiscountForm({ ...discountForm, discount_pct: e.target.value })}
                    type="number" min="0" max="100" placeholder="Скидка %"
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none" />
                  <input value={discountForm.discount_reason} onChange={e => setDiscountForm({ ...discountForm, discount_reason: e.target.value })}
                    placeholder="Причина" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveDiscount} disabled={saving === 'discount'}
                    className="flex-1 bg-black text-white py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">Сохранить</button>
                  <button onClick={() => setShowDiscountForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-xs">Отмена</button>
                </div>
              </div>
            )}

            {/* Предоплата — только если статус pending */}
            {reg.status === 'pending' && (
              !showDepositForm ? (
                <button onClick={() => setShowDepositForm(true)}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium">
                  Принять предоплату
                </button>
              ) : (
                <form onSubmit={saveDeposit} className="bg-blue-50 rounded-xl p-3 space-y-2">
                  <div className="text-xs font-medium text-blue-700 mb-1">Предоплата (мин. {minDep.toLocaleString('ru')} ₽)</div>
                  <input required value={depositForm.amount} onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
                    type="number" min="1" placeholder={`Сумма (мин. ${minDep}) *`}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                  <div className="flex gap-2">
                    <select value={depositForm.method} onChange={e => setDepositForm({ ...depositForm, method: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none bg-white">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
                    </select>
                    <input type="date" value={depositForm.date} onChange={e => setDepositForm({ ...depositForm, date: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving === 'deposit'}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {saving === 'deposit' ? '...' : 'Принять'}
                    </button>
                    <button type="button" onClick={() => setShowDepositForm(false)}
                      className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">Отмена</button>
                  </div>
                </form>
              )
            )}

            {/* Доплата — только если статус deposit_paid и есть остаток */}
            {reg.status === 'deposit_paid' && outstanding > 0 && (
              !showPayForm ? (
                <button onClick={() => { setPayForm({ ...payForm, amount: String(outstanding) }); setShowPayForm(true) }}
                  className="w-full bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium">
                  Принять доплату ({outstanding.toLocaleString('ru')} ₽)
                </button>
              ) : (
                <form onSubmit={saveFinalPayment} className="bg-green-50 rounded-xl p-3 space-y-2">
                  <div className="text-xs font-medium text-green-700 mb-1">Финальная оплата</div>
                  <input required value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                    type="number" min="1" placeholder="Сумма *"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                  <div className="flex gap-2">
                    <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none bg-white">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
                    </select>
                    <input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving === 'payment'}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {saving === 'payment' ? '...' : 'Принять'}
                    </button>
                    <button type="button" onClick={() => setShowPayForm(false)}
                      className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">Отмена</button>
                  </div>
                </form>
              )
            )}
          </div>
        )}
      </div>

      {/* Session attendance */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-700">Посещение тренировок</div>
            <div className="text-xs text-gray-400">{sessionAttended}/{sessions.length}</div>
          </div>
          <div className="space-y-2">
            {sessions.map(session => {
              const attended = sessionAttendance[session.id] ?? false
              return (
                <label key={session.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors
                  ${attended ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  <input
                    type="checkbox"
                    checked={attended}
                    onChange={() => canEdit && toggleSessionAttendance(session.id)}
                    disabled={!canEdit}
                    className="w-4 h-4 rounded accent-green-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${attended ? 'text-green-700' : 'text-gray-700'}`}>
                      {session.title}
                    </div>
                    {session.session_date && (
                      <div className="text-xs text-gray-400">
                        {new Date(session.session_date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}
                      </div>
                    )}
                  </div>
                  {attended && <span className="text-green-500 text-sm">✓</span>}
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Global attendance + certificate */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-700">Итоговое посещение</div>
            <div className={`text-xs mt-0.5 ${reg.attended ? 'text-green-600' : 'text-gray-400'}`}>
              {reg.attended ? '✅ Пришёл на семинар' : '⏳ Ещё не отмечен'}
            </div>
          </div>
          {canEdit && (
            <button onClick={async () => {
              const attended = !reg.attended
              setSaving('attended')
              await supabase.from('seminar_registrations').update({ attended }).eq('id', regId)
              setReg(prev => prev ? { ...prev, attended } : prev)
              setSaving(null)
            }} disabled={saving === 'attended'}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${reg.attended ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700'}`}>
              {saving === 'attended' ? '...' : reg.attended ? 'Отменить' : 'Отметить'}
            </button>
          )}
        </div>
        {reg.certificate_issued && <div className="mt-2 text-xs text-blue-600">🎖 Сертификат выдан</div>}
        {reg.attended && !reg.certificate_issued && canEdit && (
          <button onClick={async () => {
            await supabase.from('seminar_registrations').update({ certificate_issued: true }).eq('id', regId)
            setReg(prev => prev ? { ...prev, certificate_issued: true } : prev)
          }} className="mt-2 text-xs text-gray-500 hover:text-blue-600 underline">
            Отметить выдачу сертификата
          </button>
        )}
      </div>

      {/* Participant info */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">Данные участника</div>
          {reg.student_id && (
            <Link href={`/students/${reg.student_id}`} className="text-xs text-indigo-600 hover:underline">→ Карточка ученика</Link>
          )}
        </div>
        {reg.participant_phone && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Телефон</span>
            <a href={`tel:${reg.participant_phone}`} className="text-gray-800 hover:text-blue-600">{reg.participant_phone}</a>
          </div>
        )}
        {reg.participant_telegram && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Telegram</span>
            <span className="text-gray-800">{reg.participant_telegram}</span>
          </div>
        )}
        {reg.school_status && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Статус</span>
            <span className="text-gray-800 text-right max-w-[60%]">{SCHOOL_STATUS_LABELS[reg.school_status] || reg.school_status}</span>
          </div>
        )}
        {reg.is_external && (
          <div className="text-xs px-2 py-1 rounded bg-orange-50 text-orange-600 inline-block">Внешний участник</div>
        )}
        {reg.source && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Источник</span>
            <span className="text-gray-800">{reg.source}</span>
          </div>
        )}
        {reg.attending_attestation !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Участвует в аттестации</span>
            <span className="text-gray-800">{reg.attending_attestation ? 'Да' : 'Нет'}</span>
          </div>
        )}
        {reg.questions && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-400 mb-1">Вопросы</div>
            <div className="text-sm text-gray-700">{reg.questions}</div>
          </div>
        )}
      </div>

      {/* Link to student */}
      {!reg.student_id && canEdit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-yellow-700">Не привязан к ученику</div>
              <div className="text-xs text-gray-500 mt-0.5">Телефон не совпал ни с кем в базе</div>
            </div>
            {!showLinkStudent && (
              <button onClick={() => { setShowLinkStudent(true); loadStudents() }}
                className="text-xs px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 font-medium">
                Привязать
              </button>
            )}
          </div>
          {showLinkStudent && (
            <div className="mt-3 space-y-2">
              <select value={linkGroup} onChange={e => { setLinkGroup(e.target.value); setLinkStudentId('') }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white">
                <option value="">Все группы</option>
                {[...new Set(allStudents.map(s => s.group_name).filter(Boolean))].sort().map(g => (
                  <option key={g} value={g!}>{g}</option>
                ))}
              </select>
              <select value={linkStudentId} onChange={e => setLinkStudentId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white">
                <option value="">Выберите ученика</option>
                {allStudents
                  .filter(s => !linkGroup || s.group_name === linkGroup)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ''}</option>
                  ))}
              </select>
              <div className="flex gap-2">
                <button onClick={linkStudent} disabled={!linkStudentId || saving === 'link'}
                  className="flex-1 bg-black text-white py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                  {saving === 'link' ? '...' : 'Привязать'}
                </button>
                <button onClick={() => setShowLinkStudent(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-xs">Отмена</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Referral */}
      {referrer && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
          <div className="text-xs font-medium text-amber-700 mb-1">🔗 Реферал от ученика</div>
          <div className="text-sm text-gray-800">{referrer.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Скидка участнику: {reg.referral_discount_pct}%
            {referrer.referral_credits ? ` · Бонусы реферера: ${referrer.referral_credits.toLocaleString('ru')} ₽` : ''}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">Заметки</div>
          {canEdit && !editingNotes && (
            <button onClick={() => setEditingNotes(true)} className="text-xs text-gray-400 hover:text-gray-600">Изменить</button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
            <div className="flex gap-2">
              <button onClick={saveNotes} disabled={saving === 'notes'}
                className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving === 'notes' ? '...' : 'Сохранить'}
              </button>
              <button onClick={() => { setNotes(reg.notes || ''); setEditingNotes(false) }}
                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl text-sm">Отмена</button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600">{reg.notes || <span className="text-gray-300">Нет заметок</span>}</div>
        )}
      </div>
    </main>
  )
}
