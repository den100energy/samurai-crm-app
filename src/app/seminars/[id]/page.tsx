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

type Session = {
  id: string
  seminar_id: string
  title: string
  session_date: string | null
  sort_order: number
}

type Student = {
  id: string
  name: string
  phone: string | null
  group_name: string | null
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
  if (today < start) return tariff.increase_starts_at
  const daysElapsed = Math.floor((today.getTime() - start.getTime()) / 86400000)
  const periods = Math.floor(daysElapsed / (tariff.increase_every_days || 7))
  const next = new Date(start)
  next.setDate(next.getDate() + (periods + 1) * (tariff.increase_every_days || 7))
  return next.toISOString().split('T')[0]
}

function minDeposit(tariff: Tariff): number {
  return Math.ceil(currentPrice(tariff) * (tariff.min_deposit_pct || 20) / 100)
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:      { label: 'Заявка',     color: 'bg-yellow-100 text-yellow-700' },
  deposit_paid: { label: 'Предоплата', color: 'bg-blue-100 text-blue-700' },
  fully_paid:   { label: 'Оплачен',    color: 'bg-green-100 text-green-700' },
  no_show:      { label: 'Не пришёл',  color: 'bg-red-100 text-red-500' },
  cancelled:    { label: 'Отменён',    color: 'bg-gray-100 text-gray-500' },
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
  const [sessions, setSessions] = useState<Session[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Seminar edit
  const [editingSeminar, setEditingSeminar] = useState(false)
  const [editSeminarForm, setEditSeminarForm] = useState({
    title: '', discipline: '', location: '', starts_at: '', ends_at: '',
    registration_deadline: '', description: '', schedule_text: '',
  })

  function startEditSeminar() {
    if (!seminar) return
    setEditSeminarForm({
      title: seminar.title,
      discipline: seminar.discipline || '',
      location: seminar.location || '',
      starts_at: seminar.starts_at,
      ends_at: seminar.ends_at,
      registration_deadline: seminar.registration_deadline || '',
      description: seminar.description || '',
      schedule_text: seminar.schedule_text || '',
    })
    setEditingSeminar(true)
  }

  async function saveSeminar(e: React.FormEvent) {
    e.preventDefault()
    setSaving('seminar')
    await supabase.from('seminar_events').update({
      title: editSeminarForm.title,
      discipline: editSeminarForm.discipline || null,
      location: editSeminarForm.location || null,
      starts_at: editSeminarForm.starts_at,
      ends_at: editSeminarForm.ends_at,
      registration_deadline: editSeminarForm.registration_deadline || null,
      description: editSeminarForm.description || null,
      schedule_text: editSeminarForm.schedule_text || null,
    }).eq('id', id)
    setEditingSeminar(false)
    setSaving(null)
    load()
  }

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

  // Session form
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionForm, setSessionForm] = useState({ title: '', session_date: '' })

  // Manual registration form
  const [showRegForm, setShowRegForm] = useState(false)
  const [regForm, setRegForm] = useState({
    participant_name: '', participant_phone: '', participant_telegram: '',
    school_status: '', tariff_id: '', questions: '', source: '',
    attending_attestation: false, is_external: false,
  })
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')

  async function load() {
    const [{ data: sem }, { data: tar }, { data: reg }, { data: sess }, { data: stu }] = await Promise.all([
      supabase.from('seminar_events').select('*').eq('id', id).single(),
      supabase.from('seminar_tariffs').select('*').eq('seminar_id', id).order('sort_order'),
      supabase.from('seminar_registrations')
        .select('id, tariff_id, student_id, is_external, participant_name, participant_phone, participant_telegram, school_status, locked_price, deposit_amount, deposit_paid_at, total_paid, status, attended, seminar_tariffs(name)')
        .eq('seminar_id', id)
        .order('submitted_at', { ascending: false }),
      supabase.from('seminar_sessions').select('*').eq('seminar_id', id).order('sort_order'),
      supabase.from('students').select('id, name, phone, group_name').eq('active', true).order('name'),
    ])
    setSeminar(sem)
    setTariffs(tar || [])
    setRegs(((reg || []) as unknown) as Registration[])
    setSessions(sess || [])
    setStudents(stu || [])
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

  async function addSession(e: React.FormEvent) {
    e.preventDefault()
    setSaving('session')
    await supabase.from('seminar_sessions').insert({
      seminar_id: id,
      title: sessionForm.title,
      session_date: sessionForm.session_date || null,
      sort_order: sessions.length,
    })
    setSessionForm({ title: '', session_date: '' })
    setShowSessionForm(false)
    setSaving(null)
    load()
  }

  async function deleteSession(sessionId: string) {
    if (!confirm('Удалить тренировку?')) return
    await supabase.from('seminar_sessions').delete().eq('id', sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  async function addRegistration(e: React.FormEvent) {
    e.preventDefault()
    setSaving('reg')
    const tariff = tariffs.find(t => t.id === regForm.tariff_id)
    const price = tariff ? currentPrice(tariff) : null

    let name = regForm.participant_name
    let phone = regForm.participant_phone || null
    let telegram = regForm.participant_telegram || null
    let schoolStatus = regForm.school_status || null
    let studentId: string | null = null

    if (!regForm.is_external && selectedStudentId) {
      const stu = students.find(s => s.id === selectedStudentId)
      if (stu) {
        name = stu.name
        phone = stu.phone || null
        studentId = stu.id
        // Map group_name to school_status
        const g = stu.group_name?.toLowerCase() || ''
        if (g.includes('старт') || g.includes('start')) schoolStatus = 'start'
        else if (g.includes('комбат') || g.includes('combat')) schoolStatus = 'combat'
        else if (g.includes('нейгун') || g.includes('neygyn')) schoolStatus = 'neygyn'
      }
    }

    await supabase.from('seminar_registrations').insert({
      seminar_id: id,
      tariff_id: regForm.tariff_id || null,
      student_id: studentId,
      is_external: regForm.is_external,
      participant_name: name,
      participant_phone: phone,
      participant_telegram: telegram,
      school_status: schoolStatus,
      questions: regForm.questions || null,
      source: regForm.source || null,
      attending_attestation: regForm.attending_attestation,
      locked_price: price,
      status: 'pending',
    })
    setRegForm({ participant_name: '', participant_phone: '', participant_telegram: '', school_status: '', tariff_id: '', questions: '', source: '', attending_attestation: false, is_external: false })
    setSelectedGroup('')
    setSelectedStudentId('')
    setShowRegForm(false)
    setSaving(null)
    load()
  }

  // ─── Dashboard stats ─────────────────────────────────────────────────────

  const totalDeposit = regs.reduce((s, r) => s + (r.deposit_amount || 0), 0)
  const totalFinal = regs.reduce((s, r) => s + (r.total_paid || 0), 0)
  const totalCollected = totalDeposit + totalFinal
  const countDeposit = regs.filter(r => r.status === 'deposit_paid').length
  const countPaid = regs.filter(r => r.status === 'fully_paid').length
  const countAttended = regs.filter(r => r.attended).length

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
        {canEdit && (
          <button onClick={startEditSeminar} className="text-gray-400 hover:text-indigo-600 text-sm">✏️</button>
        )}
      </div>

      {/* Seminar edit form */}
      {editingSeminar && canEdit && (
        <form onSubmit={saveSeminar} className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm mb-4 space-y-3">
          <div className="text-sm font-semibold text-indigo-700 mb-1">Редактирование семинара</div>
          <input required value={editSeminarForm.title} onChange={e => setEditSeminarForm({ ...editSeminarForm, title: e.target.value })}
            placeholder="Название *" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <select value={editSeminarForm.discipline} onChange={e => setEditSeminarForm({ ...editSeminarForm, discipline: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            <option value="">Дисциплина (необязательно)</option>
            <option value="aikido">Айкидо</option>
            <option value="wushu">Ушу</option>
            <option value="both">Айкидо + Ушу</option>
            <option value="qigong">Цигун</option>
          </select>
          <input value={editSeminarForm.location} onChange={e => setEditSeminarForm({ ...editSeminarForm, location: e.target.value })}
            placeholder="Место проведения" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Начало *</label>
              <input required type="date" value={editSeminarForm.starts_at} onChange={e => setEditSeminarForm({ ...editSeminarForm, starts_at: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Конец *</label>
              <input required type="date" value={editSeminarForm.ends_at} onChange={e => setEditSeminarForm({ ...editSeminarForm, ends_at: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Приём заявок до</label>
            <input type="date" value={editSeminarForm.registration_deadline} onChange={e => setEditSeminarForm({ ...editSeminarForm, registration_deadline: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          </div>
          <textarea value={editSeminarForm.description} onChange={e => setEditSeminarForm({ ...editSeminarForm, description: e.target.value })}
            placeholder="Описание (покажется участникам)" rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
          <textarea value={editSeminarForm.schedule_text} onChange={e => setEditSeminarForm({ ...editSeminarForm, schedule_text: e.target.value })}
            placeholder="Общее расписание семинара (необязательно)" rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving === 'seminar'}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving === 'seminar' ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" onClick={() => setEditingSeminar(false)}
              className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm">
              Отмена
            </button>
          </div>
        </form>
      )}

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

      {/* ── Dashboard ── */}
      {regs.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">📊 Итоги</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{regs.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Заявок</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{totalCollected.toLocaleString('ru')} ₽</div>
              <div className="text-xs text-gray-400 mt-0.5">Собрано</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{countDeposit}</div>
              <div className="text-xs text-gray-400 mt-0.5">Предоплат</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-emerald-700">{countPaid}</div>
              <div className="text-xs text-gray-400 mt-0.5">Полностью оплатили</div>
            </div>
          </div>
          <div className="flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3">
            <div className="text-sm text-indigo-700 font-medium">Пришли на семинар</div>
            <div className="text-xl font-bold text-indigo-800">{countAttended} / {regs.length}</div>
          </div>
          {/* By tariff */}
          {tariffs.length > 1 && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              {tariffs.map(t => {
                const tRegs = regs.filter(r => r.tariff_id === t.id)
                const tCollected = tRegs.reduce((s, r) => s + (r.deposit_amount || 0) + (r.total_paid || 0), 0)
                return tRegs.length > 0 ? (
                  <div key={t.id} className="flex justify-between text-xs text-gray-500">
                    <span>{t.name}</span>
                    <span>{tRegs.length} чел. · {tCollected.toLocaleString('ru')} ₽</span>
                  </div>
                ) : null
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Тренировки / сессии семинара ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">🗓 Тренировки ({sessions.length})</div>
          {canEdit && (
            <button onClick={() => setShowSessionForm(!showSessionForm)}
              className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200">
              + Добавить
            </button>
          )}
        </div>

        {showSessionForm && canEdit && (
          <form onSubmit={addSession} className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm mb-3 space-y-2">
            <input required value={sessionForm.title} onChange={e => setSessionForm({ ...sessionForm, title: e.target.value })}
              placeholder="Название тренировки *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Дата (необязательно)</label>
              <input type="date" value={sessionForm.session_date} onChange={e => setSessionForm({ ...sessionForm, session_date: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving === 'session'}
                className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving === 'session' ? '...' : 'Добавить'}
              </button>
              <button type="button" onClick={() => setShowSessionForm(false)}
                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">
                Отмена
              </button>
            </div>
          </form>
        )}

        {sessions.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl">
            Добавьте тренировки, чтобы отмечать посещаемость по каждой
          </div>
        ) : (
          <div className="space-y-1.5">
            {sessions.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                  <div>
                    <div className="text-sm text-gray-800">{s.title}</div>
                    {s.session_date && <div className="text-xs text-gray-400">{s.session_date}</div>}
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => deleteSession(s.id)}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none ml-2">×</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Тарифы ── */}
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
                            <button onClick={() => startEditTariff(t)} className="text-gray-400 hover:text-indigo-600 text-sm px-1">✏️</button>
                            <button onClick={() => deleteTariff(t.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
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

      {/* ── Участники ── */}
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

        {showRegForm && canEdit && (() => {
          const groups = Array.from(new Set(students.map(s => s.group_name || 'Без группы'))).sort()
          const studentsInGroup = selectedGroup
            ? students.filter(s => (s.group_name || 'Без группы') === selectedGroup)
            : []
          const selectedStu = students.find(s => s.id === selectedStudentId)
          return (
            <form onSubmit={addRegistration} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-3 space-y-3">
              {/* Тип участника */}
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setRegForm({ ...regForm, is_external: false }); setSelectedStudentId(''); setSelectedGroup('') }}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all
                    ${!regForm.is_external ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                  Наш ученик
                </button>
                <button type="button"
                  onClick={() => { setRegForm({ ...regForm, is_external: true }); setSelectedStudentId(''); setSelectedGroup('') }}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all
                    ${regForm.is_external ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                  Внешний
                </button>
              </div>

              {!regForm.is_external ? (
                /* Выбор из списка учеников */
                <div className="space-y-2">
                  <select value={selectedGroup} onChange={e => { setSelectedGroup(e.target.value); setSelectedStudentId('') }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
                    <option value="">Выберите группу</option>
                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  {selectedGroup && (
                    <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
                      <option value="">Выберите ученика</option>
                      {studentsInGroup.map(s => (
                        <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ''}</option>
                      ))}
                    </select>
                  )}
                  {selectedStu && (
                    <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700">
                      ✓ {selectedStu.name} · {selectedStu.group_name || '—'}
                    </div>
                  )}
                  <input value={regForm.participant_telegram} onChange={e => setRegForm({ ...regForm, participant_telegram: e.target.value })}
                    placeholder="Telegram (@..., необязательно)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
                </div>
              ) : (
                /* Ввод вручную для внешних */
                <div className="space-y-2">
                  <input required value={regForm.participant_name} onChange={e => setRegForm({ ...regForm, participant_name: e.target.value })}
                    placeholder="Фамилия Имя *" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
                  <input value={regForm.participant_phone} onChange={e => setRegForm({ ...regForm, participant_phone: e.target.value })}
                    placeholder="Телефон" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
                  <input value={regForm.participant_telegram} onChange={e => setRegForm({ ...regForm, participant_telegram: e.target.value })}
                    placeholder="Ник в Telegram (@...)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
                  <select value={regForm.school_status} onChange={e => setRegForm({ ...regForm, school_status: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
                    <option value="">Статус (необязательно)</option>
                    <option value="parent">Родитель/родственник ученика</option>
                    <option value="external">Не занимается у нас</option>
                  </select>
                </div>
              )}

              {/* Тариф — общее */}
              <select value={regForm.tariff_id} onChange={e => setRegForm({ ...regForm, tariff_id: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
                <option value="">Выберите тариф</option>
                {tariffs.map(t => <option key={t.id} value={t.id}>{t.name} — {currentPrice(t).toLocaleString('ru')} ₽</option>)}
              </select>

              <div className="flex gap-2">
                <button type="submit"
                  disabled={saving === 'reg' || (!regForm.is_external && !selectedStudentId) || (!regForm.is_external ? false : !regForm.participant_name)}
                  className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-40">
                  {saving === 'reg' ? 'Сохранение...' : 'Добавить участника'}
                </button>
                <button type="button" onClick={() => { setShowRegForm(false); setSelectedGroup(''); setSelectedStudentId('') }}
                  className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm">
                  Отмена
                </button>
              </div>
            </form>
          )
        })()}

        {regs.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-8 bg-gray-50 rounded-xl">Заявок пока нет</div>
        ) : (
          <div className="space-y-2">
            {regs.map(r => {
              const st = STATUS_LABELS[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-500' }
              const totalR = (r.deposit_amount || 0) + (r.total_paid || 0)
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
                        {totalR > 0 ? ` · внесено ${totalR.toLocaleString('ru')} ₽` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      <span className="text-gray-300">›</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
