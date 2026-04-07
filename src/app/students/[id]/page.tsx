'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { localDateStr } from '@/lib/dates'

type Student = {
  id: string
  name: string
  phone: string | null
  birth_date: string | null
  enrollment_date: string | null
  group_name: string | null
  status: string
  parent_token: string | null
  cabinet_token: string | null
  health_notes: string | null
  invite_token: string | null
  telegram_chat_id: number | null
  photo_url: string | null
}

type Contact = {
  id: string
  name: string
  role: string
  phone: string | null
  telegram_chat_id: number | null
  invite_token: string
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  active:    { label: 'Активен',       color: 'bg-green-100 text-green-700' },
  suspended: { label: 'Приостановлен', color: 'bg-yellow-100 text-yellow-700' },
  banned:    { label: 'Заблокирован',  color: 'bg-red-100 text-red-700' },
  archived:  { label: 'Архив',         color: 'bg-gray-100 text-gray-500' },
}

type Subscription = {
  id: string
  type: string
  sessions_total: number | null
  sessions_left: number | null
  start_date: string | null
  end_date: string | null
  paid: boolean
  amount: number | null
  bonuses: Record<string, number> | null
  bonuses_used: Record<string, number | string[]> | null
  is_frozen: boolean
  freeze_start: string | null
  freeze_end: string | null
  freeze_days_used: number
  is_pending: boolean
  payment_id: string | null
}

type Attendance = {
  id: string
  date: string
  present: boolean
}

type Belt = {
  id: string
  belt_name: string
  date: string
  notes: string | null
  discipline: string | null
}

type StudentTicket = {
  id: string
  student_id: string
  type: string
  description: string | null
  status: 'pending' | 'in_review' | 'resolved'
  created_at: string
}

const TICKET_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  'болезнь': { label: 'Болезнь',  color: 'bg-red-100 text-red-700' },
  'перенос': { label: 'Перенос',  color: 'bg-yellow-100 text-yellow-700' },
  'жалоба':  { label: 'Жалоба',   color: 'bg-orange-100 text-orange-700' },
  'вопрос':  { label: 'Вопрос',   color: 'bg-blue-100 text-blue-700' },
}

const TICKET_STATUS_LABELS: Record<string, string> = {
  pending:   'Новое',
  in_review: 'В работе',
  resolved:  'Решено',
}

const TICKET_STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  resolved:  'bg-green-100 text-green-700',
}

const TICKET_STATUS_NEXT: Record<string, 'in_review' | 'resolved'> = {
  pending:   'in_review',
  in_review: 'resolved',
}

const GROUPS = ['Старт', 'Основная (нач.)', 'Основная (оп.)', 'Цигун', 'Индивидуальные']
// Ушу
const WUSHU_BELTS = [
  'Белый — 10 туди',
  'Жёлтый — 9 туди',
  'Розовый — 8 туди',
  'Зелёный — 7 туди',
  'Оранжевый — 6 туди',
  'Фиолетовый — 5 туди',
  'Голубой — 4 туди',
  'Синий — 3 туди',
  'Коричневый — 2 туди',
  'Красный — 1 степень',
]

const WUSHU_BELT_COLORS: Record<string, string> = {
  'Белый — 10 туди':      'bg-gray-100 text-gray-700',
  'Жёлтый — 9 туди':     'bg-yellow-100 text-yellow-700',
  'Розовый — 8 туди':    'bg-pink-100 text-pink-700',
  'Зелёный — 7 туди':    'bg-green-100 text-green-700',
  'Оранжевый — 6 туди':  'bg-orange-100 text-orange-700',
  'Фиолетовый — 5 туди': 'bg-purple-100 text-purple-700',
  'Голубой — 4 туди':    'bg-sky-100 text-sky-700',
  'Синий — 3 туди':      'bg-blue-100 text-blue-700',
  'Коричневый — 2 туди': 'bg-amber-100 text-amber-800',
  'Красный — 1 степень': 'bg-red-100 text-red-700',
}

// Айкидо: детские кю (11–7) → взрослые кю (6–1) → даны
const BELTS = [
  // Детские
  'Белый (дет.)',
  'Жёлтый с белой нашивкой — 11 кю',
  'Оранжевый с белой нашивкой — 10 кю',
  'Зелёный с белой нашивкой — 9 кю',
  'Синий с белой нашивкой — 8 кю',
  'Коричневый с белой нашивкой — 7 кю',
  // Взрослые кю
  'Белый — 6 кю',
  'Жёлтый — 5 кю',
  'Оранжевый — 4 кю',
  'Зелёный — 3 кю',
  'Синий — 2 кю',
  'Коричневый — 1 кю',
  // Даны
  'Чёрный — 1 дан',
  'Чёрный — 2 дан',
  'Чёрный — 3 дан',
  'Чёрный — 4 дан',
]

const BELT_COLORS: Record<string, string> = {
  'Белый (дет.)':                          'bg-gray-100 text-gray-700',
  'Жёлтый с белой нашивкой — 11 кю':      'bg-yellow-100 text-yellow-700',
  'Оранжевый с белой нашивкой — 10 кю':   'bg-orange-100 text-orange-700',
  'Зелёный с белой нашивкой — 9 кю':      'bg-green-100 text-green-700',
  'Синий с белой нашивкой — 8 кю':        'bg-blue-100 text-blue-700',
  'Коричневый с белой нашивкой — 7 кю':   'bg-amber-100 text-amber-800',
  'Белый — 6 кю':                          'bg-gray-100 text-gray-700',
  'Жёлтый — 5 кю':                         'bg-yellow-100 text-yellow-700',
  'Оранжевый — 4 кю':                      'bg-orange-100 text-orange-700',
  'Зелёный — 3 кю':                        'bg-green-100 text-green-700',
  'Синий — 2 кю':                          'bg-blue-100 text-blue-700',
  'Коричневый — 1 кю':                     'bg-amber-100 text-amber-800',
  'Чёрный — 1 дан':                        'bg-gray-800 text-white',
  'Чёрный — 2 дан':                        'bg-gray-800 text-white',
  'Чёрный — 3 дан':                        'bg-gray-800 text-white',
  'Чёрный — 4 дан':                        'bg-gray-800 text-white',
}

function SurveySummaryRow({ s, qualities, labels }: { s: any; qualities: string[]; labels: Record<string, string> }) {
  const [open, setOpen] = useState(false)
  const avgTrainer = qualities.reduce((sum, k) => sum + (s[`trainer_${k}`] ?? 0), 0) / qualities.filter(k => s[`trainer_${k}`] != null).length || null
  const avgParent = qualities.reduce((sum, k) => sum + (s[`q_${k}`] ?? 0), 0) / qualities.filter(k => s[`q_${k}`] != null).length || null
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-50" onClick={() => setOpen(v => !v)}>
        <span className="flex-1 text-xs font-medium text-gray-700">{s.title || `Срез ${s.survey_number || ''}`}</span>
        {s.filled_at
          ? <span className="text-xs text-green-600 mr-2">✓</span>
          : <span className="text-xs text-gray-400 mr-2">—</span>
        }
        {avgTrainer != null && <span className="text-xs text-gray-500 mr-1">т:{avgTrainer.toFixed(1)}</span>}
        {avgParent != null && <span className="text-xs text-gray-500 mr-2">р:{avgParent.toFixed(1)}</span>}
        <span className="text-xs text-gray-300">{open ? '▲' : '▼'}</span>
      </button>
      {open && s.filled_at && (
        <div className="px-3 pb-2.5 text-xs grid grid-cols-2 gap-x-4 gap-y-1">
          {qualities.map(k => {
            const t = s[`trainer_${k}`]; const r = s[`q_${k}`]
            return t != null || r != null ? (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{labels[k]}</span>
                <span className="font-medium text-gray-700">{t ?? '—'} / {r ?? '—'}</span>
              </div>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}

export default function StudentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { role, permissions } = useAuth()
  const canViewCabinet = role === 'founder' || permissions.includes('students.cabinet')
  const [student, setStudent] = useState<Student | null>(null)
  const [subs, setSubs] = useState<Subscription[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [belts, setBelts] = useState<Belt[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Student>>({})
  const [showSubForm, setShowSubForm] = useState(false)
  const [subForm, setSubForm] = useState({ type: '', sessions_total: '', start_date: '', end_date: '', amount: '', paid: false, is_pending: false, bonuses: {} as Record<string, number>, installment: false, deposit_amount: '', installment_payments: [] as { amount: string; due_date: string }[], payment_type: 'cash', record_in_finance: true })
  const [addToFinanceSub, setAddToFinanceSub] = useState<Subscription | null>(null)
  const [addToFinancePaymentType, setAddToFinancePaymentType] = useState<'cash' | 'card'>('cash')
  const [showBeltForm, setShowBeltForm] = useState<'aikido' | 'wushu' | null>(null)
  const [beltForm, setBeltForm] = useState({ belt_name: '', date: new Date().toISOString().split('T')[0], notes: '' })
  const [subTypes, setSubTypes] = useState<{ id: string; name: string; group_type: string | null; sessions_count: number | null; price: number | null; price_per_session: number | null; bonus_total_value: number | null; is_for_newcomers: boolean | null; is_hidden: boolean | null; bonuses: Record<string, number> | null; duration_months: number | null }[]>([])
  const [showQR, setShowQR] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editSubId, setEditSubId] = useState<string | null>(null)
  const [editSubForm, setEditSubForm] = useState({ sessions_total: '', sessions_left: '', start_date: '', end_date: '', amount: '', paid: false })
  const [freezeSubId, setFreezeSubId] = useState<string | null>(null)
  const [freezeForm, setFreezeForm] = useState({ freeze_start: '', freeze_end: '' })
  const [bonusDatePicker, setBonusDatePicker] = useState<{ subId: string; bonusName: string } | null>(null)
  const [bonusDate, setBonusDate] = useState(new Date().toISOString().split('T')[0])
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketForm, setTicketForm] = useState({ type: '', description: '' })
  const [studentTickets, setStudentTickets] = useState<StudentTicket[]>([])
  const [showAddAttendance, setShowAddAttendance] = useState(false)
  const [addAttDate, setAddAttDate] = useState(new Date().toISOString().split('T')[0])
  const [editingAttId, setEditingAttId] = useState<string | null>(null)
  const [editingAttDate, setEditingAttDate] = useState('')
  const [showBulkAtt, setShowBulkAtt] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkPresent, setBulkPresent] = useState(true)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkMonth, setBulkMonth] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() } })
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', role: 'мама', phone: '' })
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [editContactForm, setEditContactForm] = useState({ name: '', role: 'мама', phone: '' })
  const [survey, setSurvey] = useState<any>(null)
  const [showSurvey, setShowSurvey] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState(false)
  const [surveyForm, setSurveyForm] = useState<any>({})
  const [progressSurveys, setProgressSurveys] = useState<any[]>([])
  const [showProgressTrainer, setShowProgressTrainer] = useState(false)
  const [editingProgressTrainer, setEditingProgressTrainer] = useState(false)
  const [progressTrainerForm, setProgressTrainerForm] = useState<Record<string, any>>({})
  const [savingProgressTrainer, setSavingProgressTrainer] = useState(false)
  const [studentProfile, setStudentProfile] = useState<any>(null)
  const [compareProgram, setCompareProgram] = useState('')
  const [generatingCompare, setGeneratingCompare] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [payments, setPayments] = useState<{ id: string; amount: number; category: string | null; paid_at: string; payment_type: string; description: string | null }[]>([])

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: sb }, { data: at }, { data: bl }, { data: st }, { data: ct }, { data: sv }, { data: ps }, { data: sp }, { data: py }, { data: tk }] = await Promise.all([
        supabase.from('students').select('*').eq('id', id).single(),
        supabase.from('subscriptions').select('*').eq('student_id', id).order('created_at', { ascending: false }),
        supabase.from('attendance').select('*').eq('student_id', id).order('date', { ascending: false }),
        supabase.from('belts').select('*').eq('student_id', id).order('date', { ascending: false }),
        supabase.from('subscription_types').select('id, name, group_type, sessions_count, price, price_per_session, bonus_total_value, is_for_newcomers, is_hidden, bonuses, duration_months').order('created_at'),
        supabase.from('student_contacts').select('*').eq('student_id', id).order('created_at'),
        supabase.from('diagnostic_surveys').select('*').eq('student_id', id).maybeSingle(),
        supabase.from('progress_surveys').select('*').eq('student_id', id).order('created_at', { ascending: false }),
        supabase.from('student_profiles').select('*').eq('student_id', id).maybeSingle(),
        supabase.from('payments').select('id, amount, category, paid_at, payment_type, description').eq('student_id', id).order('paid_at', { ascending: false }).limit(20),
        supabase.from('tickets').select('*').eq('student_id', id).order('created_at', { ascending: false }),
      ])
      if (s) { setStudent(s); setForm(s) }
      setSubs(sb || [])
      setAttendance(at || [])
      setBelts(bl || [])
      setSubTypes(st || [])
      setContacts(ct || [])
      setSurvey(sv || null)
      const surveys = ps || []
      setProgressSurveys(surveys)
      if (surveys[0]) {
        const latest = surveys[0]
        const init: Record<string, any> = { trainer_notes: latest.trainer_notes || '' }
        const PQ = ['strength','speed','endurance','agility','coordination','posture','flexibility','discipline','sociability','confidence','learnability','attentiveness','emotional_balance','goal_orientation','activity','self_defense']
        PQ.forEach(k => { init[`trainer_${k}`] = latest[`trainer_${k}`] ?? 5 })
        setProgressTrainerForm(init)
      }
      if (sp) setStudentProfile(sp)
      setPayments(py || [])
      setStudentTickets(tk || [])
    }
    load()
  }, [id])

  async function saveStudent() {
    setSaving(true)
    await supabase.from('students').update({
      name: form.name,
      phone: form.phone || null,
      birth_date: form.birth_date || null,
      enrollment_date: form.enrollment_date || null,
      group_name: form.group_name || null,
      status: form.status || 'active',
      health_notes: form.health_notes || null,
    }).eq('id', id)
    setStudent(prev => prev ? { ...prev, ...form } as Student : null)
    setEditing(false)
    setSaving(false)
  }

  async function addSubscription(e: React.FormEvent) {
    e.preventDefault()
    const sessions = subForm.sessions_total ? parseInt(subForm.sessions_total) : null

    // Count attended classes from start_date to deduct automatically
    let attended = 0
    if (sessions !== null && subForm.start_date) {
      const { data: attData } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', id)
        .eq('present', true)
        .gte('date', subForm.start_date)
      attended = attData?.length ?? 0
    }

    const sessionsLeft = sessions !== null ? Math.max(0, sessions - attended) : null

    // Создать запись в финансах если нужно
    let paymentId: string | null = null
    const amount = subForm.amount ? parseFloat(subForm.amount) : null
    if (subForm.record_in_finance && !subForm.is_pending && amount) {
      const paymentAmount = subForm.installment
        ? (parseFloat(subForm.deposit_amount) || 0)
        : amount
      const { data: payData } = await supabase.from('payments').insert({
        student_id: id,
        direction: 'income',
        category: 'Абонементы',
        amount: paymentAmount,
        payment_type: subForm.payment_type,
        description: subForm.type.includes('|') ? subForm.type.split('|')[1] : subForm.type,
        paid_at: subForm.start_date || new Date().toISOString().split('T')[0],
        status: 'paid',
      }).select('id').single()
      if (payData) paymentId = payData.id
    }

    const { data } = await supabase.from('subscriptions').insert({
      student_id: id,
      type: subForm.type,
      sessions_total: sessions,
      sessions_left: sessionsLeft,
      start_date: subForm.start_date || null,
      end_date: subForm.end_date || null,
      amount: subForm.amount ? parseFloat(subForm.amount) : null,
      paid: subForm.paid,
      is_pending: subForm.is_pending,
      bonuses: subForm.bonuses,
      bonuses_used: {},
      payment_id: paymentId,
    }).select().single()

    if (data) {
      setSubs(prev => [data, ...prev])
      if (attended > 0) {
        alert(`✅ Абонемент добавлен.\n\nАвтоматически списано ${attended} занят. (с ${subForm.start_date}).\nОсталось: ${sessionsLeft} из ${sessions}.`)
      }
      // Создать рассрочку если галочка стоит
      if (subForm.installment && subForm.installment_payments.length > 0) {
        const { data: plan } = await supabase.from('installment_plans').insert({
          subscription_id: data.id,
          total_amount: parseFloat(subForm.amount) || 0,
          deposit_amount: parseFloat(subForm.deposit_amount) || 0,
          deposit_paid_at: new Date().toISOString().split('T')[0],
          status: 'active',
        }).select().single()
        if (plan) {
          await supabase.from('installment_payments').insert(
            subForm.installment_payments
              .filter(p => p.amount && p.due_date)
              .map(p => ({ plan_id: plan.id, amount: parseFloat(p.amount), due_date: p.due_date, status: 'pending' }))
          )
        }
      }
    }
    setShowSubForm(false)
    setSubForm({ type: '', sessions_total: '', start_date: '', end_date: '', amount: '', paid: false, is_pending: false, bonuses: {}, installment: false, deposit_amount: '', installment_payments: [], payment_type: 'cash', record_in_finance: true })
  }

  async function addExistingSubToFinance(sub: Subscription, paymentType: 'cash' | 'card') {
    if (!sub.amount) return
    const { data: payData } = await supabase.from('payments').insert({
      student_id: id,
      direction: 'income',
      category: 'Абонементы',
      amount: sub.amount,
      payment_type: paymentType,
      description: sub.type.includes('|') ? sub.type.split('|')[1] : sub.type,
      paid_at: sub.start_date || new Date().toISOString().split('T')[0],
      status: 'paid',
    }).select('id').single()
    if (payData) {
      await supabase.from('subscriptions').update({ payment_id: payData.id }).eq('id', sub.id)
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, payment_id: payData.id } : s))
    }
    setAddToFinanceSub(null)
  }

  async function activatePendingSub(sub: Subscription) {
    await supabase.from('subscriptions').update({ is_pending: false }).eq('id', sub.id)
    setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, is_pending: false } : s))
  }

  async function freezeSubscription(e: React.FormEvent, sub: Subscription) {
    e.preventDefault()
    if (!freezeForm.freeze_start || !freezeForm.freeze_end) return
    const start = new Date(freezeForm.freeze_start)
    const end = new Date(freezeForm.freeze_end)
    const days = Math.round((end.getTime() - start.getTime()) / 86400000)
    if (days <= 0) return alert('Дата окончания должна быть позже начала')
    if (days > 30) return alert('Максимум 30 дней заморозки')
    if ((sub.freeze_days_used || 0) > 0) return alert('Заморозка уже использована для этого абонемента')

    // Extend end_date by freeze days
    const newEndDate = sub.end_date
      ? new Date(new Date(sub.end_date).getTime() + days * 86400000).toISOString().split('T')[0]
      : null

    const payload = {
      is_frozen: true,
      freeze_start: freezeForm.freeze_start,
      freeze_end: freezeForm.freeze_end,
      freeze_days_used: days,
      end_date: newEndDate,
    }
    await supabase.from('subscriptions').update(payload).eq('id', sub.id)
    setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, ...payload } : s))
    setFreezeSubId(null)
    setFreezeForm({ freeze_start: '', freeze_end: '' })
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault()
    const { data } = await supabase.from('tickets').insert({
      student_id: id,
      type: ticketForm.type,
      description: ticketForm.description || null,
      status: 'pending',
    }).select().single()
    if (data) setStudentTickets(prev => [data, ...prev])
    setShowTicketForm(false)
    setTicketForm({ type: '', description: '' })
  }

  async function advanceTicket(ticket: StudentTicket) {
    if (ticket.status === 'resolved') return
    const next = TICKET_STATUS_NEXT[ticket.status]
    await supabase.from('tickets').update({ status: next }).eq('id', ticket.id)
    setStudentTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: next } : t))
  }

  async function addAttendance(present: boolean) {
    const { data, error } = await supabase.from('attendance').upsert(
      { student_id: id, date: addAttDate, group_name: student?.group_name, present },
      { onConflict: 'student_id,date' }
    ).select().maybeSingle()
    if (error) { alert('Ошибка: ' + error.message); return }

    // Deduct session from active subscription if present
    if (present) {
      const activeSub = subs.find(s => s.sessions_left !== null && s.sessions_left > 0)
      if (activeSub) {
        await supabase.from('subscriptions')
          .update({ sessions_left: activeSub.sessions_left! - 1 })
          .eq('id', activeSub.id)
        setSubs(prev => prev.map(s => s.id === activeSub.id
          ? { ...s, sessions_left: s.sessions_left! - 1 }
          : s))
      }
    }

    // Refresh attendance list
    const newRecord = { id: data?.id ?? Date.now().toString(), date: addAttDate, present }
    setAttendance(prev => {
      const filtered = prev.filter(a => a.date !== addAttDate)
      return [newRecord, ...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20)
    })
    setShowAddAttendance(false)
    setAddAttDate(new Date().toISOString().split('T')[0])
  }

  async function addBulkAttendance() {
    const dates = Array.from(bulkSelected).sort()
    if (dates.length === 0) return
    setBulkSaving(true)
    const rows = dates.map(date => ({
      student_id: id,
      date,
      group_name: student?.group_name,
      present: bulkPresent,
    }))
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' })
    if (error) { alert('Ошибка: ' + error.message); setBulkSaving(false); return }

    // Deduct sessions from subscription if present
    if (bulkPresent) {
      const activeSub = subs.find(s => s.sessions_left !== null && s.sessions_left > 0)
      if (activeSub) {
        const newLeft = Math.max(0, activeSub.sessions_left! - dates.length)
        await supabase.from('subscriptions').update({ sessions_left: newLeft }).eq('id', activeSub.id)
        setSubs(prev => prev.map(s => s.id === activeSub.id ? { ...s, sessions_left: newLeft } : s))
      }
    }

    // Reload attendance
    const { data: atData } = await supabase.from('attendance').select('*').eq('student_id', id).order('date', { ascending: false })
    if (atData) setAttendance(atData)
    setShowBulkAtt(false)
    setBulkSelected(new Set())
    setBulkSaving(false)
  }

  async function deleteAttendance(a: Attendance) {
    if (!confirm(`Удалить запись о посещении ${a.date}?`)) return
    await supabase.from('attendance').delete().eq('id', a.id)
    // Return session if student was present
    if (a.present) {
      const { data: sub } = await supabase.from('subscriptions').select('id, sessions_left')
        .eq('student_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (sub && sub.sessions_left !== null) {
        await supabase.from('subscriptions').update({ sessions_left: sub.sessions_left + 1 }).eq('id', sub.id)
        setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, sessions_left: sub.sessions_left + 1 } : s))
      }
    }
    setAttendance(prev => prev.filter(x => x.id !== a.id))
  }

  async function saveAttendanceDate(a: Attendance, newDate: string) {
    if (!newDate || newDate === a.date) { setEditingAttId(null); return }
    await supabase.from('attendance').update({ date: newDate }).eq('id', a.id)
    setAttendance(prev =>
      prev.map(x => x.id === a.id ? { ...x, date: newDate } : x)
        .sort((a, b) => b.date.localeCompare(a.date))
    )
    setEditingAttId(null)
  }

  async function unfreezeSubscription(sub: Subscription) {
    if (!confirm('Снять заморозку? Срок абонемента останется продлённым.')) return
    await supabase.from('subscriptions').update({ is_frozen: false }).eq('id', sub.id)
    setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, is_frozen: false } : s))
  }

  function calcEndDate(startDate: string, durationMonths: number): string {
    const d = new Date(startDate)
    const fullMonths = Math.floor(durationMonths)
    const extraDays = Math.round((durationMonths - fullMonths) * 30)
    d.setMonth(d.getMonth() + fullMonths)
    d.setDate(d.getDate() + extraDays)
    return d.toISOString().split('T')[0]
  }

  function startEditSub(s: Subscription) {
    setEditSubId(s.id)
    setEditSubForm({
      sessions_total: s.sessions_total?.toString() || '',
      sessions_left: s.sessions_left?.toString() || '',
      start_date: s.start_date || '',
      end_date: s.end_date || '',
      amount: s.amount?.toString() || '',
      paid: s.paid,
    })
  }

  async function saveEditSub(e: React.FormEvent) {
    e.preventDefault()
    if (!editSubId) return
    const payload = {
      sessions_total: editSubForm.sessions_total ? parseInt(editSubForm.sessions_total) : null,
      sessions_left: editSubForm.sessions_left ? parseInt(editSubForm.sessions_left) : null,
      start_date: editSubForm.start_date || null,
      end_date: editSubForm.end_date || null,
      amount: editSubForm.amount ? parseFloat(editSubForm.amount) : null,
      paid: editSubForm.paid,
    }
    await supabase.from('subscriptions').update(payload).eq('id', editSubId)
    setSubs(prev => prev.map(s => s.id === editSubId ? { ...s, ...payload } : s))
    setEditSubId(null)
  }

  function getBonusUsedDates(bonusesUsed: Record<string, number | string[]> | null, key: string): string[] {
    const val = bonusesUsed?.[key]
    if (!val) return []
    if (Array.isArray(val)) return val
    // старый формат — число без дат
    return Array.from({ length: val as number }, () => '')
  }

  async function useBonus(subId: string, bonusName: string, bonuses: Record<string, number>, bonusesUsed: Record<string, number | string[]>, date: string) {
    const total = bonuses[bonusName] || 0
    const usedDates = getBonusUsedDates(bonusesUsed, bonusName)
    if (usedDates.length >= total) return
    const newUsed = { ...bonusesUsed, [bonusName]: [...usedDates.filter(d => d !== ''), date] }
    await supabase.from('subscriptions').update({ bonuses_used: newUsed }).eq('id', subId)
    setSubs(prev => prev.map(s => s.id === subId ? { ...s, bonuses_used: newUsed } : s))
  }

  async function cancelBonus(subId: string, bonusName: string, bonusesUsed: Record<string, number | string[]>, index: number) {
    const usedDates = getBonusUsedDates(bonusesUsed, bonusName)
    const newDates = usedDates.filter((_, i) => i !== index)
    const newUsed = { ...bonusesUsed, [bonusName]: newDates }
    await supabase.from('subscriptions').update({ bonuses_used: newUsed }).eq('id', subId)
    setSubs(prev => prev.map(s => s.id === subId ? { ...s, bonuses_used: newUsed } : s))
  }

  async function togglePaid(subId: string, paid: boolean) {
    await supabase.from('subscriptions').update({ paid: !paid }).eq('id', subId)
    setSubs(prev => prev.map(s => s.id === subId ? { ...s, paid: !paid } : s))
  }

  async function addBelt(e: React.FormEvent, discipline: 'aikido' | 'wushu') {
    e.preventDefault()
    const { data } = await supabase.from('belts').insert({
      student_id: id,
      belt_name: beltForm.belt_name,
      date: beltForm.date,
      notes: beltForm.notes || null,
      discipline,
    }).select().single()
    if (data) setBelts(prev => [data, ...prev])
    setShowBeltForm(null)
    setBeltForm({ belt_name: '', date: new Date().toISOString().split('T')[0], notes: '' })
  }

  async function deleteBelt(beltId: string) {
    await supabase.from('belts').delete().eq('id', beltId)
    setBelts(prev => prev.filter(b => b.id !== beltId))
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    const { data } = await supabase.from('student_contacts').insert({
      student_id: id,
      name: contactForm.name,
      role: contactForm.role,
      phone: contactForm.phone || null,
    }).select().single()
    if (data) setContacts(prev => [...prev, data])
    setShowAddContact(false)
    setContactForm({ name: '', role: 'мама', phone: '' })
  }

  async function deleteContact(contactId: string) {
    if (!confirm('Удалить контакт?')) return
    await supabase.from('student_contacts').delete().eq('id', contactId)
    setContacts(prev => prev.filter(c => c.id !== contactId))
  }

  function startEditContact(c: Contact) {
    setEditingContactId(c.id)
    setEditContactForm({ name: c.name, role: c.role, phone: c.phone || '' })
  }

  async function saveEditContact(e: React.FormEvent) {
    e.preventDefault()
    if (!editingContactId) return
    const { data } = await supabase.from('student_contacts')
      .update({ name: editContactForm.name, role: editContactForm.role, phone: editContactForm.phone || null })
      .eq('id', editingContactId)
      .select().single()
    if (data) setContacts(prev => prev.map(c => c.id === editingContactId ? { ...c, ...data } : c))
    setEditingContactId(null)
  }

  function copyContactInviteLink(contact: Contact) {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_BOT_USERNAME
    const link = `https://t.me/${botUsername}?start=${contact.invite_token}`
    navigator.clipboard.writeText(link)
    alert(`Ссылка для ${contact.name} скопирована!\n\n${link}`)
  }

  async function sendContactReminder(contact: Contact) {
    if (!student) return
    const activeSub = subs[0]
    const subInfo = activeSub?.sessions_left != null
      ? `Осталось занятий: ${activeSub.sessions_left}`
      : activeSub?.end_date ? `Абонемент до: ${activeSub.end_date}` : 'Абонемент не найден'
    const message = `👋 Школа Самурая\n\nУченик: <b>${student.name}</b>\nГруппа: ${student.group_name || '—'}\n${subInfo}`
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: contact.telegram_chat_id, message }),
    })
    alert(`Сообщение отправлено ${contact.name}!`)
  }

  async function copySurveyLink() {
    let { data: existing } = await supabase
      .from('diagnostic_surveys')
      .select('survey_token')
      .eq('student_id', id)
      .maybeSingle()
    if (!existing) {
      const { data } = await supabase
        .from('diagnostic_surveys')
        .insert({ student_id: id })
        .select('survey_token')
        .single()
      existing = data
    }
    if (!existing) return alert('Ошибка создания анкеты')
    const url = `${window.location.origin}/survey/${existing.survey_token}`
    navigator.clipboard.writeText(url)
    alert(`Ссылка скопирована!\n\nОтправьте родителю:\n${url}`)
  }

  function startEditSurvey() {
    setSurveyForm({ ...survey })
    setEditingSurvey(true)
    setShowSurvey(true)
  }

  // --- Анкета прогресса (Анкета 2) ---
  const PROGRESS_QUALITIES = ['strength','speed','endurance','agility','coordination','posture','flexibility','discipline','sociability','confidence','learnability','attentiveness','emotional_balance','goal_orientation','activity','self_defense']
  const PROGRESS_QUALITY_LABELS: Record<string, string> = { strength:'Сила',speed:'Быстрота',endurance:'Выносливость',agility:'Ловкость',coordination:'Координация',posture:'Осанка',flexibility:'Гибкость',discipline:'Дисциплина',sociability:'Общительность',confidence:'Уверенность',learnability:'Обучаемость',attentiveness:'Внимательность',emotional_balance:'Уравновешенность',goal_orientation:'Целеустремлённость',activity:'Активность',self_defense:'Самозащита' }

  async function createProgressSurvey() {
    const res = await fetch('/api/create-repeat-survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: id, initiated_by: 'trainer' }),
    })
    const data = await res.json()
    if (res.status === 409) { alert('Уже есть незаполненный срез'); return }
    if (data.ok) {
      // Перезагружаем список срезов
      const { data: fresh } = await supabase.from('progress_surveys').select('*').eq('student_id', id).order('created_at', { ascending: false })
      setProgressSurveys(fresh || [])
      const init: Record<string, any> = { trainer_notes: '' }
      PROGRESS_QUALITIES.forEach(k => { init[`trainer_${k}`] = 5 })
      setProgressTrainerForm(init)
      setEditingProgressTrainer(true)
    }
  }

  async function saveProgressTrainer() {
    const activeSurvey = progressSurveys[0]
    if (!activeSurvey) return
    setSavingProgressTrainer(true)
    const payload = { ...progressTrainerForm, trainer_filled_at: new Date().toISOString() }
    const { data } = await supabase.from('progress_surveys').update(payload).eq('id', activeSurvey.id).select().single()
    if (data) setProgressSurveys(prev => [data, ...prev.slice(1)])
    setEditingProgressTrainer(false)
    setSavingProgressTrainer(false)
  }

  async function copyProgressLink(forWho: 'parent' | 'student') {
    const activeSurvey = progressSurveys[0]
    if (!activeSurvey) return
    const url = `${window.location.origin}/survey2/${activeSurvey.survey_token}`
    const studentName = student?.name || 'ученика'
    const surveyTitle = activeSurvey.title || 'срез прогресса'

    let message = ''
    if (forWho === 'parent') {
      message = `Здравствуйте!\n\nДля ${studentName} в Школе Самурая подготовлен новый срез прогресса — "${surveyTitle}" 🥋\n\nТренер хочет узнать ваш взгляд. Это займёт 3–4 минуты.\n\nВаши ответы помогут:\n✅ Скорректировать программу под цели вашего ребёнка\n📊 Увидеть рост в цифрах\n🎯 Сфокусироваться на главном\n\nЗаполните анкету:\n${url}`
      await supabase.from('progress_surveys').update({ parent_sent_at: new Date().toISOString() }).eq('id', activeSurvey.id)
      setProgressSurveys(prev => [{ ...prev[0], parent_sent_at: new Date().toISOString() }, ...prev.slice(1)])
    } else {
      message = `Привет!\n\nДля тебя в Школе Самурая подготовлен новый срез — "${surveyTitle}" 🥋\n\nТренер хочет знать твоё мнение о своём прогрессе. Твои ощущения важны!\n\n💪 Программа будет скорректирована под твои цели\n\nЗаполни анкету:\n${url}`
      await supabase.from('progress_surveys').update({ student_sent_at: new Date().toISOString() }).eq('id', activeSurvey.id)
      setProgressSurveys(prev => [{ ...prev[0], student_sent_at: new Date().toISOString() }, ...prev.slice(1)])
    }

    navigator.clipboard.writeText(message)
    alert(`Текст скопирован!\n\nОтправьте ${forWho === 'parent' ? 'родителю' : 'ученику'} в Telegram или WhatsApp.`)
  }

  async function saveTrainingStartDate(date: string) {
    let prof = studentProfile
    if (!prof) {
      const { data } = await supabase.from('student_profiles').insert({ student_id: id }).select().single()
      prof = data
      if (prof) setStudentProfile(prof)
    }
    if (!prof) return
    await supabase.from('student_profiles').update({ training_start_date: date || null }).eq('id', prof.id)
    setStudentProfile({ ...prof, training_start_date: date || null })
  }

  async function sendProfileSurvey() {
    let prof = studentProfile
    if (!prof) {
      const { data } = await supabase.from('student_profiles').insert({ student_id: id }).select().single()
      prof = data
      if (prof) setStudentProfile(prof)
    }
    if (!prof) return alert('Ошибка создания анкеты')
    const url = `${window.location.origin}/survey3/${prof.survey_token}`
    const name = student?.name || 'ученика'
    const message = `Здравствуйте!\n\nДля оформления договора и ведения карточки ${name} в Школе Самурая просим заполнить анкету профиля.\n\nЭто займёт 4–5 минут. Все данные автоматически попадут в договор — ничего не придётся переписывать от руки.\n\nАнкета: ${url}`
    navigator.clipboard.writeText(message)
    alert('Текст скопирован! Отправьте родителю в Telegram или WhatsApp.')
  }

  async function saveSurvey() {
    const { data } = await supabase
      .from('diagnostic_surveys')
      .update(surveyForm)
      .eq('id', survey.id)
      .select()
      .single()
    if (data) setSurvey(data)
    setEditingSurvey(false)
  }

  async function deleteSurvey() {
    if (!confirm('Удалить анкету? Все данные будут потеряны.')) return
    await supabase.from('diagnostic_surveys').delete().eq('id', survey.id)
    setSurvey(null)
    setShowSurvey(false)
    setEditingSurvey(false)
  }

  function openStudentCabinet() {
    if (!student?.cabinet_token) return alert('Токен кабинета не найден')
    window.open(`${window.location.origin}/cabinet/${student.cabinet_token}?back=1`, '_blank')
  }

  function copyParentLink() {
    if (!student?.parent_token) return alert('Токен не найден')
    const url = `${window.location.origin}/parent/${student.parent_token}`
    navigator.clipboard.writeText(url)
    alert('Ссылка скопирована!\n' + url)
  }

  function copyStudentTelegramLink() {
    if (!student?.invite_token) return alert('Токен не найден')
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_BOT_USERNAME
    const link = `https://t.me/${botUsername}?start=${student.invite_token}`
    navigator.clipboard.writeText(link)
    alert(`Ссылка скопирована!\n\nОтправьте ученику:\n${link}\n\nПосле нажатия Telegram-бот автоматически привяжет его аккаунт.`)
  }

  function openWhatsApp() {
    if (!student?.phone) return alert('Телефон не указан')
    const phone = student.phone.replace(/\D/g, '')
    const activeSub = subs[0]
    const subInfo = activeSub?.sessions_left != null
      ? `Осталось занятий: ${activeSub.sessions_left}`
      : activeSub?.end_date
      ? `Абонемент до: ${activeSub.end_date}`
      : ''
    const text = encodeURIComponent(`Здравствуйте! Напоминаем о занятиях в Школе Самурая.\n${subInfo}`)
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
  }

  async function archive() {
    if (!confirm('Архивировать ученика?')) return
    await supabase.from('students').update({ status: 'archived' }).eq('id', id)
    router.push('/students')
  }

  if (!student) return <div className="text-center text-gray-400 py-12">Загрузка...</div>

  const presentCount = attendance.filter(a => a.present).length
  const currentBelt = belts[0]
  const checkinUrl = typeof window !== 'undefined' ? `${window.location.origin}/checkin/${id}` : ''

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !student) return
    setUploadingPhoto(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('student_id', id)
    const res = await fetch('/api/upload-photo', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) setStudent(prev => prev ? { ...prev, photo_url: data.url } : null)
    setUploadingPhoto(false)
    e.target.value = ''
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/students" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-800">Карточка ученика</h1>
          {student.status !== 'active' && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_INFO[student.status]?.color || ''}`}>
              {STATUS_INFO[student.status]?.label}
            </span>
          )}
        </div>
        <button onClick={() => setEditing(!editing)}
          className="ml-auto text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl">
          {editing ? 'Отмена' : 'Изменить'}
        </button>
      </div>

      {/* Student info */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center gap-3 mb-4">
          <label className="relative cursor-pointer group shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-600 border-2 border-transparent group-hover:border-black transition-colors">
              {student.photo_url ? (
                <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                <span>{student.name[0]}</span>
              )}
            </div>
            {uploadingPhoto && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!uploadingPhoto && (
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                <span className="text-white text-xs opacity-0 group-hover:opacity-100 font-medium">📷</span>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploadingPhoto} />
          </label>
          {editing ? (
            <input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-lg font-semibold outline-none" />
          ) : (
            <div>
              <div className="text-lg font-semibold text-gray-800">{student.name}</div>
              <div className="text-sm text-gray-400">{student.group_name || 'Группа не указана'}</div>
              {currentBelt && (
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${BELT_COLORS[currentBelt.belt_name] || 'bg-gray-100 text-gray-600'}`}>
                  {currentBelt.belt_name}
                </span>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})}
              placeholder="Телефон" type="tel"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <input value={form.birth_date || ''} onChange={e => setForm({...form, birth_date: e.target.value})}
              type="date" placeholder="Дата рождения"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <input value={form.enrollment_date || ''} onChange={e => setForm({...form, enrollment_date: e.target.value})}
              type="date" placeholder="Дата зачисления"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <select value={form.group_name || ''} onChange={e => setForm({...form, group_name: e.target.value})}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
              <option value="">Группа</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={form.status || 'active'} onChange={e => setForm({...form, status: e.target.value})}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
              <option value="active">Активен</option>
              <option value="suspended">Приостановлен</option>
              <option value="banned">Заблокирован</option>
              <option value="archived">Архив</option>
            </select>
            <textarea value={form.health_notes || ''} onChange={e => setForm({...form, health_notes: e.target.value})}
              placeholder="Здоровье / противопоказания" rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none" />
            <button onClick={saveStudent} disabled={saving}
              className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {student.phone && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Телефон</span>
                <div className="flex items-center gap-2">
                  <span>{student.phone}</span>
                  <button onClick={openWhatsApp}
                    className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    WA
                  </button>
                </div>
              </div>
            )}
            {student.birth_date && <div className="flex justify-between"><span className="text-gray-400">Дата рождения</span><span>{student.birth_date}</span></div>}
            {student.enrollment_date && <div className="flex justify-between"><span className="text-gray-400">В школе с</span><span>{student.enrollment_date}</span></div>}
            <div className="flex justify-between"><span className="text-gray-400">Посещений (последние 20)</span><span>{presentCount}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Статус</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_INFO[student.status]?.color || 'bg-gray-100 text-gray-500'}`}>
                {STATUS_INFO[student.status]?.label || student.status}
              </span>
            </div>
            {student.health_notes && (
              <div className="pt-1">
                <div className="text-gray-400 text-xs mb-1">Здоровье / противопоказания</div>
                <div className="text-sm text-orange-700 bg-orange-50 rounded-xl px-3 py-2">{student.health_notes}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR code */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-gray-800">QR-код для отметки</div>
          <button onClick={() => setShowQR(!showQR)}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1 rounded-xl">
            {showQR ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        {showQR && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="p-3 bg-white border border-gray-200 rounded-2xl">
              <QRCodeSVG value={checkinUrl} size={180} />
            </div>
            <div className="text-xs text-gray-400 text-center">Ученик сканирует — посещение записывается</div>
            <button onClick={() => { navigator.clipboard.writeText(checkinUrl); alert('Ссылка скопирована!') }}
              className="text-xs text-gray-500 underline">
              Скопировать ссылку
            </button>
          </div>
        )}
      </div>

      {/* Subscriptions */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800">Абонементы</div>
          <button onClick={() => setShowSubForm(!showSubForm)}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1 rounded-xl">
            + Добавить
          </button>
        </div>

        {showSubForm && (
          <form onSubmit={addSubscription} className="space-y-2 mb-4 p-3 bg-gray-50 rounded-xl">
            <select required value={subForm.type} onChange={e => {
                const selected = subTypes.find(t => `${t.group_type}|${t.name}` === e.target.value)
                const newEndDate = selected?.duration_months && subForm.start_date
                  ? calcEndDate(subForm.start_date, selected.duration_months)
                  : subForm.end_date
                setSubForm({
                  ...subForm,
                  type: e.target.value,
                  sessions_total: selected?.sessions_count?.toString() || subForm.sessions_total,
                  amount: selected?.price?.toString() || subForm.amount,
                  bonuses: selected?.bonuses || {},
                  end_date: newEndDate,
                })
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
              <option value="">Тип абонемента *</option>
              {Array.from(new Set(subTypes.map(t => t.group_type || 'Другие'))).map(group => {
                const items = subTypes.filter(t => (t.group_type || 'Другие') === group)
                if (!items.length) return null
                return <optgroup key={group} label={group}>
                  {items.map(t => (
                    <option key={t.id} value={`${t.group_type}|${t.name}`}>
                      {t.is_hidden ? '🔒 ' : ''}{t.name}{t.sessions_count ? ` (${t.sessions_count} зан.)` : ''}{t.price ? ` — ${t.price.toLocaleString()} ₽` : ''}
                    </option>
                  ))}
                </optgroup>
              })}
            </select>
            <input value={subForm.sessions_total} onChange={e => setSubForm({...subForm, sessions_total: e.target.value})}
              placeholder="Количество занятий" type="number"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <div className="flex gap-2">
              <input value={subForm.start_date} onChange={e => {
                  const start = e.target.value
                  const selected = subTypes.find(t => `${t.group_type}|${t.name}` === subForm.type)
                  const end = selected?.duration_months && start
                    ? calcEndDate(start, selected.duration_months)
                    : subForm.end_date
                  setSubForm({...subForm, start_date: start, end_date: end})
                }}
                type="date" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              <input value={subForm.end_date} onChange={e => setSubForm({...subForm, end_date: e.target.value})}
                type="date" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <input value={subForm.amount} onChange={e => setSubForm({...subForm, amount: e.target.value})}
              placeholder="Сумма (руб)" type="number"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={subForm.paid} onChange={e => setSubForm({...subForm, paid: e.target.checked})} />
              Оплачен
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={subForm.is_pending} onChange={e => setSubForm({...subForm, is_pending: e.target.checked})} />
              Отложенный (продан, но ещё не начался)
            </label>

            <div className="border-t border-gray-200 pt-2 space-y-2">
              <div className="text-xs font-medium text-gray-500">Финансы</div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setSubForm({...subForm, payment_type: 'cash'})}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${subForm.payment_type === 'cash' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
                  💵 Наличные
                </button>
                <button type="button"
                  onClick={() => setSubForm({...subForm, payment_type: 'card'})}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${subForm.payment_type === 'card' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
                  💳 Карта
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={subForm.record_in_finance}
                  onChange={e => setSubForm({...subForm, record_in_finance: e.target.checked})} />
                <span className={subForm.record_in_finance ? 'text-green-700 font-medium' : 'text-gray-400'}>
                  {subForm.record_in_finance ? '✓ Записать в финансы' : 'Не записывать в финансы (уже внесено вручную)'}
                </span>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={subForm.installment} onChange={e => setSubForm({...subForm, installment: e.target.checked, deposit_amount: e.target.checked && subForm.amount ? String(Math.round(parseFloat(subForm.amount) * 0.2)) : '', installment_payments: e.target.checked ? [{ amount: '', due_date: '' }] : []})} />
              Рассрочка
            </label>
            {subForm.installment && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
                <div>
                  <label className="text-xs text-blue-700 font-medium">Первоначальный взнос (аванс)</label>
                  <input value={subForm.deposit_amount} onChange={e => setSubForm({...subForm, deposit_amount: e.target.value})}
                    placeholder="Аванс (₽)" type="number" min="0"
                    className="w-full mt-1 border border-blue-200 rounded-lg px-3 py-1.5 text-sm outline-none bg-white" />
                </div>
                <div>
                  <label className="text-xs text-blue-700 font-medium">График платежей</label>
                  <div className="space-y-1.5 mt-1">
                    {subForm.installment_payments.map((p, i) => (
                      <div key={i} className="flex gap-1.5 items-center">
                        <input type="date" value={p.due_date}
                          onChange={e => { const arr = [...subForm.installment_payments]; arr[i] = {...arr[i], due_date: e.target.value}; setSubForm({...subForm, installment_payments: arr}) }}
                          className="flex-1 border border-blue-200 rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
                        <input type="number" value={p.amount} placeholder="Сумма ₽"
                          onChange={e => { const arr = [...subForm.installment_payments]; arr[i] = {...arr[i], amount: e.target.value}; setSubForm({...subForm, installment_payments: arr}) }}
                          className="w-24 border border-blue-200 rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
                        {subForm.installment_payments.length > 1 && (
                          <button type="button" onClick={() => setSubForm({...subForm, installment_payments: subForm.installment_payments.filter((_, j) => j !== i)})}
                            className="text-red-400 hover:text-red-600 text-sm leading-none">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setSubForm({...subForm, installment_payments: [...subForm.installment_payments, { amount: '', due_date: '' }]})}
                    className="mt-1.5 text-xs text-blue-600 hover:text-blue-800">+ Добавить платёж</button>
                </div>
                {(() => {
                  const total = parseFloat(subForm.amount) || 0
                  const deposit = parseFloat(subForm.deposit_amount) || 0
                  const inSchedule = subForm.installment_payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
                  const diff = total - deposit - inSchedule
                  return (
                    <div className={`text-xs rounded-lg px-2 py-1.5 ${Math.abs(diff) < 1 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                      Итого: {total.toLocaleString('ru-RU')} ₽ | Аванс: {deposit.toLocaleString('ru-RU')} ₽ | В графике: {inSchedule.toLocaleString('ru-RU')} ₽
                      {Math.abs(diff) >= 1 && ` | Остаток: ${diff.toLocaleString('ru-RU')} ₽`}
                      {Math.abs(diff) < 1 && ' ✓'}
                    </div>
                  )
                })()}
              </div>
            )}
            <button type="submit" className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium">
              Сохранить
            </button>
          </form>
        )}

        {(() => {
          const today = new Date().toISOString().split('T')[0]
          const activeSubs = subs.filter(s => !s.is_pending && (s.sessions_left === null || s.sessions_left > 0) && (!s.end_date || s.end_date >= today))
          const pendingSubs = subs.filter(s => s.is_pending)
          if (activeSubs.length === 0 && pendingSubs.length > 0) {
            return (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
                <div className="text-sm text-amber-800">
                  ⏳ Активный абонемент закончился. Есть отложенный: <b>{pendingSubs[0].type.includes('|') ? pendingSubs[0].type.split('|')[1] : pendingSubs[0].type}</b>
                </div>
                <button onClick={() => activatePendingSub(pendingSubs[0])}
                  className="shrink-0 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700">
                  Активировать
                </button>
              </div>
            )
          }
          return null
        })()}

        {subs.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-2">Абонементов нет</div>
        ) : (
          <div className="space-y-3">
            {subs.map(s => {
              const bonuses = s.bonuses || {}
              const bonusesUsed = s.bonuses_used || {}
              const bonusKeys = Object.keys(bonuses)
              const today = localDateStr()
              const isExpiredByDate = s.end_date ? s.end_date < today : false
              const isExpiredBySessions = s.sessions_left !== null && s.sessions_left <= 0
              const isExpired = !s.is_pending && !s.is_frozen && (isExpiredByDate || isExpiredBySessions)
              const matchedType = subTypes.find(t => t.name === s.type)
              return (
                <div key={s.id} className={`p-3 rounded-xl ${isExpired ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-medium">{s.type.includes('|') ? s.type.split('|').join(' · ') : s.type}</div>
                        {isExpired && (
                          <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">❌ Окончен</span>
                        )}
                        {s.is_pending && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⏳ Ожидает</span>
                        )}
                        {s.is_frozen && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">🧊 Заморожен</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {s.sessions_left != null ? `${s.sessions_left}/${s.sessions_total} занятий` : ''}
                        {s.end_date ? ` · до ${s.end_date}` : ''}
                        {s.amount ? ` · ${s.amount.toLocaleString()} ₽` : ''}
                        {matchedType?.price_per_session ? ` · ${matchedType.price_per_session} ₽/трен.` : ''}
                      </div>
                      {s.is_frozen && s.freeze_end && (
                        <div className="text-xs text-blue-500 mt-0.5">Заморозка до {s.freeze_end} · {s.freeze_days_used} дн.</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {s.is_pending && (
                        <button onClick={() => activatePendingSub(s)}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700">
                          ▶ Активировать
                        </button>
                      )}
                      {!s.payment_id && !s.is_pending && s.amount && (
                        <button onClick={() => { setAddToFinanceSub(s); setAddToFinancePaymentType('cash') }}
                          className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-100">
                          💰 В финансы
                        </button>
                      )}
                      {s.payment_id && (
                        <span className="text-xs text-green-600 px-1" title="Есть в финансах">✓ Финансы</span>
                      )}
                      <button onClick={() => editSubId === s.id ? setEditSubId(null) : startEditSub(s)}
                        className="text-xs text-gray-400 border border-gray-200 px-2 py-1 rounded-lg">
                        {editSubId === s.id ? 'Отмена' : '✎'}
                      </button>
                      <button onClick={async () => {
                        if (!confirm('Удалить абонемент?')) return
                        await supabase.from('subscriptions').delete().eq('id', s.id)
                        setSubs(prev => prev.filter(sub => sub.id !== s.id))
                      }} className="text-xs text-red-400 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">
                        🗑
                      </button>
                      <button onClick={() => togglePaid(s.id, s.paid)}
                        className={`text-xs px-2 py-1 rounded-full ${s.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {s.paid ? 'Оплачен' : 'Не оплачен'}
                      </button>
                    </div>
                  </div>

                  {/* Freeze controls */}
                  {!s.is_frozen && (s.freeze_days_used || 0) === 0 && (
                    <div className="mt-2">
                      {freezeSubId === s.id ? (
                        <form onSubmit={e => freezeSubscription(e, s)} className="space-y-2 pt-2 border-t border-gray-200">
                          <div className="text-xs font-medium text-blue-600">🧊 Заморозка (макс. 30 дней, 1 раз)</div>
                          <div className="flex gap-2">
                            <input required type="date" value={freezeForm.freeze_start}
                              onChange={e => setFreezeForm({...freezeForm, freeze_start: e.target.value})}
                              className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none" />
                            <input required type="date" value={freezeForm.freeze_end}
                              onChange={e => setFreezeForm({...freezeForm, freeze_end: e.target.value})}
                              className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none" />
                          </div>
                          {freezeForm.freeze_start && freezeForm.freeze_end && (
                            <div className="text-xs text-gray-500">
                              Дней: {Math.round((new Date(freezeForm.freeze_end).getTime() - new Date(freezeForm.freeze_start).getTime()) / 86400000)} · срок абонемента продлится на столько же
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button type="submit" className="flex-1 bg-blue-500 text-white py-1.5 rounded-xl text-sm font-medium">
                              Заморозить
                            </button>
                            <button type="button" onClick={() => setFreezeSubId(null)}
                              className="px-4 border border-gray-200 text-gray-500 py-1.5 rounded-xl text-sm">
                              Отмена
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button onClick={() => { setFreezeSubId(s.id); setEditSubId(null) }}
                          className="text-xs text-blue-500 border border-blue-200 px-3 py-1 rounded-lg">
                          🧊 Заморозить
                        </button>
                      )}
                    </div>
                  )}
                  {s.is_frozen && (
                    <button onClick={() => unfreezeSubscription(s)}
                      className="mt-2 text-xs text-gray-500 border border-gray-200 px-3 py-1 rounded-lg">
                      Снять заморозку
                    </button>
                  )}
                  {!s.is_frozen && (s.freeze_days_used || 0) > 0 && (
                    <div className="mt-2 text-xs text-gray-400">Заморозка использована ({s.freeze_days_used} дн.)</div>
                  )}
                  {editSubId === s.id && (
                    <form onSubmit={saveEditSub} className="mt-2 pt-2 border-t border-gray-200 space-y-2">
                      <div className="flex gap-2">
                        <input value={editSubForm.sessions_total} onChange={e => setEditSubForm({...editSubForm, sessions_total: e.target.value})}
                          type="number" placeholder="Всего занятий"
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none" />
                        <input value={editSubForm.sessions_left} onChange={e => setEditSubForm({...editSubForm, sessions_left: e.target.value})}
                          type="number" placeholder="Осталось"
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none" />
                      </div>
                      <div className="flex gap-2">
                        <input value={editSubForm.start_date} onChange={e => setEditSubForm({...editSubForm, start_date: e.target.value})}
                          type="date" className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none" />
                        <input value={editSubForm.end_date} onChange={e => setEditSubForm({...editSubForm, end_date: e.target.value})}
                          type="date" className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none" />
                      </div>
                      <input value={editSubForm.amount} onChange={e => setEditSubForm({...editSubForm, amount: e.target.value})}
                        type="number" placeholder="Сумма (₽)"
                        className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none" />
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={editSubForm.paid} onChange={e => setEditSubForm({...editSubForm, paid: e.target.checked})} />
                        Оплачен
                      </label>
                      <button type="submit" className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium">
                        Сохранить
                      </button>
                    </form>
                  )}
                  {bonusKeys.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-gray-500">Бонусы:</div>
                        {matchedType?.bonus_total_value ? (
                          <div className="text-xs text-green-600 font-medium">на {matchedType.bonus_total_value.toLocaleString('ru-RU')} ₽</div>
                        ) : null}
                      </div>
                      {bonusKeys.map(bonus => {
                        const total = bonuses[bonus]
                        const usedDates = getBonusUsedDates(bonusesUsed, bonus)
                        const used = usedDates.length
                        const remaining = total - used
                        const isPickerOpen = bonusDatePicker?.subId === s.id && bonusDatePicker?.bonusName === bonus
                        return (
                          <div key={bonus}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1">
                                <div className="text-xs text-gray-700">{bonus}</div>
                                <div className="flex gap-0.5 mt-0.5 items-center">
                                  {Array.from({ length: total }).map((_, i) => (
                                    <div key={i} className={`w-3 h-3 rounded-full ${i < used ? 'bg-gray-400' : 'bg-blue-400'}`} />
                                  ))}
                                  <span className="text-xs text-gray-400 ml-1">{used}/{total}</span>
                                </div>
                                {usedDates.map((d, i) => (
                                  <div key={i} className="flex items-center gap-1 mt-0.5">
                                    <span className="text-xs text-gray-400">✓ {d || '—'}</span>
                                    <button onClick={() => cancelBonus(s.id, bonus, bonusesUsed, i)}
                                      className="text-xs text-red-400 hover:text-red-600 leading-none">✕</button>
                                  </div>
                                ))}
                              </div>
                              {remaining > 0 && !isPickerOpen && (
                                <button onClick={() => { setBonusDatePicker({ subId: s.id, bonusName: bonus }); setBonusDate(new Date().toISOString().split('T')[0]) }}
                                  className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded-lg shrink-0">
                                  Использовать
                                </button>
                              )}
                              {remaining === 0 && (
                                <span className="text-xs text-gray-400 shrink-0">Все использованы</span>
                              )}
                            </div>
                            {isPickerOpen && (
                              <div className="mt-1.5 flex gap-2 items-center">
                                <input type="date" value={bonusDate} onChange={e => setBonusDate(e.target.value)}
                                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none" />
                                <button onClick={() => { useBonus(s.id, bonus, bonuses, bonusesUsed, bonusDate); setBonusDatePicker(null) }}
                                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg">
                                  Ок
                                </button>
                                <button onClick={() => setBonusDatePicker(null)}
                                  className="text-xs text-gray-400 px-2 py-1 rounded-lg border border-gray-200">
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Belts */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="font-semibold text-gray-800 mb-3">Пояса и аттестации</div>

        {/* Подраздел: Айкидо */}
        {(() => {
          const aikidoBelts = belts.filter(b => !b.discipline || b.discipline === 'aikido')
          return (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">🥋 Айкидо</div>
                <button onClick={() => { setShowBeltForm(showBeltForm === 'aikido' ? null : 'aikido'); setBeltForm({ belt_name: '', date: new Date().toISOString().split('T')[0], notes: '' }) }}
                  className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-xl">
                  + Добавить
                </button>
              </div>

              {showBeltForm === 'aikido' && (
                <form onSubmit={e => addBelt(e, 'aikido')} className="space-y-2 mb-3 p-3 bg-gray-50 rounded-xl">
                  <select required value={beltForm.belt_name} onChange={e => setBeltForm({...beltForm, belt_name: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                    <option value="">Выберите пояс *</option>
                    {BELTS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <input value={beltForm.date} onChange={e => setBeltForm({...beltForm, date: e.target.value})}
                    type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <input value={beltForm.notes} onChange={e => setBeltForm({...beltForm, notes: e.target.value})}
                    placeholder="Заметка (необязательно)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <button type="submit" className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium">Сохранить</button>
                </form>
              )}

              {aikidoBelts.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-2">Аттестаций нет</div>
              ) : (
                <div className="space-y-1.5">
                  {aikidoBelts.map((b, i) => (
                    <div key={b.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BELT_COLORS[b.belt_name] || 'bg-gray-100 text-gray-600'}`}>
                          {b.belt_name}
                        </span>
                        <span className="text-xs text-gray-400">{b.date}</span>
                        {b.notes && <span className="text-xs text-gray-400">{b.notes}</span>}
                        {i === 0 && <span className="text-xs text-blue-400">текущий</span>}
                      </div>
                      <button onClick={() => deleteBelt(b.id)} className="text-xs text-red-400 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        <div className="border-t border-gray-100 my-3" />

        {/* Подраздел: Ушу */}
        {(() => {
          const wushuBelts = belts.filter(b => b.discipline === 'wushu')
          return (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">🐉 Ушу</div>
                <button onClick={() => { setShowBeltForm(showBeltForm === 'wushu' ? null : 'wushu'); setBeltForm({ belt_name: '', date: new Date().toISOString().split('T')[0], notes: '' }) }}
                  className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-xl">
                  + Добавить
                </button>
              </div>

              {showBeltForm === 'wushu' && (
                <form onSubmit={e => addBelt(e, 'wushu')} className="space-y-2 mb-3 p-3 bg-gray-50 rounded-xl">
                  <select required value={beltForm.belt_name} onChange={e => setBeltForm({...beltForm, belt_name: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                    <option value="">Выберите степень *</option>
                    {WUSHU_BELTS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <input value={beltForm.date} onChange={e => setBeltForm({...beltForm, date: e.target.value})}
                    type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <input value={beltForm.notes} onChange={e => setBeltForm({...beltForm, notes: e.target.value})}
                    placeholder="Заметка (необязательно)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <button type="submit" className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium">Сохранить</button>
                </form>
              )}

              {wushuBelts.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-2">Аттестаций нет</div>
              ) : (
                <div className="space-y-1.5">
                  {wushuBelts.map((b, i) => (
                    <div key={b.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${WUSHU_BELT_COLORS[b.belt_name] || 'bg-gray-100 text-gray-600'}`}>
                          {b.belt_name}
                        </span>
                        <span className="text-xs text-gray-400">{b.date}</span>
                        {b.notes && <span className="text-xs text-gray-400">{b.notes}</span>}
                        {i === 0 && <span className="text-xs text-blue-400">текущий</span>}
                      </div>
                      <button onClick={() => deleteBelt(b.id)} className="text-xs text-red-400 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Attendance */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800">История посещений</div>
          <div className="flex gap-2">
            <button onClick={() => { setShowBulkAtt(v => !v); setShowAddAttendance(false) }}
              className="text-sm text-black border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">
              {showBulkAtt ? 'Отмена' : '+ Несколько'}
            </button>
            <button onClick={() => { setShowAddAttendance(v => !v); setShowBulkAtt(false) }}
              className="text-sm text-black border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">
              {showAddAttendance ? 'Отмена' : '+ Занятие'}
            </button>
          </div>
        </div>

        {showAddAttendance && (
          <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <input type="date" value={addAttDate} onChange={e => setAddAttDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none mb-2 bg-white" />
            <div className="flex gap-2">
              <button onClick={() => addAttendance(true)}
                className="flex-1 bg-green-600 text-white text-sm py-2 rounded-lg font-medium hover:bg-green-700">
                ✅ Присутствовал
              </button>
              <button onClick={() => addAttendance(false)}
                className="flex-1 bg-gray-200 text-gray-700 text-sm py-2 rounded-lg font-medium hover:bg-gray-300">
                ❌ Не пришёл
              </button>
            </div>
          </div>
        )}

        {/* Модалка: добавить существующий абонемент в финансы */}
        {addToFinanceSub && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl space-y-4">
              <div className="font-semibold text-gray-800">Добавить в финансы</div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">{addToFinanceSub.type.includes('|') ? addToFinanceSub.type.split('|')[1] : addToFinanceSub.type}</span>
                {' — '}{addToFinanceSub.amount?.toLocaleString()} ₽
                {addToFinanceSub.start_date ? ` · ${addToFinanceSub.start_date}` : ''}
              </div>
              <div className="text-xs text-gray-400">Создаст запись в разделе Финансы (категория: Абонементы)</div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setAddToFinancePaymentType('cash')}
                  className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${addToFinancePaymentType === 'cash' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
                  💵 Наличные
                </button>
                <button type="button"
                  onClick={() => setAddToFinancePaymentType('card')}
                  className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${addToFinancePaymentType === 'card' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
                  💳 Карта
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => addExistingSubToFinance(addToFinanceSub, addToFinancePaymentType)}
                  className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium">
                  Добавить в финансы
                </button>
                <button onClick={() => setAddToFinanceSub(null)}
                  className="px-4 border border-gray-200 text-gray-500 py-2 rounded-xl text-sm">
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {showBulkAtt && (() => {
          const { year, month } = bulkMonth
          const firstDay = new Date(year, month, 1)
          const daysInMonth = new Date(year, month + 1, 0).getDate()
          // Monday-first offset: getDay() 0=Sun→6, 1=Mon→0, ...
          const startOffset = (firstDay.getDay() + 6) % 7
          const today = new Date().toISOString().split('T')[0]
          const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
          const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
          const count = bulkSelected.size
          return (
            <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              {/* Month navigation */}
              <div className="flex items-center justify-between">
                <button onClick={() => setBulkMonth(m => { const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() } })}
                  className="p-1 rounded hover:bg-gray-200 text-gray-600">‹</button>
                <div className="text-sm font-semibold text-gray-800">{MONTHS[month]} {year}</div>
                <button onClick={() => setBulkMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() } })}
                  className="p-1 rounded hover:bg-gray-200 text-gray-600">›</button>
              </div>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
                  <div key={d} className="text-xs text-gray-400 font-medium py-1">{d}</div>
                ))}
                {cells.map((day, idx) => {
                  if (!day) return <div key={idx} />
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const selected = bulkSelected.has(dateStr)
                  const isFuture = dateStr > today
                  return (
                    <button key={idx} disabled={isFuture}
                      onClick={() => setBulkSelected(prev => {
                        const next = new Set(prev)
                        next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr)
                        return next
                      })}
                      className={`aspect-square rounded-lg text-sm font-medium transition-colors
                        ${isFuture ? 'text-gray-300 cursor-default' :
                          selected ? (bulkPresent ? 'bg-green-500 text-white' : 'bg-gray-600 text-white') :
                          'hover:bg-gray-200 text-gray-700'}`}>
                      {day}
                    </button>
                  )
                })}
              </div>
              {/* Status toggle */}
              <div className="flex gap-2">
                <button onClick={() => setBulkPresent(true)}
                  className={`flex-1 text-sm py-2 rounded-lg font-medium border transition-colors ${bulkPresent ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  ✅ Присутствовал
                </button>
                <button onClick={() => setBulkPresent(false)}
                  className={`flex-1 text-sm py-2 rounded-lg font-medium border transition-colors ${!bulkPresent ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  ❌ Не пришёл
                </button>
              </div>
              <button onClick={addBulkAttendance} disabled={bulkSaving || count === 0}
                className="w-full bg-black text-white text-sm py-2 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-40">
                {bulkSaving ? 'Сохраняю...' : count > 0 ? `Сохранить ${count} занятий` : 'Выберите даты'}
              </button>
            </div>
          )
        })()}

        {(() => {
          // Собираем бонусные записи из всех абонементов
          const bonusRows: { date: string; label: string }[] = []
          for (const s of subs) {
            const bonuses = s.bonuses || {}
            const bonusesUsed = s.bonuses_used || {}
            for (const key of Object.keys(bonuses)) {
              const val = bonusesUsed[key]
              const dates: string[] = Array.isArray(val) ? val : Array.from({ length: (val as number) || 0 }, () => '')
              for (const d of dates) {
                if (d) bonusRows.push({ date: d, label: key })
              }
            }
          }
          // Объединяем с attendance и сортируем по дате убывания
          type Row = { date: string } & ({ kind: 'att'; a: typeof attendance[0] } | { kind: 'bonus'; label: string })
          const rows: Row[] = [
            ...attendance.map(a => ({ kind: 'att' as const, date: a.date, a })),
            ...bonusRows.map(b => ({ kind: 'bonus' as const, date: b.date, label: b.label })),
          ].sort((a, b) => b.date.localeCompare(a.date))

          if (rows.length === 0) return <div className="text-sm text-gray-400 text-center py-2">Нет данных</div>

          // Счётчик по месяцам — только в рамках последнего абонемента
          const MONTH_SHORT = ['Янв','Фев','Март','Апр','Май','Июнь','Июль','Авг','Сент','Окт','Нояб','Дек']
          // Цвета по кварталам (зима=белый, весна=зелёный, лето=голубой, осень=жёлтый)
          const SEASON_COLORS: Record<number, string> = {
            12: 'bg-slate-200 text-slate-800',   // зима
            1:  'bg-slate-200 text-slate-800',
            2:  'bg-slate-200 text-slate-800',
            3:  'bg-green-600 text-white',        // весна
            4:  'bg-green-600 text-white',
            5:  'bg-green-600 text-white',
            6:  'bg-sky-500 text-white',          // лето
            7:  'bg-sky-500 text-white',
            8:  'bg-sky-500 text-white',
            9:  'bg-amber-400 text-amber-900',    // осень
            10: 'bg-amber-400 text-amber-900',
            11: 'bg-amber-400 text-amber-900',
          }
          const lastSub = subs.length > 0 ? subs[0] : null
          const subStart = lastSub?.start_date ?? null
          const subEnd = lastSub?.end_date ?? null
          const monthCounts: { key: string; label: string; count: number; monthNum: number }[] = []
          if (subStart) {
            const attInSub = attendance.filter(a => a.present && a.date >= subStart && (!subEnd || a.date <= subEnd))
            const monthMap = new Map<string, number>()
            for (const a of attInSub) {
              const [y, m] = a.date.split('-')
              const key = `${y}-${m}`
              monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
            }
            Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([key, count]) => {
              const [, m] = key.split('-')
              const monthNum = parseInt(m)
              monthCounts.push({ key, label: MONTH_SHORT[monthNum - 1], count, monthNum })
            })
          }
          const totalCount = monthCounts.reduce((sum, m) => sum + m.count, 0)

          return (
            <>
            {monthCounts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 items-center">
                {monthCounts.map(({ key, label, count, monthNum }) => (
                  <div key={key} className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${SEASON_COLORS[monthNum]}`}>
                    <span>{label}</span>
                    <span className="opacity-50">—</span>
                    <span className="font-bold">{count}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-gray-800 text-white font-medium ml-1">
                  <span>Итого</span>
                  <span className="opacity-50">—</span>
                  <span className="font-bold">{totalCount}</span>
                </div>
              </div>
            )}
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {rows.map((row, idx) => {
                if (row.kind === 'bonus') {
                  return (
                    <div key={`bonus-${idx}`} className="flex items-center justify-between text-sm gap-2">
                      <span className="text-gray-600">{row.date}</span>
                      <span className="text-purple-600">🎁 {row.label}</span>
                    </div>
                  )
                }
                const a = row.a
                return (
                  <div key={a.id} className="flex items-center justify-between text-sm gap-2">
                    {editingAttId === a.id ? (
                      <input
                        type="date"
                        defaultValue={a.date}
                        autoFocus
                        className="border border-gray-300 rounded-lg px-2 py-0.5 text-sm outline-none"
                        onBlur={e => saveAttendanceDate(a, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveAttendanceDate(a, (e.target as HTMLInputElement).value)
                          if (e.key === 'Escape') setEditingAttId(null)
                        }}
                      />
                    ) : (
                      <span className="text-gray-600">{a.date}</span>
                    )}
                    <div className="flex items-center gap-2 shrink-0">
                      <span>{a.present ? '✅ Был' : '❌ Не был'}</span>
                      <button onClick={() => { setEditingAttId(a.id); setEditingAttDate(a.date) }}
                        className="text-gray-400 hover:text-gray-700 text-xs px-1">✎</button>
                      <button onClick={() => deleteAttendance(a)}
                        className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
            </>
          )
        })()}
      </div>

      {/* Contacts */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800 text-sm">Контакты и Telegram</div>
          <button onClick={() => setShowAddContact(v => !v)}
            className="text-xs border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">
            {showAddContact ? 'Отмена' : '+ Добавить'}
          </button>
        </div>

        {showAddContact && (
          <form onSubmit={addContact} className="mb-3 p-3 bg-gray-50 rounded-xl space-y-2">
            <input required value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})}
              placeholder="Имя *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white" />
            <select value={contactForm.role} onChange={e => setContactForm({...contactForm, role: e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white">
              <option value="мама">Мама</option>
              <option value="папа">Папа</option>
              <option value="бабушка">Бабушка</option>
              <option value="дедушка">Дедушка</option>
              <option value="тетя">Тётя</option>
              <option value="дядя">Дядя</option>
              <option value="ученик">Ученик</option>
              <option value="другой">Другой</option>
            </select>
            <input value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})}
              placeholder="Телефон" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white" />
            <button type="submit" className="w-full bg-black text-white py-2 rounded-lg text-sm font-medium">Сохранить</button>
          </form>
        )}

        {contacts.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">Контакты не добавлены</p>
        ) : (
          <div className="space-y-2">
            {contacts.map(c => (
              <div key={c.id} className="border border-gray-100 rounded-xl p-3">
                {editingContactId === c.id ? (
                  <form onSubmit={saveEditContact} className="space-y-2">
                    <input required value={editContactForm.name} onChange={e => setEditContactForm({...editContactForm, name: e.target.value})}
                      placeholder="Имя *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white" />
                    <select value={editContactForm.role} onChange={e => setEditContactForm({...editContactForm, role: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white">
                      <option value="мама">Мама</option>
                      <option value="папа">Папа</option>
                      <option value="ученик">Ученик</option>
                      <option value="другой">Другой</option>
                    </select>
                    <input value={editContactForm.phone} onChange={e => setEditContactForm({...editContactForm, phone: e.target.value})}
                      placeholder="Телефон" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white" />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium">Сохранить</button>
                      <button type="button" onClick={() => setEditingContactId(null)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">Отмена</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-800">{c.name}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{c.role}</span>
                        {c.telegram_chat_id
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Telegram</span>
                          : <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Нет Telegram</span>
                        }
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEditContact(c)} className="text-gray-300 hover:text-blue-400 text-sm" title="Редактировать">✎</button>
                        <button onClick={() => deleteContact(c.id)} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
                      </div>
                    </div>
                    {c.phone && <div className="text-xs text-gray-400 mb-2">{c.phone}</div>}
                    <div className="flex gap-2">
                      <button onClick={() => copyContactInviteLink(c)}
                        className="flex-1 border border-blue-200 bg-blue-50 text-blue-700 text-xs py-1.5 rounded-lg">
                        🔗 Ссылка
                      </button>
                      {c.telegram_chat_id && (
                        <button onClick={() => sendContactReminder(c)}
                          className="flex-1 border border-gray-200 text-gray-600 text-xs py-1.5 rounded-lg">
                          📨 Написать
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-2">
        <button onClick={copySurveyLink}
          className="flex-1 border border-blue-200 bg-blue-50 text-blue-700 text-sm py-2.5 rounded-xl">
          📋 {survey?.filled_at ? 'Анкета заполнена ✓' : 'Анкета новичка'}
        </button>
        <button onClick={copyParentLink}
          className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl">
          🔗 Кабинет родителя
        </button>
      </div>
      {canViewCabinet && (
        <div className="flex gap-2 mb-2">
          <button onClick={openStudentCabinet}
            className="flex-1 border border-purple-200 bg-purple-50 text-purple-700 text-sm py-2.5 rounded-xl">
            🎌 Кабинет ученика
          </button>
        </div>
      )}

      {/* Telegram ученика */}
      <div className="flex gap-2 mb-4">
        <button onClick={copyStudentTelegramLink}
          className={`flex-1 text-sm py-2.5 rounded-xl border flex items-center justify-center gap-2
            ${student.telegram_chat_id
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}>
          {student.telegram_chat_id ? '✓ Telegram подключён' : '📱 Подключить Telegram ученика'}
        </button>
      </div>

      {survey?.filled_at && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-2">
          <div className="flex items-center px-4 py-3 border-b border-gray-50">
            <button onClick={() => setShowSurvey(v => !v)}
              className="flex-1 flex items-center gap-2 text-sm font-medium text-gray-800 text-left">
              <span>📋 Данные анкеты — {survey.student_name || '—'}</span>
              <span className="text-gray-400">{showSurvey ? '▲' : '▼'}</span>
            </button>
            <div className="flex gap-2 ml-2">
              <button onClick={startEditSurvey}
                className="text-xs border border-gray-200 px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-50">
                ✎ Изменить
              </button>
              <button onClick={deleteSurvey}
                className="text-xs border border-red-200 px-2 py-1 rounded-lg text-red-400 hover:bg-red-50">
                🗑
              </button>
            </div>
          </div>

          {showSurvey && !editingSurvey && (
            <div className="px-4 pb-4 text-xs space-y-2 pt-3">
              {survey.student_age && <div><span className="text-gray-500">Возраст:</span> {survey.student_age}</div>}
              {survey.injuries_text && <div><span className="text-gray-500">Травмы:</span> {survey.injuries_text}</div>}
              {survey.contraindications_text && <div><span className="text-gray-500">Противопоказания:</span> {survey.contraindications_text}</div>}
              {survey.other_activities_text && <div><span className="text-gray-500">Другие секции:</span> {survey.other_activities_text}</div>}
              {survey.prev_sport_text && <div><span className="text-gray-500">Спорт ранее:</span> {survey.prev_sport_text}</div>}
              {survey.character_notes_text && <div><span className="text-gray-500">Характер:</span> {survey.character_notes_text}</div>}
              {survey.how_can_help_text && <div><span className="text-gray-500">Ожидания:</span> {survey.how_can_help_text}</div>}
              {survey.parent_name && <div><span className="text-gray-500">Родитель:</span> {survey.parent_name}{survey.parent_phone ? ` · ${survey.parent_phone}` : ''}</div>}
              <div className="pt-2 border-t border-gray-100">
                <div className="text-gray-500 mb-1.5 font-medium">15 качеств (1–10):</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    ['q_strength','Сила'],['q_speed','Быстрота'],['q_endurance','Выносливость'],
                    ['q_agility','Ловкость'],['q_coordination','Координация'],['q_posture','Осанка'],
                    ['q_flexibility','Гибкость'],['q_discipline','Дисциплина'],['q_sociability','Общительность'],
                    ['q_confidence','Уверенность'],['q_learnability','Обучаемость'],['q_attentiveness','Внимательность'],
                    ['q_emotional_balance','Уравновешенность'],['q_goal_orientation','Целеустремлённость'],
                    ['q_activity','Активность'],['q_self_defense','Самозащита'],
                  ].filter(([k]) => survey[k] !== null && survey[k] !== undefined).map(([k, lbl]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-500">{lbl}</span>
                      <span className="font-semibold text-gray-800">{survey[k]}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showSurvey && editingSurvey && (
            <div className="px-4 pb-4 pt-3 space-y-3">
              {[
                ['student_name','Имя ученика'],['student_age','Возраст'],
                ['injuries_text','Травмы'],['contraindications_text','Противопоказания'],
                ['other_activities_text','Другие секции'],['prev_sport_text','Спорт ранее'],
                ['character_notes_text','Характер'],['how_can_help_text','Ожидания'],
                ['parent_name','Имя родителя'],['parent_phone','Телефон родителя'],
              ].map(([k, lbl]) => (
                <div key={k}>
                  <label className="text-xs text-gray-500 block mb-1">{lbl}</label>
                  <input value={surveyForm[k] || ''} onChange={e => setSurveyForm((p: any) => ({...p, [k]: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3">
                <div className="text-xs text-gray-500 mb-2 font-medium">15 качеств (1–10):</div>
                <div className="space-y-2">
                  {[
                    ['q_strength','Сила'],['q_speed','Быстрота'],['q_endurance','Выносливость'],
                    ['q_agility','Ловкость'],['q_coordination','Координация'],['q_posture','Осанка'],
                    ['q_flexibility','Гибкость'],['q_discipline','Дисциплина'],['q_sociability','Общительность'],
                    ['q_confidence','Уверенность'],['q_learnability','Обучаемость'],['q_attentiveness','Внимательность'],
                    ['q_emotional_balance','Уравновешенность'],['q_goal_orientation','Целеустремлённость'],
                    ['q_activity','Активность'],['q_self_defense','Самозащита'],
                  ].map(([k, lbl]) => (
                    <div key={k} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-32 shrink-0">{lbl}</span>
                      <input type="range" min={1} max={10} value={surveyForm[k] ?? 5}
                        onChange={e => setSurveyForm((p: any) => ({...p, [k]: parseInt(e.target.value)}))}
                        className="flex-1 accent-black" />
                      <span className="text-xs font-semibold text-gray-800 w-4">{surveyForm[k] ?? 5}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveSurvey} className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium">Сохранить</button>
                <button onClick={() => setEditingSurvey(false)} className="px-4 border border-gray-200 text-gray-500 py-2 rounded-xl text-sm">Отмена</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* История обращений */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-2 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 text-sm">📝 История обращений</span>
            {studentTickets.filter(t => t.status === 'pending').length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                !
              </span>
            )}
            {studentTickets.length > 0 && (
              <span className="text-xs text-gray-400">{studentTickets.length} шт.</span>
            )}
          </div>
          <button onClick={() => setShowTicketForm(v => !v)}
            className="text-sm text-gray-500 border border-gray-200 px-2.5 py-1 rounded-xl hover:bg-gray-50 transition-colors">
            {showTicketForm ? 'Отмена' : '+ Создать'}
          </button>
        </div>

        {showTicketForm && (
          <form onSubmit={createTicket} className="p-4 border-b border-gray-100 space-y-2 bg-gray-50">
            <select required value={ticketForm.type} onChange={e => setTicketForm({...ticketForm, type: e.target.value})}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
              <option value="">Тип обращения *</option>
              <option value="болезнь">🤒 Болезнь</option>
              <option value="перенос">🔄 Перенос занятия</option>
              <option value="жалоба">⚠️ Жалоба</option>
              <option value="вопрос">❓ Вопрос</option>
            </select>
            <textarea value={ticketForm.description} onChange={e => setTicketForm({...ticketForm, description: e.target.value})}
              placeholder="Описание (необязательно)" rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none bg-white" />
            <button type="submit" className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium">
              Отправить обращение
            </button>
          </form>
        )}

        {studentTickets.length === 0 && !showTicketForm ? (
          <div className="text-center text-gray-400 text-sm py-5">Обращений нет</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {studentTickets.map(t => {
              const typeInfo = TICKET_TYPE_LABELS[t.type] || { label: t.type, color: 'bg-gray-100 text-gray-600' }
              return (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {t.status === 'pending' && (
                        <span className="text-red-500 font-bold text-sm leading-none">!</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TICKET_STATUS_COLORS[t.status]}`}>
                        {TICKET_STATUS_LABELS[t.status]}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(t.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-sm text-gray-600 mt-1 mb-2">{t.description}</p>
                  )}
                  {t.status !== 'resolved' && (
                    <button onClick={() => advanceTicket(t)}
                      className="text-xs border border-gray-200 text-gray-600 px-3 py-1 rounded-xl hover:bg-gray-50 transition-colors">
                      {t.status === 'pending' ? 'Взять в работу' : 'Отметить решённым'}
                    </button>
                  )}
                  {t.status === 'resolved' && (
                    <span className="text-xs text-green-600 font-medium">✓ Решено</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Анкета прогресса (Анкета 2) */}
      {(() => {
        const activeSurvey = progressSurveys[0] ?? null
        const firstAttendance = attendance.length > 0 ? attendance[attendance.length - 1].date : null
        const daysSinceCreated = firstAttendance ? Math.floor((Date.now() - new Date(firstAttendance).getTime()) / 86400000) : 0
        const waitingParent = activeSurvey?.parent_sent_at && !activeSurvey?.filled_at
        const daysSinceSent = activeSurvey?.parent_sent_at ? Math.floor((Date.now() - new Date(activeSurvey.parent_sent_at).getTime()) / 86400000) : 0
        const isOverdue = waitingParent && daysSinceSent >= 3
        const canCreateNew = !activeSurvey || !!activeSurvey.filled_at

        // Группировка по годам для предыдущих срезов
        const prevSurveys = progressSurveys.slice(1)
        const groupByYear = prevSurveys.length > 3
        const byYear: Record<number, any[]> = {}
        for (const s of prevSurveys) {
          const y = new Date(s.created_at).getFullYear()
          if (!byYear[y]) byYear[y] = []
          byYear[y].push(s)
        }

        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-2 overflow-hidden">
            {/* Шапка */}
            <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="flex-1 text-sm font-medium text-gray-800">
                📈 Срезы прогресса
                {progressSurveys.length > 0 && <span className="ml-2 text-gray-400 text-xs font-normal">{progressSurveys.length} шт.</span>}
              </span>
              {canCreateNew && (
                <button onClick={createProgressSurvey}
                  className="text-xs bg-black text-white px-3 py-1.5 rounded-lg">
                  + Новый срез
                </button>
              )}
            </div>

            <div className="px-4 py-3 space-y-3">
              {/* Нет срезов */}
              {progressSurveys.length === 0 && (
                <div>
                  {daysSinceCreated >= 28 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-700">
                      ⏰ Прошло {daysSinceCreated} дней с начала занятий — пора сделать первый срез!
                    </div>
                  )}
                  <p className="text-xs text-gray-400 text-center py-2">Срезов ещё нет. Нажмите «+ Новый срез»</p>
                </div>
              )}

              {/* Активный срез (последний) */}
              {activeSurvey && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center px-3 py-2 bg-gray-50">
                    <span className="flex-1 text-xs font-semibold text-gray-700">
                      {activeSurvey.title || `Срез ${activeSurvey.survey_number || 1}`}
                    </span>
                    {activeSurvey.filled_at
                      ? <span className="text-xs text-green-600 font-medium">✓ Заполнен</span>
                      : isOverdue
                        ? <span className="text-xs text-orange-500 font-semibold">⏰ {daysSinceSent}д без ответа</span>
                        : activeSurvey.parent_sent_at
                          ? <span className="text-xs text-blue-500">⏳ Ожидаем</span>
                          : <span className="text-xs text-gray-400">Новый</span>
                    }
                    {activeSurvey.filled_at && (
                      <button onClick={() => setShowProgressTrainer(v => !v)}
                        className="ml-2 text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-lg">
                        {showProgressTrainer ? '▲' : '▼'}
                      </button>
                    )}
                  </div>

                  <div className="px-3 py-2.5">
                    {/* Шаг 1: оценки тренера */}
                    {!activeSurvey.trainer_filled_at && (
                      <div>
                        <div className="text-xs text-gray-500 mb-2">
                          <span className="font-medium text-gray-700">Шаг 1 из 2:</span> Оцените прогресс ученика до отправки анкеты
                        </div>
                        {!editingProgressTrainer ? (
                          <button onClick={() => setEditingProgressTrainer(true)}
                            className="w-full bg-black text-white text-xs py-2.5 rounded-xl">
                            🥋 Заполнить оценки тренера
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <textarea value={progressTrainerForm.trainer_notes || ''}
                              onChange={e => setProgressTrainerForm(p => ({ ...p, trainer_notes: e.target.value }))}
                              placeholder="Заметки о прогрессе..." rows={3}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none resize-none" />
                            <div className="space-y-2.5">
                              {PROGRESS_QUALITIES.map(k => (
                                <div key={k} className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 w-28 shrink-0">{PROGRESS_QUALITY_LABELS[k]}</span>
                                  <input type="range" min={1} max={10}
                                    value={progressTrainerForm[`trainer_${k}`] ?? 5}
                                    onChange={e => setProgressTrainerForm(p => ({ ...p, [`trainer_${k}`]: parseInt(e.target.value) }))}
                                    className="flex-1 accent-black" />
                                  <span className="text-xs font-bold text-gray-800 w-4">{progressTrainerForm[`trainer_${k}`] ?? 5}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={saveProgressTrainer} disabled={savingProgressTrainer}
                                className="flex-1 bg-black text-white py-2 rounded-xl text-xs font-medium disabled:opacity-50">
                                {savingProgressTrainer ? 'Сохраняю...' : 'Сохранить оценки'}
                              </button>
                              <button onClick={() => setEditingProgressTrainer(false)}
                                className="px-3 border border-gray-200 text-gray-500 py-2 rounded-xl text-xs">
                                Отмена
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Шаг 2: отправить ссылку */}
                    {activeSurvey.trainer_filled_at && !activeSurvey.filled_at && (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500 mb-1">
                          <span className="font-medium text-gray-700">Шаг 2 из 2:</span> Отправьте анкету родителю
                          {student?.birth_date && (() => {
                            const age = Math.floor((Date.now() - new Date(student.birth_date).getTime()) / (365.25 * 86400000))
                            return age >= 11 ? ' и ученику (11+)' : ''
                          })()}
                        </div>
                        <button onClick={() => copyProgressLink('parent')}
                          className={`w-full text-xs py-2.5 rounded-xl border font-medium
                            ${activeSurvey.parent_sent_at ? 'border-green-200 bg-green-50 text-green-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                          {activeSurvey.parent_sent_at ? '✓ Родителю отправлено — скопировать снова' : '📨 Скопировать текст для родителя'}
                        </button>
                        {student?.birth_date && (() => {
                          const age = Math.floor((Date.now() - new Date(student.birth_date).getTime()) / (365.25 * 86400000))
                          return age >= 11 ? (
                            <button onClick={() => copyProgressLink('student')}
                              className={`w-full text-xs py-2.5 rounded-xl border font-medium
                                ${activeSurvey.student_sent_at ? 'border-green-200 bg-green-50 text-green-700' : 'border-purple-200 bg-purple-50 text-purple-700'}`}>
                              {activeSurvey.student_sent_at ? '✓ Ученику отправлено — скопировать снова' : '📨 Скопировать текст для ученика'}
                            </button>
                          ) : null
                        })()}
                        {isOverdue && (
                          <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 text-xs text-orange-700">
                            ⏰ Отправлено {daysSinceSent} дн. назад — нет ответа. Напомните лично.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Заполнен — показать данные */}
                    {activeSurvey.filled_at && showProgressTrainer && (
                      <div className="pt-1 text-xs space-y-3">
                        <div className="text-gray-500">
                          Заполнил: <span className="font-medium text-gray-700">{activeSurvey.filled_by === 'parent' ? 'Родитель' : 'Ученик'}</span>
                        </div>
                        {activeSurvey.trainer_notes && (
                          <div className="italic text-gray-600">"{activeSurvey.trainer_notes}"</div>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {PROGRESS_QUALITIES.map(k => {
                            const t = activeSurvey[`trainer_${k}`]
                            const r = activeSurvey[`q_${k}`]
                            const diff = t != null && r != null ? r - t : null
                            return t != null || r != null ? (
                              <div key={k} className="flex justify-between items-center">
                                <span className="text-gray-500">{PROGRESS_QUALITY_LABELS[k]}</span>
                                <span className="font-medium text-gray-800">
                                  {t ?? '—'} / {r ?? '—'}
                                  {diff != null && diff !== 0 && (
                                    <span className={`ml-1 ${diff > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                      {diff > 0 ? `+${diff}` : diff}
                                    </span>
                                  )}
                                </span>
                              </div>
                            ) : null
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Предыдущие срезы */}
              {prevSurveys.length > 0 && (
                <div className="space-y-2">
                  {groupByYear
                    ? Object.entries(byYear).sort(([a], [b]) => Number(b) - Number(a)).map(([year, sList]) => (
                        <div key={year}>
                          <div className="text-xs text-gray-400 font-medium px-1 mb-1.5">{year}</div>
                          {sList.map(s => <SurveySummaryRow key={s.id} s={s} qualities={PROGRESS_QUALITIES} labels={PROGRESS_QUALITY_LABELS} />)}
                        </div>
                      ))
                    : prevSurveys.map(s => <SurveySummaryRow key={s.id} s={s} qualities={PROGRESS_QUALITIES} labels={PROGRESS_QUALITY_LABELS} />)
                  }
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* AI: Анализ прогресса */}
      {progressSurveys.some(s => s.filled_at) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-2 overflow-hidden">
          <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="flex-1 text-sm font-medium text-gray-800">✨ Анализ прогресса (ИИ)</span>
          </div>
          <div className="px-4 py-3 space-y-3">
            <button
              onClick={async () => {
                setGeneratingCompare(true)
                // All filled progress surveys sorted oldest → newest
                const filledSurveys = [...progressSurveys]
                  .filter(s => s.filled_at)
                  .sort((a, b) => new Date(a.filled_at).getTime() - new Date(b.filled_at).getTime())
                const res = await fetch('/api/compare-surveys', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ survey1: survey, surveys: filledSurveys, studentName: student?.name }),
                })
                const data = await res.json()
                if (data.program) setCompareProgram(data.program)
                setGeneratingCompare(false)
              }}
              disabled={generatingCompare}
              className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {generatingCompare ? '⏳ Генерация...' : compareProgram ? '🔄 Обновить анализ' : '✨ Сравнить с начальной анкетой'}
            </button>
            {compareProgram && (
              <textarea
                value={compareProgram}
                onChange={e => setCompareProgram(e.target.value)}
                rows={16}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none resize-none leading-relaxed"
              />
            )}
          </div>
        </div>
      )}

      {/* Профиль ученика (Анкета 3) + Договор */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-2 overflow-hidden">
        <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
          <span className="flex-1 text-sm font-medium text-gray-800">
            📁 Профиль и договор
            {studentProfile?.filled_at && <span className="ml-2 text-green-600 text-xs">✓ Анкета заполнена</span>}
          </span>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">📅 Дата начала занятий</label>
            <input
              type="date"
              defaultValue={studentProfile?.training_start_date || ''}
              onBlur={e => saveTrainingStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">Для давних учеников — укажи вручную. Для новых — берётся из абонемента.</p>
          </div>
          <button onClick={sendProfileSurvey}
            className={`w-full text-xs py-2.5 rounded-xl border font-medium
              ${studentProfile?.filled_at
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
            {studentProfile?.filled_at
              ? '✓ Анкета заполнена — отправить повторно'
              : '📨 Скопировать ссылку на анкету профиля'}
          </button>
          {studentProfile?.filled_at && (
            <div className="text-xs text-gray-500 space-y-0.5 pt-1">
              {studentProfile.last_name && <div>ФИО: {[studentProfile.last_name, studentProfile.first_name, studentProfile.middle_name].filter(Boolean).join(' ')}</div>}
              {studentProfile.address && <div>Адрес: {studentProfile.address}</div>}
              {studentProfile.goals?.length > 0 && <div>Цели: {studentProfile.goals.join(', ')}</div>}
              {(studentProfile.father_name || studentProfile.mother_name) && (
                <div>Родители: {[studentProfile.father_name, studentProfile.mother_name].filter(Boolean).join(', ')}</div>
              )}
              {(studentProfile.father_in_group || studentProfile.mother_in_group) && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {studentProfile.father_in_group && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                      📢 Папа хочет в группу
                    </span>
                  )}
                  {studentProfile.mother_in_group && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                      📢 Мама хочет в группу
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          <button onClick={() => window.open(`/print/${id}`, '_blank')}
            className="w-full border border-gray-200 bg-white text-gray-700 text-xs py-2.5 rounded-xl font-medium">
            🖨️ Распечатать договор
          </button>
          {!studentProfile?.filled_at && (
            <p className="text-xs text-gray-400 text-center">
              Заполните анкету профиля — и договор распечатается с данными клиента
            </p>
          )}
        </div>
      </div>

      {/* История платежей */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-2 overflow-hidden">
        <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
          <span className="flex-1 text-sm font-medium text-gray-800">💳 История платежей</span>
          <Link href="/finance" className="text-xs text-gray-400 hover:text-gray-600">+ добавить →</Link>
        </div>
        {payments.length === 0 ? (
          <div className="px-4 py-4 text-xs text-gray-400 text-center">Платежей не найдено</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {payments.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 shrink-0">+</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{p.category || '—'}</div>
                  <div className="text-xs text-gray-400">
                    {p.payment_type === 'cash' ? '💵' : '💳'} · {new Date(p.paid_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {p.description && <span> · {p.description}</span>}
                  </div>
                </div>
                <div className="text-sm font-bold text-green-700 shrink-0">+{p.amount.toLocaleString()} ₽</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {student.status === 'active' && (
        <button onClick={archive} className="w-full text-gray-400 text-sm py-2">
          Перевести в архив
        </button>
      )}
    </main>
  )
}
