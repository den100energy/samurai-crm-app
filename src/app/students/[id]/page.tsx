'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  name: string
  phone: string | null
  birth_date: string | null
  group_name: string | null
  status: string
  parent_token: string | null
  health_notes: string | null
  invite_token: string | null
  telegram_chat_id: number | null
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
  bonuses_used: Record<string, number> | null
  is_frozen: boolean
  freeze_start: string | null
  freeze_end: string | null
  freeze_days_used: number
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
}

const GROUPS = ['Дети 4-9', 'Подростки (нач)', 'Подростки (оп)', 'Цигун', 'Индивидуальные']
const BELTS = ['Белый', 'Жёлтый', 'Оранжевый', 'Зелёный', 'Синий', 'Фиолетовый', 'Коричневый', 'Чёрный']

const BELT_COLORS: Record<string, string> = {
  'Белый': 'bg-gray-100 text-gray-700',
  'Жёлтый': 'bg-yellow-100 text-yellow-700',
  'Оранжевый': 'bg-orange-100 text-orange-700',
  'Зелёный': 'bg-green-100 text-green-700',
  'Синий': 'bg-blue-100 text-blue-700',
  'Фиолетовый': 'bg-purple-100 text-purple-700',
  'Коричневый': 'bg-amber-100 text-amber-800',
  'Чёрный': 'bg-gray-800 text-white',
}

export default function StudentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [student, setStudent] = useState<Student | null>(null)
  const [subs, setSubs] = useState<Subscription[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [belts, setBelts] = useState<Belt[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Student>>({})
  const [showSubForm, setShowSubForm] = useState(false)
  const [subForm, setSubForm] = useState({ type: '', sessions_total: '', start_date: '', end_date: '', amount: '', paid: false, bonuses: {} as Record<string, number> })
  const [showBeltForm, setShowBeltForm] = useState(false)
  const [beltForm, setBeltForm] = useState({ belt_name: '', date: new Date().toISOString().split('T')[0], notes: '' })
  const [subTypes, setSubTypes] = useState<{ id: string; name: string; group_type: string | null; sessions_count: number | null; price: number | null; bonuses: Record<string, number> | null; duration_months: number | null }[]>([])
  const [showQR, setShowQR] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editSubId, setEditSubId] = useState<string | null>(null)
  const [editSubForm, setEditSubForm] = useState({ sessions_total: '', sessions_left: '', start_date: '', end_date: '', amount: '', paid: false })
  const [freezeSubId, setFreezeSubId] = useState<string | null>(null)
  const [freezeForm, setFreezeForm] = useState({ freeze_start: '', freeze_end: '' })
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketForm, setTicketForm] = useState({ type: '', description: '' })
  const [showAddAttendance, setShowAddAttendance] = useState(false)
  const [addAttDate, setAddAttDate] = useState(new Date().toISOString().split('T')[0])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', role: 'мама', phone: '' })
  const [survey, setSurvey] = useState<any>(null)
  const [showSurvey, setShowSurvey] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState(false)
  const [surveyForm, setSurveyForm] = useState<any>({})
  const [progressSurvey, setProgressSurvey] = useState<any>(null)
  const [showProgressTrainer, setShowProgressTrainer] = useState(false)
  const [editingProgressTrainer, setEditingProgressTrainer] = useState(false)
  const [progressTrainerForm, setProgressTrainerForm] = useState<Record<string, any>>({})
  const [savingProgressTrainer, setSavingProgressTrainer] = useState(false)
  const [studentProfile, setStudentProfile] = useState<any>(null)
  const [compareProgram, setCompareProgram] = useState('')
  const [generatingCompare, setGeneratingCompare] = useState(false)
  const [payments, setPayments] = useState<{ id: string; amount: number; category: string | null; paid_at: string; payment_type: string; description: string | null }[]>([])

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: sb }, { data: at }, { data: bl }, { data: st }, { data: ct }, { data: sv }, { data: ps }, { data: sp }, { data: py }] = await Promise.all([
        supabase.from('students').select('*').eq('id', id).single(),
        supabase.from('subscriptions').select('*').eq('student_id', id).order('created_at', { ascending: false }),
        supabase.from('attendance').select('*').eq('student_id', id).order('date', { ascending: false }).limit(20),
        supabase.from('belts').select('*').eq('student_id', id).order('date', { ascending: false }),
        supabase.from('subscription_types').select('id, name, group_type, sessions_count, price, bonuses, duration_months').order('created_at'),
        supabase.from('student_contacts').select('*').eq('student_id', id).order('created_at'),
        supabase.from('diagnostic_surveys').select('*').eq('student_id', id).maybeSingle(),
        supabase.from('progress_surveys').select('*').eq('student_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('student_profiles').select('*').eq('student_id', id).maybeSingle(),
        supabase.from('payments').select('id, amount, category, paid_at, payment_type, description').eq('student_id', id).order('paid_at', { ascending: false }).limit(20),
      ])
      if (s) { setStudent(s); setForm(s) }
      setSubs(sb || [])
      setAttendance(at || [])
      setBelts(bl || [])
      setSubTypes(st || [])
      setContacts(ct || [])
      setSurvey(sv || null)
      if (ps) {
        setProgressSurvey(ps)
        const init: Record<string, any> = { trainer_notes: ps.trainer_notes || '' }
        const PQ = ['strength','speed','endurance','agility','coordination','posture','flexibility','discipline','sociability','confidence','learnability','attentiveness','emotional_balance','goal_orientation','activity','self_defense']
        PQ.forEach(k => { init[`trainer_${k}`] = ps[`trainer_${k}`] ?? 5 })
        setProgressTrainerForm(init)
      }
      if (sp) setStudentProfile(sp)
      setPayments(py || [])
    }
    load()
  }, [id])

  async function saveStudent() {
    setSaving(true)
    await supabase.from('students').update({
      name: form.name,
      phone: form.phone || null,
      birth_date: form.birth_date || null,
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

    const { data } = await supabase.from('subscriptions').insert({
      student_id: id,
      type: subForm.type,
      sessions_total: sessions,
      sessions_left: sessionsLeft,
      start_date: subForm.start_date || null,
      end_date: subForm.end_date || null,
      amount: subForm.amount ? parseFloat(subForm.amount) : null,
      paid: subForm.paid,
      bonuses: subForm.bonuses,
      bonuses_used: {},
    }).select().single()

    if (data) {
      setSubs(prev => [data, ...prev])
      if (attended > 0) {
        alert(`✅ Абонемент добавлен.\n\nАвтоматически списано ${attended} занят. (с ${subForm.start_date}).\nОсталось: ${sessionsLeft} из ${sessions}.`)
      }
    }
    setShowSubForm(false)
    setSubForm({ type: '', sessions_total: '', start_date: '', end_date: '', amount: '', paid: false, bonuses: {} })
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
    await supabase.from('tickets').insert({
      student_id: id,
      type: ticketForm.type,
      description: ticketForm.description || null,
      status: 'pending',
    })
    setShowTicketForm(false)
    setTicketForm({ type: '', description: '' })
    alert('Обращение создано!')
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

  async function useBonus(subId: string, bonusName: string, bonuses: Record<string, number>, bonusesUsed: Record<string, number>) {
    const total = bonuses[bonusName] || 0
    const used = bonusesUsed[bonusName] || 0
    if (used >= total) return
    const newUsed = { ...bonusesUsed, [bonusName]: used + 1 }
    await supabase.from('subscriptions').update({ bonuses_used: newUsed }).eq('id', subId)
    setSubs(prev => prev.map(s => s.id === subId ? { ...s, bonuses_used: newUsed } : s))
  }

  async function togglePaid(subId: string, paid: boolean) {
    await supabase.from('subscriptions').update({ paid: !paid }).eq('id', subId)
    setSubs(prev => prev.map(s => s.id === subId ? { ...s, paid: !paid } : s))
  }

  async function addBelt(e: React.FormEvent) {
    e.preventDefault()
    const { data } = await supabase.from('belts').insert({
      student_id: id,
      belt_name: beltForm.belt_name,
      date: beltForm.date,
      notes: beltForm.notes || null,
    }).select().single()
    if (data) setBelts(prev => [data, ...prev])
    setShowBeltForm(false)
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
    const { data } = await supabase.from('progress_surveys').insert({ student_id: id }).select().single()
    if (data) {
      setProgressSurvey(data)
      const init: Record<string, any> = { trainer_notes: '' }
      PROGRESS_QUALITIES.forEach(k => { init[`trainer_${k}`] = 5 })
      setProgressTrainerForm(init)
      setEditingProgressTrainer(true)
    }
  }

  async function saveProgressTrainer() {
    if (!progressSurvey) return
    setSavingProgressTrainer(true)
    const payload = { ...progressTrainerForm, trainer_filled_at: new Date().toISOString() }
    const { data } = await supabase.from('progress_surveys').update(payload).eq('id', progressSurvey.id).select().single()
    if (data) setProgressSurvey(data)
    setEditingProgressTrainer(false)
    setSavingProgressTrainer(false)
  }

  async function copyProgressLink(forWho: 'parent' | 'student') {
    if (!progressSurvey) return
    const url = `${window.location.origin}/survey2/${progressSurvey.survey_token}`
    const studentName = student?.name || 'ученика'

    let message = ''
    if (forWho === 'parent') {
      message = `Здравствуйте!\n\nПрошёл первый месяц занятий ${studentName} в Школе Самурая 🥋\n\nТренер подготовил персональную программу — но сначала нам важно узнать ваш взгляд на прогресс. Это займёт 3–4 минуты.\n\nВаши ответы помогут:\n✅ Скорректировать программу под цели именно вашего ребёнка\n📊 Увидеть прогресс в цифрах\n🎯 Сфокусироваться на том, что важно для вас\n\nЗаполните анкету:\n${url}`
      await supabase.from('progress_surveys').update({ parent_sent_at: new Date().toISOString() }).eq('id', progressSurvey.id)
      setProgressSurvey((p: any) => ({ ...p, parent_sent_at: new Date().toISOString() }))
    } else {
      message = `Привет!\n\nПрошёл твой первый месяц в Школе Самурая 🥋 Это серьёзно — мало кто доходит до этого момента.\n\nХотим знать твоё мнение о своём прогрессе — твои ощущения важны для тренера так же, как и результаты на занятиях.\n\n💪 Программа на следующие 3 месяца будет построена с учётом твоего мнения\n\nЗаполни анкету:\n${url}`
      await supabase.from('progress_surveys').update({ student_sent_at: new Date().toISOString() }).eq('id', progressSurvey.id)
      setProgressSurvey((p: any) => ({ ...p, student_sent_at: new Date().toISOString() }))
    }

    navigator.clipboard.writeText(message)
    alert(`Текст скопирован!\n\nОтправьте ${forWho === 'parent' ? 'родителю' : 'ученику'} в Telegram или WhatsApp.`)
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

  function copyParentLink() {
    if (!student?.parent_token) return alert('Токен не найден')
    const url = `${window.location.origin}/parent/${student.parent_token}`
    navigator.clipboard.writeText(url)
    alert('Ссылка скопирована!\n' + url)
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
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-600">
            {student.name[0]}
          </div>
          {editing ? (
            <input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-lg font-semibold outline-none" />
          ) : (
            <div>
              <div className="text-lg font-semibold text-gray-800">{student.name}</div>
              <div className="text-sm text-gray-400">{student.group_name || 'Группа не указана'}</div>
              {currentBelt && (
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${BELT_COLORS[currentBelt.belt_name] || 'bg-gray-100 text-gray-600'}`}>
                  {currentBelt.belt_name} пояс
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
              type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
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
                      {t.name}{t.sessions_count ? ` (${t.sessions_count} зан.)` : ''}{t.price ? ` — ${t.price.toLocaleString()} ₽` : ''}
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
            <button type="submit" className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium">
              Сохранить
            </button>
          </form>
        )}

        {subs.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-2">Абонементов нет</div>
        ) : (
          <div className="space-y-3">
            {subs.map(s => {
              const bonuses = s.bonuses || {}
              const bonusesUsed = s.bonuses_used || {}
              const bonusKeys = Object.keys(bonuses)
              return (
                <div key={s.id} className="p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">{s.type.includes('|') ? s.type.split('|').join(' · ') : s.type}</div>
                        {s.is_frozen && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">🧊 Заморожен</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {s.sessions_left != null ? `${s.sessions_left}/${s.sessions_total} занятий` : ''}
                        {s.end_date ? ` · до ${s.end_date}` : ''}
                        {s.amount ? ` · ${s.amount.toLocaleString()} ₽` : ''}
                      </div>
                      {s.is_frozen && s.freeze_end && (
                        <div className="text-xs text-blue-500 mt-0.5">Заморозка до {s.freeze_end} · {s.freeze_days_used} дн.</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
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
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                      <div className="text-xs font-medium text-gray-500">Бонусы:</div>
                      {bonusKeys.map(bonus => {
                        const total = bonuses[bonus]
                        const used = bonusesUsed[bonus] || 0
                        const remaining = total - used
                        return (
                          <div key={bonus} className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <div className="text-xs text-gray-700">{bonus}</div>
                              <div className="flex gap-0.5 mt-0.5">
                                {Array.from({ length: total }).map((_, i) => (
                                  <div key={i} className={`w-3 h-3 rounded-full ${i < used ? 'bg-gray-400' : 'bg-blue-400'}`} />
                                ))}
                                <span className="text-xs text-gray-400 ml-1">{used}/{total}</span>
                              </div>
                            </div>
                            {remaining > 0 && (
                              <button onClick={() => useBonus(s.id, bonus, bonuses, bonusesUsed)}
                                className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded-lg">
                                Использовать
                              </button>
                            )}
                            {remaining === 0 && (
                              <span className="text-xs text-gray-400">Использован</span>
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
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800">Пояса и аттестации</div>
          <button onClick={() => setShowBeltForm(!showBeltForm)}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1 rounded-xl">
            + Добавить
          </button>
        </div>

        {showBeltForm && (
          <form onSubmit={addBelt} className="space-y-2 mb-4 p-3 bg-gray-50 rounded-xl">
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
            <button type="submit" className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium">
              Сохранить
            </button>
          </form>
        )}

        {belts.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-2">Аттестаций нет</div>
        ) : (
          <div className="space-y-2">
            {belts.map((b, i) => (
              <div key={b.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${BELT_COLORS[b.belt_name] || 'bg-gray-100 text-gray-600'}`}>
                    {b.belt_name}
                  </span>
                  <div>
                    <div className="text-xs text-gray-500">{b.date}</div>
                    {b.notes && <div className="text-xs text-gray-400">{b.notes}</div>}
                  </div>
                  {i === 0 && <span className="text-xs text-gray-400">(текущий)</span>}
                </div>
                <button onClick={() => deleteBelt(b.id)} className="text-xs text-red-400">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attendance */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800">История посещений</div>
          <button onClick={() => setShowAddAttendance(v => !v)}
            className="text-sm text-black border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">
            {showAddAttendance ? 'Отмена' : '+ Занятие'}
          </button>
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

        {attendance.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-2">Нет данных</div>
        ) : (
          <div className="space-y-1">
            {attendance.map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{a.date}</span>
                <span>{a.present ? '✅ Был' : '❌ Не был'}</span>
              </div>
            ))}
          </div>
        )}
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
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-800">{c.name}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{c.role}</span>
                    {c.telegram_chat_id
                      ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Telegram</span>
                      : <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Нет Telegram</span>
                    }
                  </div>
                  <button onClick={() => deleteContact(c.id)} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
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

      {/* Ticket form */}
      {showTicketForm ? (
        <form onSubmit={createTicket} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-2 space-y-2">
          <div className="font-semibold text-gray-800 text-sm mb-1">Новое обращение</div>
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
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none" />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium">
              Отправить
            </button>
            <button type="button" onClick={() => setShowTicketForm(false)}
              className="px-4 border border-gray-200 text-gray-500 py-2 rounded-xl text-sm">
              Отмена
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowTicketForm(true)}
          className="w-full border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl mb-2">
          📝 Создать обращение
        </button>
      )}

      {/* Анкета прогресса (Анкета 2) */}
      {(() => {
        const firstAttendance = attendance.length > 0 ? attendance[attendance.length - 1].date : null
        const daysSinceCreated = firstAttendance ? Math.floor((Date.now() - new Date(firstAttendance).getTime()) / 86400000) : 0
        const waitingParent = progressSurvey?.parent_sent_at && !progressSurvey?.filled_at
        const daysSinceSent = progressSurvey?.parent_sent_at ? Math.floor((Date.now() - new Date(progressSurvey.parent_sent_at).getTime()) / 86400000) : 0
        const isOverdue = waitingParent && daysSinceSent >= 3

        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-2 overflow-hidden">
            <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="flex-1 text-sm font-medium text-gray-800">
                📈 Срез прогресса (Анкета 2)
                {progressSurvey?.filled_at && <span className="ml-2 text-green-600 text-xs">✓ Заполнена</span>}
                {isOverdue && <span className="ml-2 text-orange-500 text-xs font-semibold">⏰ Нет ответа {daysSinceSent}д</span>}
                {progressSurvey?.parent_sent_at && !progressSurvey?.filled_at && !isOverdue && <span className="ml-2 text-blue-500 text-xs">⏳ Ожидаем</span>}
              </span>
              {progressSurvey && !editingProgressTrainer && (
                <button onClick={() => setShowProgressTrainer(v => !v)}
                  className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-lg">
                  {showProgressTrainer ? '▲' : '▼'}
                </button>
              )}
            </div>

            <div className="px-4 py-3">
              {/* Нет анкеты — показываем подсказку если пора */}
              {!progressSurvey && (
                <div>
                  {daysSinceCreated >= 28 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-700">
                      ⏰ Прошло {daysSinceCreated} дней с начала занятий — пора сделать срез прогресса!
                    </div>
                  )}
                  <button onClick={createProgressSurvey}
                    className="w-full border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl">
                    + Начать срез прогресса
                  </button>
                </div>
              )}

              {/* Шаг 1: оценки тренера */}
              {progressSurvey && !progressSurvey.trainer_filled_at && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">
                    <span className="font-medium text-gray-700">Шаг 1 из 2:</span> Сначала оцените прогресс ученика сами — до того как родитель заполнит анкету
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
                        placeholder="Заметки о прогрессе ученика за месяц..." rows={3}
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
                            {progressSurvey?.[`q_${k}`] != null && (
                              <span className="text-xs text-gray-400 w-8">р:{progressSurvey[`q_${k}`]}</span>
                            )}
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
              {progressSurvey?.trainer_filled_at && !progressSurvey?.filled_at && (
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
                      ${progressSurvey.parent_sent_at ? 'border-green-200 bg-green-50 text-green-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                    {progressSurvey.parent_sent_at ? '✓ Родителю отправлено — скопировать снова' : '📨 Скопировать текст для родителя'}
                  </button>
                  {student?.birth_date && (() => {
                    const age = Math.floor((Date.now() - new Date(student.birth_date).getTime()) / (365.25 * 86400000))
                    return age >= 11 ? (
                      <button onClick={() => copyProgressLink('student')}
                        className={`w-full text-xs py-2.5 rounded-xl border font-medium
                          ${progressSurvey.student_sent_at ? 'border-green-200 bg-green-50 text-green-700' : 'border-purple-200 bg-purple-50 text-purple-700'}`}>
                        {progressSurvey.student_sent_at ? '✓ Ученику отправлено — скопировать снова' : '📨 Скопировать текст для ученика'}
                      </button>
                    ) : null
                  })()}
                  {isOverdue && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 text-xs text-orange-700">
                      ⏰ Анкета отправлена {daysSinceSent} дн. назад — нет ответа. Напомните родителю лично.
                    </div>
                  )}
                </div>
              )}

              {/* Заполнена — показать данные */}
              {progressSurvey?.filled_at && showProgressTrainer && (
                <div className="pt-2 text-xs space-y-3">
                  <div className="text-gray-500">
                    Заполнил: <span className="font-medium text-gray-700">{progressSurvey.filled_by === 'parent' ? 'Родитель' : 'Ученик'}</span>
                  </div>
                  {progressSurvey.trainer_notes && (
                    <div className="italic text-gray-600">"{progressSurvey.trainer_notes}"</div>
                  )}
                  <div>
                    <div className="text-gray-500 font-medium mb-1.5">16 качеств — тренер / родитель:</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {PROGRESS_QUALITIES.map(k => {
                        const t = progressSurvey[`trainer_${k}`]
                        const r = progressSurvey[`q_${k}`]
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
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* AI: Сравнение Анкеты 1 и Анкеты 2 */}
      {survey?.filled_at && progressSurvey?.filled_at && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-2 overflow-hidden">
          <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="flex-1 text-sm font-medium text-gray-800">✨ Анализ прогресса (ИИ)</span>
          </div>
          <div className="px-4 py-3 space-y-3">
            <button
              onClick={async () => {
                setGeneratingCompare(true)
                const res = await fetch('/api/compare-surveys', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ survey1: survey, survey2: progressSurvey, studentName: student?.name }),
                })
                const data = await res.json()
                if (data.program) setCompareProgram(data.program)
                setGeneratingCompare(false)
              }}
              disabled={generatingCompare}
              className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {generatingCompare ? '⏳ Генерация...' : compareProgram ? '🔄 Обновить анализ' : '✨ Сравнить анкеты и сгенерировать программу'}
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
