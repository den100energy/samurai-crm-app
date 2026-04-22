'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ─── Normatives ─────────────────────────────────────────────────────────────

type GradeReq = { grade: string; minVisits: number; minMonthsSinceLast: number; minAge?: number }

const AIKIDO_REQ: GradeReq[] = [
  { grade: '11 кю', minVisits: 24,  minMonthsSinceLast: 2,  minAge: 6  },
  { grade: '10 кю', minVisits: 40,  minMonthsSinceLast: 4,  minAge: 7  },
  { grade: '9 кю',  minVisits: 45,  minMonthsSinceLast: 5,  minAge: 8  },
  { grade: '8 кю',  minVisits: 50,  minMonthsSinceLast: 6,  minAge: 9  },
  { grade: '7 кю',  minVisits: 50,  minMonthsSinceLast: 6,  minAge: 10 },
  { grade: '6 кю',  minVisits: 50,  minMonthsSinceLast: 6,  minAge: 11 },
  { grade: '5 кю',  minVisits: 60,  minMonthsSinceLast: 6,  minAge: 12 },
  { grade: '4 кю',  minVisits: 60,  minMonthsSinceLast: 6              },
  { grade: '3 кю',  minVisits: 60,  minMonthsSinceLast: 6              },
  { grade: '2 кю',  minVisits: 120, minMonthsSinceLast: 12             },
  { grade: '1 кю',  minVisits: 120, minMonthsSinceLast: 12             },
  { grade: '1 дан', minVisits: 120, minMonthsSinceLast: 12, minAge: 16 },
  { grade: '2 дан', minVisits: 240, minMonthsSinceLast: 24, minAge: 18 },
  { grade: '3 дан', minVisits: 360, minMonthsSinceLast: 36, minAge: 20 },
  { grade: '4 дан', minVisits: 480, minMonthsSinceLast: 48, minAge: 22 },
]

const WUSHU_REQ: GradeReq[] = [
  { grade: '10 туди',   minVisits: 24,  minMonthsSinceLast: 2,  minAge: 6  },
  { grade: '9 туди',    minVisits: 40,  minMonthsSinceLast: 3,  minAge: 7  },
  { grade: '8 туди',    minVisits: 45,  minMonthsSinceLast: 4,  minAge: 8  },
  { grade: '7 туди',    minVisits: 50,  minMonthsSinceLast: 5,  minAge: 9  },
  { grade: '6 туди',    minVisits: 50,  minMonthsSinceLast: 6,  minAge: 10 },
  { grade: '5 туди',    minVisits: 50,  minMonthsSinceLast: 6,  minAge: 11 },
  { grade: '4 туди',    minVisits: 50,  minMonthsSinceLast: 6,  minAge: 12 },
  { grade: '3 туди',    minVisits: 50,  minMonthsSinceLast: 6,  minAge: 12 },
  { grade: '2 туди',    minVisits: 50,  minMonthsSinceLast: 6,  minAge: 13 },
  { grade: '1 степень', minVisits: 120, minMonthsSinceLast: 12, minAge: 14 },
  { grade: '2 степень', minVisits: 240, minMonthsSinceLast: 24, minAge: 16 },
  { grade: '3 степень', minVisits: 360, minMonthsSinceLast: 36, minAge: 18 },
  { grade: '4 степень', minVisits: 480, minMonthsSinceLast: 48, minAge: 20 },
]

const AIKIDO_GRADES = ['11 кю', '10 кю', '9 кю', '8 кю', '7 кю', '6 кю', '5 кю', '4 кю', '3 кю', '2 кю', '1 кю', '1 дан', '2 дан', '3 дан', '4 дан']
const WUSHU_GRADES  = ['10 туди', '9 туди', '8 туди', '7 туди', '6 туди', '5 туди', '4 туди', '3 туди', '2 туди', '1 степень', '2 степень', '3 степень', '4 степень']

function monthsBetween(from: string, to: string): number {
  const d1 = new Date(from)
  const d2 = new Date(to)
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())
}

function ageYears(birth: string): number {
  const d = new Date(birth)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
  return age
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Application = {
  id: string
  event_id: string
  student_id: string
  discipline: string
  current_grade: string
  target_grade: string
  last_attestation_date: string | null
  last_attestation_grade: string | null
  req_tenure_ok: boolean | null
  req_visits_ok: boolean | null
  req_age_ok: boolean | null
  req_override_by: string | null
  req_override_note: string | null
  price: number | null
  paid: boolean
  paid_at: string | null
  payment_method: string | null
  preatt1_status: string | null
  preatt1_notes: string | null
  preatt1_date: string | null
  preatt1_trainer: string | null
  preatt2_status: string | null
  preatt2_notes: string | null
  preatt2_date: string | null
  preatt2_trainer: string | null
  result: string | null
  result_grade: string | null
  sensei_notes: string | null
  result_date: string | null
  status: string
  prepaid_amount: number | null
  prepaid_at: string | null
  prepaid_method: string | null
}

type Student = {
  id: string
  name: string
  birth_date: string | null
  enrollment_date: string | null
  group_name: string | null
  telegram_chat_id: number | null
}

type PreattGroup = {
  label: string
  grades: string[]
  preatt1_date: string
  preatt2_date: string
}

type AttestationEvent = {
  id: string
  title: string
  discipline: string
  event_date: string
  preatt1_date: string | null
  preatt2_date: string | null
  preatt_groups: PreattGroup[] | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PREATT_STATUSES = [
  { value: 'approved', label: 'Допущен' },
  { value: 'conditional', label: 'Условно допущен' },
  { value: 'rejected', label: 'Не допущен' },
  { value: 'no_show', label: 'Не пришёл' },
]

const RESULT_STATUSES = [
  { value: 'passed', label: 'Сдал' },
  { value: 'passed_remarks', label: 'Сдал с замечаниями' },
  { value: 'failed', label: 'Не сдал' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Наличные' },
  { value: 'card', label: 'Карта' },
  { value: 'transfer', label: 'Перевод' },
]

function ReqBadge({ ok, label, actual, required }: { ok: boolean | null; label: string; actual?: string; required?: string }) {
  const color = ok === true ? 'bg-green-50 border-green-200 text-green-700'
    : ok === false ? 'bg-red-50 border-red-200 text-red-600'
    : 'bg-gray-50 border-gray-200 text-gray-500'
  return (
    <div className={`flex-1 border rounded-xl p-2 text-center ${color}`}>
      <p className="text-xs font-medium">{label}</p>
      {actual && <p className="text-xs mt-0.5">{actual}</p>}
      {required && <p className="text-xs text-gray-400">{required}</p>}
      <p className="text-base mt-0.5 font-bold">{ok === true ? '✓' : ok === false ? '✗' : '?'}</p>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ApplicationDetailPage() {
  const { id: eventId, appId } = useParams<{ id: string; appId: string }>()

  const [app, setApp] = useState<Application | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [event, setEvent] = useState<AttestationEvent | null>(null)
  const [visitCount, setVisitCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Form states
  const [overrideForm, setOverrideForm] = useState({ by: '', note: '' })
  const [preatt1Form, setPreatt1Form] = useState({ status: '', notes: '', date: '', trainer: '' })
  const [preatt2Form, setPreatt2Form] = useState({ status: '', notes: '', date: '', trainer: '' })
  const [paymentForm, setPaymentForm] = useState({ price: '', method: 'cash', paid_at: new Date().toISOString().split('T')[0] })
  const [resultForm, setResultForm] = useState({ result: '', grade: '', sensei_notes: '', date: new Date().toISOString().split('T')[0] })
  const [trainers, setTrainers] = useState<string[]>([])
  const [contactChatIds, setContactChatIds] = useState<number[]>([])
  const [paymentMode, setPaymentMode] = useState<'full' | 'installment'>('full')
  const [editingPayment, setEditingPayment] = useState(false)
  const [legacyPayment, setLegacyPayment] = useState(false)
  const [prepaidForm, setPrepaidForm] = useState({ amount: '', method: 'cash', paid_at: new Date().toISOString().split('T')[0] })

  async function load() {
    const [{ data: ap }, { data: ev }, { data: tr }] = await Promise.all([
      supabase.from('attestation_applications').select('*').eq('id', appId).single(),
      supabase.from('attestation_events').select('id, title, discipline, event_date, preatt1_date, preatt2_date, preatt_groups').eq('id', eventId).single(),
      supabase.from('trainers').select('name').order('name'),
    ])

    const application = ap as Application
    const evData = ev as AttestationEvent
    setApp(application)
    setEvent(evData)
    setTrainers(((tr as any[]) || []).map(t => t.name))

    if (application) {
      // Find grade group for auto-populating preatt dates
      const gradeGroup = evData?.preatt_groups?.find(g => g.grades.includes(application.target_grade)) || null

      // Init forms from existing data (fall back to group dates if not set)
      setPreatt1Form({
        status: application.preatt1_status || '',
        notes: application.preatt1_notes || '',
        date: application.preatt1_date || gradeGroup?.preatt1_date || '',
        trainer: application.preatt1_trainer || '',
      })
      setPreatt2Form({
        status: application.preatt2_status || '',
        notes: application.preatt2_notes || '',
        date: application.preatt2_date || gradeGroup?.preatt2_date || '',
        trainer: application.preatt2_trainer || '',
      })
      setPaymentForm(p => ({
        ...p,
        price: application.price?.toString() || '',
        method: application.payment_method || 'cash',
        paid_at: application.paid_at || p.paid_at,
      }))
      setPrepaidForm(p => ({
        ...p,
        amount: application.prepaid_amount?.toString() || '',
        method: application.prepaid_method || 'cash',
        paid_at: application.prepaid_at || p.paid_at,
      }))
      setResultForm({
        result: application.result || '',
        grade: application.result_grade || application.target_grade || '',
        sensei_notes: application.sensei_notes || '',
        date: application.result_date || ev?.event_date || new Date().toISOString().split('T')[0],
      })
      setOverrideForm({ by: application.req_override_by || '', note: application.req_override_note || '' })

      // Load student + contacts + visit count in parallel
      const [{ data: stu }, { data: contacts }, { count }] = await Promise.all([
        supabase.from('students').select('id, name, birth_date, enrollment_date, group_name, telegram_chat_id').eq('id', application.student_id).single(),
        supabase.from('student_contacts').select('telegram_chat_id').eq('student_id', application.student_id).not('telegram_chat_id', 'is', null),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('student_id', application.student_id).eq('present', true),
      ])
      setStudent(stu as Student)
      setContactChatIds((contacts || []).map((c: { telegram_chat_id: number }) => c.telegram_chat_id).filter(Boolean))
      setVisitCount(count ?? 0)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [appId])

  // Compute normative check
  const normReq = app ? (app.discipline === 'aikido' ? AIKIDO_REQ : WUSHU_REQ).find(r => r.grade === app.target_grade) : null

  const today = new Date().toISOString().split('T')[0]
  const tenureMonths = app?.last_attestation_date ? monthsBetween(app.last_attestation_date, today) : null
  const studentAge = student?.birth_date ? ageYears(student.birth_date) : null

  const tenureOk = normReq && tenureMonths !== null ? tenureMonths >= normReq.minMonthsSinceLast : null
  const visitsOk = normReq && visitCount !== null ? visitCount >= normReq.minVisits : null
  const ageOk = normReq?.minAge && studentAge !== null ? studentAge >= normReq.minAge : (normReq && !normReq.minAge ? true : null)

  const hasOverride = !!app?.req_override_by

  // Send notification to student + all parent contacts
  async function notifyAll(message: string) {
    const chatIds = new Set<number>()
    if (student?.telegram_chat_id) chatIds.add(student.telegram_chat_id)
    for (const id of contactChatIds) chatIds.add(id)
    await Promise.all([...chatIds].map(chat_id =>
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, message }),
      }).catch(() => {})
    ))
  }

  // Save helpers
  async function savePreatt(num: 1 | 2) {
    const f = num === 1 ? preatt1Form : preatt2Form
    setSaving(`preatt${num}`)
    const patch = num === 1
      ? { preatt1_status: f.status || null, preatt1_notes: f.notes || null, preatt1_date: f.date || null, preatt1_trainer: f.trainer || null }
      : { preatt2_status: f.status || null, preatt2_notes: f.notes || null, preatt2_date: f.date || null, preatt2_trainer: f.trainer || null }
    await supabase.from('attestation_applications').update(patch).eq('id', appId)
    // Notify student + parents
    if (f.status) {
      const statusLabel = f.status === 'approved' ? 'Допущен ✅' : f.status === 'conditional' ? 'Условно допущен ⚠️' : 'Не допущен ❌'
      const msgLines = [
        `🥋 Предаттестация ${num} — ${statusLabel}`,
        app ? `${app.discipline === 'aikido' ? 'Айкидо' : 'Ушу'} · ${app.target_grade}` : '',
        f.notes ? `Замечания: ${f.notes}` : '',
      ].filter(Boolean)
      await notifyAll(msgLines.join('\n'))
    }
    setApp(prev => prev ? { ...prev, ...patch } : prev)
    setSaving(null)
  }

  async function setAppStatus(status: 'approved' | 'rejected', note?: string) {
    setSaving('appstatus')
    await supabase.from('attestation_applications').update({ status }).eq('id', appId)
    // Notify student + parents
    const msgLines = [
      status === 'approved'
        ? `✅ Ваша заявка на аттестацию одобрена!`
        : `❌ Ваша заявка на аттестацию отклонена`,
      app ? `${app.discipline === 'aikido' ? 'Айкидо' : 'Ушу'} · ${app.target_grade}` : '',
      note ? `Причина: ${note}` : '',
    ].filter(Boolean)
    await notifyAll(msgLines.join('\n'))
    setApp(prev => prev ? { ...prev, status } : prev)
    setSaving(null)
  }

  async function saveOverride() {
    setSaving('override')
    const patch = {
      req_override_by: overrideForm.by || null,
      req_override_note: overrideForm.note || null,
      req_tenure_ok: tenureOk ?? null,
      req_visits_ok: visitsOk ?? null,
      req_age_ok: ageOk ?? null,
    }
    await supabase.from('attestation_applications').update(patch).eq('id', appId)
    setApp(prev => prev ? { ...prev, ...patch } : prev)
    setSaving(null)
  }

  async function saveAutoCheck() {
    setSaving('autocheck')
    const patch = {
      req_tenure_ok: tenureOk ?? null,
      req_visits_ok: visitsOk ?? null,
      req_age_ok: ageOk ?? null,
    }
    await supabase.from('attestation_applications').update(patch).eq('id', appId)
    setApp(prev => prev ? { ...prev, ...patch } : prev)
    setSaving(null)
  }

  async function savePayment() {
    if (app?.paid) return
    setSaving('payment')
    const amount = parseFloat(paymentForm.price) || app?.price || 0
    const patch = {
      paid: true,
      paid_at: paymentForm.paid_at,
      payment_method: paymentForm.method,
      price: amount,
    }
    await supabase.from('attestation_applications').update(patch).eq('id', appId)
    // Create payment record
    await supabase.from('payments').insert({
      amount,
      direction: 'income',
      category: 'Аттестация+',
      payment_type: paymentForm.method,
      description: `Аттестация: ${app?.target_grade} (${app?.discipline === 'aikido' ? 'айкидо' : 'ушу'})`,
      paid_at: paymentForm.paid_at,
      student_id: app?.student_id,
      status: 'paid',
      attestation_application_id: appId,
    })
    // Notify student + parents
    await notifyAll(`✅ Оплата аттестации принята — ${amount} ₽\n${app?.target_grade} (${app?.discipline === 'aikido' ? 'айкидо' : 'ушу'})`)
    setApp(prev => prev ? { ...prev, ...patch } : prev)
    setSaving(null)
  }

  async function saveEditPayment() {
    setSaving('editpayment')
    const amount = parseFloat(paymentForm.price) || app?.price || 0
    const patch = { price: amount, payment_method: paymentForm.method, paid_at: paymentForm.paid_at }
    await supabase.from('attestation_applications').update(patch).eq('id', appId)
    const { data: updated } = await supabase
      .from('payments')
      .update({ amount, payment_type: paymentForm.method, paid_at: paymentForm.paid_at })
      .eq('attestation_application_id', appId)
      .select('id')
    if (!updated || updated.length === 0) setLegacyPayment(true)
    setApp(prev => prev ? { ...prev, ...patch } : prev)
    setEditingPayment(false)
    setSaving(null)
  }

  async function savePrepayment() {
    const amount = parseFloat(prepaidForm.amount)
    if (!amount) return
    setSaving('prepayment')
    const patch = { prepaid_amount: amount, prepaid_at: prepaidForm.paid_at, prepaid_method: prepaidForm.method }
    await supabase.from('attestation_applications').update(patch).eq('id', appId)
    await supabase.from('payments').insert({
      amount,
      direction: 'income',
      category: 'Аттестация (предоплата)',
      payment_type: prepaidForm.method,
      description: `Предоплата аттестации: ${app?.target_grade} (${app?.discipline === 'aikido' ? 'айкидо' : 'ушу'})`,
      paid_at: prepaidForm.paid_at,
      student_id: app?.student_id,
      status: 'paid',
      attestation_application_id: appId,
    })
    await notifyAll(`⚡ Предоплата аттестации принята — ${amount} ₽\n${app?.target_grade} (${app?.discipline === 'aikido' ? 'айкидо' : 'ушу'})`)
    setApp(prev => prev ? { ...prev, ...patch } : prev)
    setSaving(null)
  }

  async function saveRemaining() {
    setSaving('remaining')
    const total = app?.price || 0
    const prepaid = app?.prepaid_amount || 0
    const remaining = total > 0 ? total - prepaid : prepaid
    const patch = { paid: true, paid_at: paymentForm.paid_at, payment_method: paymentForm.method }
    await supabase.from('attestation_applications').update(patch).eq('id', appId)
    await supabase.from('payments').insert({
      amount: remaining,
      direction: 'income',
      category: 'Аттестация (остаток)',
      payment_type: paymentForm.method,
      description: `Остаток за аттестацию: ${app?.target_grade} (${app?.discipline === 'aikido' ? 'айкидо' : 'ушу'})`,
      paid_at: paymentForm.paid_at,
      student_id: app?.student_id,
      status: 'paid',
      attestation_application_id: appId,
    })
    await notifyAll(`✅ Оплата аттестации завершена — итого ${total} ₽\n${app?.target_grade}`)
    setApp(prev => prev ? { ...prev, ...patch } : prev)
    setSaving(null)
  }

  async function deletePayment() {
    if (!confirm('Удалить оплату? Запись в кассе тоже будет удалена.')) return
    setSaving('deletepayment')
    const patch = {
      paid: false, paid_at: null, payment_method: null,
      prepaid_amount: null, prepaid_at: null, prepaid_method: null,
    }
    await supabase.from('attestation_applications').update(patch).eq('id', appId)
    await supabase.from('payments').delete().eq('attestation_application_id', appId)
    setApp(prev => prev ? { ...prev, ...patch } : prev)
    setEditingPayment(false)
    setSaving(null)
  }

  async function saveResult() {
    if (!resultForm.result) return
    setSaving('result')
    const patch = {
      result: resultForm.result,
      result_grade: resultForm.grade || null,
      sensei_notes: resultForm.sensei_notes || null,
      result_date: resultForm.date,
      status: 'completed',
    }
    await supabase.from('attestation_applications').update(patch).eq('id', appId)

    // Auto-update belts if passed
    if (resultForm.result !== 'failed' && resultForm.grade && app) {
      await supabase.from('belts').insert({
        student_id: app.student_id,
        belt_name: resultForm.grade,
        date: resultForm.date,
        discipline: app.discipline,
        notes: resultForm.sensei_notes || null,
      })
    }

    // Notify student + parents
    const emoji = resultForm.result === 'passed' ? '🎉' : resultForm.result === 'passed_remarks' ? '✅' : '😔'
    const label = resultForm.result === 'passed' ? 'Поздравляем, аттестация пройдена!' : resultForm.result === 'passed_remarks' ? 'Аттестация пройдена с замечаниями' : 'Аттестация не сдана'
    const resultMsg = [
      `${emoji} ${label}`,
      resultForm.grade ? `Присвоено: ${resultForm.grade}` : '',
      resultForm.sensei_notes ? `Замечания сенсея: ${resultForm.sensei_notes}` : '',
    ].filter(Boolean).join('\n')
    await notifyAll(resultMsg)

    setApp(prev => prev ? { ...prev, ...patch } : prev)
    setSaving(null)
  }

  if (loading) return <main className="max-w-lg mx-auto p-4"><p className="text-gray-400 py-8 text-center">Загрузка...</p></main>
  if (!app || !event) return <main className="max-w-lg mx-auto p-4"><p className="text-red-500">Заявка не найдена</p></main>

  const gradeOptions = app.discipline === 'aikido' ? AIKIDO_GRADES : WUSHU_GRADES
  const discLabel = app.discipline === 'aikido' ? 'Айкидо' : 'Ушу'
  const gradeGroup = event.preatt_groups?.find(g => g.grades.includes(app.target_grade)) || null

  return (
    <main className="max-w-lg mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/attestations/${eventId}`} className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{student?.name || '—'}</h1>
          <p className="text-sm text-gray-500">{discLabel} · {app.current_grade} → {app.target_grade}</p>
        </div>
      </div>

      {/* Application status */}
      {app.status === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-3">
          <span className="text-sm text-amber-800 font-medium">⏳ Заявка ожидает рассмотрения</span>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setAppStatus('rejected')} disabled={saving === 'appstatus'}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-white disabled:opacity-60">
              Отклонить
            </button>
            <button onClick={() => setAppStatus('approved')} disabled={saving === 'appstatus'}
              className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium disabled:opacity-60">
              Одобрить
            </button>
          </div>
        </div>
      )}
      {app.status === 'approved' && !app.result && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm text-green-700 flex items-center justify-between">
          <span>✅ Заявка одобрена</span>
          <button onClick={() => setAppStatus('rejected')} disabled={saving === 'appstatus'}
            className="text-xs text-red-500 hover:underline disabled:opacity-60">отменить</button>
        </div>
      )}
      {app.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 flex items-center justify-between">
          <span>❌ Заявка отклонена</span>
          <button onClick={() => setAppStatus('approved')} disabled={saving === 'appstatus'}
            className="text-xs text-green-600 hover:underline disabled:opacity-60">одобрить</button>
        </div>
      )}

      {/* Student info */}
      <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-600 space-y-1">
        {gradeGroup && (
          <div className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-2 py-1 rounded-lg font-medium mb-1">
            Группа предатт.: {gradeGroup.label}
            {gradeGroup.preatt1_date && <span className="opacity-70 ml-1">· П1: {gradeGroup.preatt1_date}</span>}
            {gradeGroup.preatt2_date && <span className="opacity-70">· П2: {gradeGroup.preatt2_date}</span>}
          </div>
        )}
        <div className="flex gap-4 flex-wrap">
          {student?.group_name && <span>Группа: <strong>{student.group_name}</strong></span>}
          {studentAge !== null && <span>Возраст: <strong>{studentAge} лет</strong></span>}
          {visitCount !== null && <span>Посещений: <strong>{visitCount}</strong></span>}
          {student?.enrollment_date && <span>Занимается с: <strong>{student.enrollment_date}</strong></span>}
        </div>
        {app.last_attestation_date && (
          <p>Последняя аттестация: <strong>{app.last_attestation_date}</strong>
            {app.last_attestation_grade ? ` (${app.last_attestation_grade})` : ''}
            {tenureMonths !== null ? ` — ${tenureMonths} мес. назад` : ''}
          </p>
        )}
      </div>

      {/* Requirements check */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Проверка нормативов</h2>
          {normReq && (
            <button
              onClick={saveAutoCheck}
              disabled={saving === 'autocheck'}
              className="text-xs text-blue-600 hover:underline disabled:opacity-60"
            >
              {saving === 'autocheck' ? 'Сохранение...' : 'Сохранить проверку'}
            </button>
          )}
        </div>

        {normReq ? (
          <>
            <div className="flex gap-2">
              <ReqBadge
                ok={app.req_tenure_ok ?? tenureOk}
                label="Срок"
                actual={tenureMonths !== null ? `${tenureMonths} мес.` : '—'}
                required={`мин. ${normReq.minMonthsSinceLast} мес.`}
              />
              <ReqBadge
                ok={app.req_visits_ok ?? visitsOk}
                label="Посещений"
                actual={visitCount !== null ? String(visitCount) : '—'}
                required={`мин. ${normReq.minVisits}`}
              />
              {normReq.minAge && (
                <ReqBadge
                  ok={app.req_age_ok ?? ageOk}
                  label="Возраст"
                  actual={studentAge !== null ? `${studentAge} лет` : '—'}
                  required={`мин. ${normReq.minAge} лет`}
                />
              )}
            </div>

            {/* Override */}
            {(tenureOk === false || visitsOk === false || ageOk === false) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium text-amber-800">Не проходит по нормативам — допустить вручную?</p>
                <select
                  value={overrideForm.by}
                  onChange={e => setOverrideForm(p => ({ ...p, by: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="">Выберите тренера</option>
                  {trainers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  value={overrideForm.note}
                  onChange={e => setOverrideForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="Причина (необязательно)"
                  className="w-full border rounded-xl px-3 py-2 text-sm"
                />
                <button
                  onClick={saveOverride}
                  disabled={!overrideForm.by || saving === 'override'}
                  className="w-full bg-amber-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60"
                >
                  {saving === 'override' ? 'Сохранение...' : 'Допустить вручную'}
                </button>
              </div>
            )}

            {hasOverride && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                Допущен вручную: <strong>{app.req_override_by}</strong>
                {app.req_override_note ? ` — ${app.req_override_note}` : ''}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">Нормативы для «{app.target_grade}» не найдены</p>
        )}
      </div>

      {/* Pre-attestation 1 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Предаттестация 1</h2>
        {event.preatt1_date && <p className="text-xs text-gray-400">Дата: {event.preatt1_date}</p>}

        <select
          value={preatt1Form.status}
          onChange={e => setPreatt1Form(p => ({ ...p, status: e.target.value }))}
          className="w-full border rounded-xl px-3 py-2 text-sm"
        >
          <option value="">— статус —</option>
          {PREATT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <textarea
          value={preatt1Form.notes}
          onChange={e => setPreatt1Form(p => ({ ...p, notes: e.target.value }))}
          placeholder="Замечания (необязательно)"
          rows={2}
          className="w-full border rounded-xl px-3 py-2 text-sm resize-none"
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Дата</label>
            <input
              type="date"
              value={preatt1Form.date}
              onChange={e => setPreatt1Form(p => ({ ...p, date: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Тренер</label>
            <select
              value={preatt1Form.trainer}
              onChange={e => setPreatt1Form(p => ({ ...p, trainer: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {trainers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={() => savePreatt(1)}
          disabled={saving === 'preatt1'}
          className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60"
        >
          {saving === 'preatt1' ? 'Сохранение...' : 'Сохранить предаттестацию 1'}
        </button>
      </div>

      {/* Pre-attestation 2 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Предаттестация 2</h2>
        {event.preatt2_date && <p className="text-xs text-gray-400">Дата: {event.preatt2_date}</p>}

        <select
          value={preatt2Form.status}
          onChange={e => setPreatt2Form(p => ({ ...p, status: e.target.value }))}
          className="w-full border rounded-xl px-3 py-2 text-sm"
        >
          <option value="">— статус —</option>
          {PREATT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <textarea
          value={preatt2Form.notes}
          onChange={e => setPreatt2Form(p => ({ ...p, notes: e.target.value }))}
          placeholder="Замечания (необязательно)"
          rows={2}
          className="w-full border rounded-xl px-3 py-2 text-sm resize-none"
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Дата</label>
            <input
              type="date"
              value={preatt2Form.date}
              onChange={e => setPreatt2Form(p => ({ ...p, date: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Тренер</label>
            <select
              value={preatt2Form.trainer}
              onChange={e => setPreatt2Form(p => ({ ...p, trainer: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {trainers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={() => savePreatt(2)}
          disabled={saving === 'preatt2'}
          className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60"
        >
          {saving === 'preatt2' ? 'Сохранение...' : 'Сохранить предаттестацию 2'}
        </button>
      </div>

      {/* Payment */}
      <div className={`border rounded-2xl p-4 space-y-3 ${
        app.paid ? 'bg-green-50 border-green-200'
        : app.prepaid_amount ? 'bg-amber-50 border-amber-200'
        : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Оплата</h2>
          {app.paid && <span className="text-green-600 text-sm font-medium">✓ Оплачено</span>}
          {!app.paid && app.prepaid_amount && <span className="text-amber-600 text-sm font-medium">⚡ Предоплата</span>}
        </div>

        {/* Состояние 3: полностью оплачено, просмотр */}
        {app.paid && !editingPayment && (
          <div className="text-sm text-gray-600 space-y-0.5">
            <p>Сумма: <strong>{app.price} ₽</strong></p>
            <p>Способ: <strong>{app.payment_method === 'cash' ? 'Наличные' : app.payment_method === 'card' ? 'Карта' : 'Перевод'}</strong></p>
            {app.paid_at && <p>Дата: <strong>{app.paid_at}</strong></p>}
            {app.prepaid_amount && (
              <p className="text-xs text-gray-400">Предоплата: {app.prepaid_amount} ₽ · Остаток: {(app.price || 0) - app.prepaid_amount} ₽</p>
            )}
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => {
                  setPaymentForm({ price: app.price?.toString() || '', method: app.payment_method || 'cash', paid_at: app.paid_at || today })
                  setLegacyPayment(false)
                  setEditingPayment(true)
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                Изменить оплату
              </button>
              <button
                onClick={deletePayment}
                disabled={saving === 'deletepayment'}
                className="text-xs text-red-500 hover:underline disabled:opacity-60"
              >
                Удалить оплату
              </button>
            </div>
          </div>
        )}

        {/* Состояние 4: редактирование существующей оплаты */}
        {app.paid && editingPayment && (
          <>
            {legacyPayment && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                ⚠️ Запись в кассе создана до обновления — скорректируйте вручную в разделе Финансы
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Сумма (₽)</label>
                <input
                  type="number"
                  value={paymentForm.price}
                  onChange={e => setPaymentForm(p => ({ ...p, price: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Способ оплаты</label>
                <select
                  value={paymentForm.method}
                  onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm"
                >
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Дата оплаты</label>
              <input
                type="date"
                value={paymentForm.paid_at}
                onChange={e => setPaymentForm(p => ({ ...p, paid_at: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveEditPayment}
                disabled={saving === 'editpayment'}
                className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60"
              >
                {saving === 'editpayment' ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={() => { setEditingPayment(false); setLegacyPayment(false) }}
                className="px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-600"
              >
                Отмена
              </button>
            </div>
          </>
        )}

        {/* Состояние 2: принята предоплата, ждём остаток */}
        {!app.paid && app.prepaid_amount && (
          <>
            <div className="text-sm text-amber-800 space-y-0.5">
              <p>Предоплата: <strong>{app.prepaid_amount} ₽</strong></p>
              {app.price && <p>Остаток: <strong>{app.price - app.prepaid_amount} ₽</strong></p>}
              {app.prepaid_at && <p className="text-xs text-amber-600">Дата предоплаты: {app.prepaid_at}</p>}
            </div>
            <div className="border-t border-amber-200 pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-700">
                Принять остаток{app.price ? ` — ${app.price - app.prepaid_amount} ₽` : ''}:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Способ</label>
                  <select
                    value={paymentForm.method}
                    onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm"
                  >
                    {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Дата</label>
                  <input
                    type="date"
                    value={paymentForm.paid_at}
                    onChange={e => setPaymentForm(p => ({ ...p, paid_at: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={saveRemaining}
                disabled={saving === 'remaining'}
                className="w-full bg-green-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60"
              >
                {saving === 'remaining'
                  ? 'Сохранение...'
                  : `Принять остаток${app.price ? ` (${app.price - app.prepaid_amount} ₽)` : ''}`}
              </button>
            </div>
          </>
        )}

        {/* Состояние 1: ещё не оплачено */}
        {!app.paid && !app.prepaid_amount && (
          <>
            {/* Переключатель режима */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm">
              <button
                onClick={() => setPaymentMode('full')}
                className={`flex-1 py-2 font-medium transition-colors ${paymentMode === 'full' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'}`}
              >
                Полная оплата
              </button>
              <button
                onClick={() => setPaymentMode('installment')}
                className={`flex-1 py-2 font-medium transition-colors ${paymentMode === 'installment' ? 'bg-amber-500 text-white' : 'bg-white text-gray-500'}`}
              >
                Рассрочка
              </button>
            </div>

            {paymentMode === 'full' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Сумма (₽)</label>
                    <input
                      type="number"
                      value={paymentForm.price}
                      onChange={e => setPaymentForm(p => ({ ...p, price: e.target.value }))}
                      placeholder={app.price?.toString() || '1500'}
                      className="w-full border rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Способ оплаты</label>
                    <select
                      value={paymentForm.method}
                      onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2 text-sm"
                    >
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Дата оплаты</label>
                  <input
                    type="date"
                    value={paymentForm.paid_at}
                    onChange={e => setPaymentForm(p => ({ ...p, paid_at: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={savePayment}
                  disabled={saving === 'payment'}
                  className="w-full bg-green-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60"
                >
                  {saving === 'payment' ? 'Сохранение...' : 'Отметить как оплачено'}
                </button>
                {app.price && (
                  <p className="text-xs text-gray-400 text-center">Рекомендованная цена: {app.price} ₽</p>
                )}
              </>
            )}

            {paymentMode === 'installment' && (
              <>
                <p className="text-xs text-gray-500">Введите сумму предоплаты. Остаток примете позже.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Предоплата (₽)</label>
                    <input
                      type="number"
                      value={prepaidForm.amount}
                      onChange={e => setPrepaidForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="500"
                      className="w-full border rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Способ</label>
                    <select
                      value={prepaidForm.method}
                      onChange={e => setPrepaidForm(p => ({ ...p, method: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2 text-sm"
                    >
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Дата</label>
                  <input
                    type="date"
                    value={prepaidForm.paid_at}
                    onChange={e => setPrepaidForm(p => ({ ...p, paid_at: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                {app.price && prepaidForm.amount && (
                  <p className="text-xs text-gray-400">
                    Полная стоимость: {app.price} ₽ · Остаток: {app.price - (parseFloat(prepaidForm.amount) || 0)} ₽
                  </p>
                )}
                <button
                  onClick={savePrepayment}
                  disabled={!prepaidForm.amount || saving === 'prepayment'}
                  className="w-full bg-amber-500 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60"
                >
                  {saving === 'prepayment' ? 'Сохранение...' : 'Записать предоплату'}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Result */}
      <div className={`border rounded-2xl p-4 space-y-3 ${app.result ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'}`}>
        <h2 className="font-semibold text-gray-800">Результат аттестации</h2>

        {app.result && !saving ? (
          <div className="text-sm text-gray-700 space-y-1">
            <p>Итог: <strong className={app.result === 'passed' ? 'text-green-600' : app.result === 'failed' ? 'text-red-500' : 'text-amber-600'}>
              {RESULT_STATUSES.find(r => r.value === app.result)?.label}
            </strong></p>
            {app.result_grade && <p>Присвоено: <strong>{app.result_grade}</strong></p>}
            {app.sensei_notes && <p>Замечания: {app.sensei_notes}</p>}
            {app.result_date && <p>Дата: {app.result_date}</p>}
            <button onClick={() => setApp(prev => prev ? { ...prev, result: null } : prev)} className="text-xs text-blue-600 hover:underline mt-1">
              Изменить результат
            </button>
          </div>
        ) : (
          <>
            <select
              value={resultForm.result}
              onChange={e => setResultForm(p => ({ ...p, result: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2 text-sm"
            >
              <option value="">— результат —</option>
              {RESULT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {resultForm.result && resultForm.result !== 'failed' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Присвоенный кю / степень</label>
                <select
                  value={resultForm.grade}
                  onChange={e => setResultForm(p => ({ ...p, grade: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}

            <textarea
              value={resultForm.sensei_notes}
              onChange={e => setResultForm(p => ({ ...p, sensei_notes: e.target.value }))}
              placeholder="Замечания сенсея (необязательно)"
              rows={2}
              className="w-full border rounded-xl px-3 py-2 text-sm resize-none"
            />

            <div>
              <label className="text-xs text-gray-500 block mb-1">Дата</label>
              <input
                type="date"
                value={resultForm.date}
                onChange={e => setResultForm(p => ({ ...p, date: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <button
              onClick={saveResult}
              disabled={!resultForm.result || saving === 'result'}
              className="w-full bg-purple-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60"
            >
              {saving === 'result' ? 'Сохранение...' : 'Внести результат'}
            </button>

            {resultForm.result !== 'failed' && (
              <p className="text-xs text-gray-400 text-center">При сохранении кю автоматически добавится в карточку ученика</p>
            )}
          </>
        )}
      </div>

      {/* Event info */}
      <div className="text-xs text-gray-400 text-center pb-2">{event.title} · {event.event_date}</div>
    </main>
  )
}
