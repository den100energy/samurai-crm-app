'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
  applications_open_at: string | null
  preatt1_date: string | null
  preatt2_date: string | null
  event_date: string
  status: string
  notes: string | null
  preatt_groups: PreattGroup[] | null
}

type Application = {
  id: string
  student_id: string
  discipline: string
  current_grade: string
  target_grade: string
  req_tenure_ok: boolean | null
  req_visits_ok: boolean | null
  req_age_ok: boolean | null
  req_override_by: string | null
  paid: boolean
  price: number | null
  preatt1_status: string | null
  preatt2_status: string | null
  result: string | null
  result_grade: string | null
  status: string
  students: { name: string } | null
}

const EVENT_STATUS_INFO: Record<string, { label: string; color: string }> = {
  draft:       { label: 'Черновик',     color: 'bg-gray-100 text-gray-600' },
  open:        { label: 'Приём заявок', color: 'bg-green-100 text-green-700' },
  in_progress: { label: 'Идёт',        color: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Завершена',   color: 'bg-purple-100 text-purple-600' },
}
const EVENT_STATUS_NEXT: Record<string, string> = {
  draft: 'open', open: 'in_progress', in_progress: 'completed',
}
const EVENT_STATUS_NEXT_LABEL: Record<string, string> = {
  draft: 'Открыть приём заявок', open: 'Начать аттестацию', in_progress: 'Завершить',
}

const PREATT_INFO: Record<string, { color: string; symbol: string }> = {
  approved:    { color: 'text-green-600', symbol: '✓' },
  conditional: { color: 'text-amber-600', symbol: '~' },
  rejected:    { color: 'text-red-500',   symbol: '✗' },
}
const RESULT_INFO: Record<string, { label: string; color: string }> = {
  passed:         { label: 'Сдал',     color: 'text-green-600' },
  passed_remarks: { label: 'С замеч.', color: 'text-amber-600' },
  failed:         { label: 'Не сдал', color: 'text-red-500' },
}
const DISC_LABEL: Record<string, string> = {
  aikido: 'Айкидо', wushu: 'Ушу', both: 'Айкидо + Ушу',
}

const AIKIDO_GRADES = ['11 кю', '10 кю', '9 кю', '8 кю', '7 кю', '6 кю', '5 кю', '4 кю', '3 кю', '2 кю', '1 кю', '1 дан', '2 дан', '3 дан', '4 дан']
const WUSHU_GRADES  = ['10 туди', '9 туди', '8 туди', '7 туди', '6 туди', '5 туди', '4 туди', '3 туди', '2 туди', '1 степень', '2 степень', '3 степень', '4 степень']

function reqIcon(val: boolean | null, override: boolean) {
  if (override) return <span className="text-amber-500 text-xs font-medium">допуск</span>
  if (val === true)  return <span className="text-green-600">✓</span>
  if (val === false) return <span className="text-red-500">✗</span>
  return <span className="text-gray-300">—</span>
}

function getGroup(groups: PreattGroup[] | null, grade: string): PreattGroup | null {
  if (!groups) return null
  return groups.find(g => g.grades.includes(grade)) || null
}

const GROUP_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-green-50 text-green-700 border-green-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-teal-50 text-teal-700 border-teal-200',
]

export default function AttestationEventPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<AttestationEvent | null>(null)
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [discFilter, setDiscFilter] = useState<'all' | 'aikido' | 'wushu'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [students, setStudents] = useState<{ id: string; name: string }[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [addForm, setAddForm] = useState({ student_id: '', discipline: 'aikido', current_grade: '', target_grade: '', last_attestation_date: '' })
  const [saving, setSaving] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [showGroupSchedule, setShowGroupSchedule] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', applications_open_at: '', event_date: '', notes: '' })
  const [editGroups, setEditGroups] = useState<PreattGroup[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [dashFilter, setDashFilter] = useState<string | null>(null)

  async function load() {
    const [{ data: ev }, { data: ap }, { data: stu }] = await Promise.all([
      supabase.from('attestation_events').select('*').eq('id', id).single(),
      supabase.from('attestation_applications').select('*, students(name)').eq('event_id', id).order('submitted_at', { ascending: true }),
      supabase.from('students').select('id, name').eq('status', 'active').order('name'),
    ])
    const evData = ev as AttestationEvent
    setEvent(evData)
    setApps((ap as Application[]) || [])
    setStudents((stu as any[]) || [])
    if (evData) {
      const defaultDisc = evData.discipline === 'wushu' ? 'wushu' : 'aikido'
      setAddForm(p => ({ ...p, discipline: defaultDisc }))
      setEditForm({
        title: evData.title,
        applications_open_at: evData.applications_open_at || '',
        event_date: evData.event_date,
        notes: evData.notes || '',
      })
      setEditGroups(evData.preatt_groups ? evData.preatt_groups.map(g => ({ ...g })) : [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function advanceStatus() {
    if (!event) return
    const next = EVENT_STATUS_NEXT[event.status]
    if (!next) return
    setChangingStatus(true)
    await supabase.from('attestation_events').update({ status: next }).eq('id', id)
    setEvent(prev => prev ? { ...prev, status: next } : prev)
    setChangingStatus(false)
  }

  async function saveEdit(e: { preventDefault(): void }) {
    e.preventDefault()
    setEditSaving(true)
    await supabase.from('attestation_events').update({
      title: editForm.title,
      applications_open_at: editForm.applications_open_at || null,
      event_date: editForm.event_date,
      notes: editForm.notes || null,
      preatt_groups: editGroups.length > 0 ? editGroups : null,
    }).eq('id', id)
    setShowEditForm(false)
    setEditSaving(false)
    load()
  }

  function updateEditGroup(idx: number, field: 'preatt1_date' | 'preatt2_date', value: string) {
    setEditGroups(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g))
  }

  async function addApplication(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!addForm.student_id || !addForm.target_grade) return
    setSaving(true)
    const price = calcPrice(addForm.discipline, addForm.target_grade)
    await supabase.from('attestation_applications').insert({
      event_id: id,
      student_id: addForm.student_id,
      discipline: addForm.discipline,
      current_grade: addForm.current_grade,
      target_grade: addForm.target_grade,
      last_attestation_date: addForm.last_attestation_date || null,
      price,
      status: 'pending',
    })
    setShowAddForm(false)
    setAddForm(p => ({ ...p, student_id: '', current_grade: '', target_grade: '', last_attestation_date: '' }))
    setStudentSearch('')
    setSaving(false)
    load()
  }

  function calcPrice(disc: string, grade: string): number {
    if (disc === 'aikido') {
      return ['5 кю', '4 кю', '3 кю', '2 кю', '1 кю', '1 дан', '2 дан', '3 дан', '4 дан'].includes(grade) ? 2500 : 1500
    }
    return ['1 степень', '2 степень', '3 степень', '4 степень'].includes(grade) ? 2500 : 1500
  }

  const studentName = (app: Application) => {
    if (!app.students) return '—'
    return Array.isArray(app.students) ? (app.students[0] as any)?.name : (app.students as any).name
  }

  const gradeOptions = addForm.discipline === 'aikido' ? AIKIDO_GRADES : WUSHU_GRADES
  const filteredStudents = studentSearch
    ? students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase())).slice(0, 6)
    : []

  // Build group index map: grade → group index (for color)
  const groupIndexMap = new Map<string, number>()
  if (event?.preatt_groups) {
    event.preatt_groups.forEach((g, idx) => {
      g.grades.forEach(grade => groupIndexMap.set(grade, idx))
    })
  }

  if (loading) return <div className="ap"><main className="max-w-2xl mx-auto p-4"><p className="text-gray-400 py-8 text-center">Загрузка...</p></main></div>
  if (!event) return <div className="ap"><main className="max-w-2xl mx-auto p-4"><p className="text-red-500">Мероприятие не найдено</p></main></div>

  const si = EVENT_STATUS_INFO[event.status] || EVENT_STATUS_INFO.draft
  const totalApps = apps.length
  const admittedCount  = apps.filter(a => a.req_override_by != null || (a.req_tenure_ok !== false && a.req_visits_ok !== false && a.req_age_ok !== false && (a.req_tenure_ok !== null || a.req_visits_ok !== null || a.req_age_ok !== null))).length
  const preatt1Count   = apps.filter(a => a.preatt1_status === 'approved' || a.preatt1_status === 'conditional').length
  const paidCount      = apps.filter(a => a.paid).length
  const preatt2Count   = apps.filter(a => a.preatt2_status === 'approved' || a.preatt2_status === 'conditional').length
  const passedCount    = apps.filter(a => a.result === 'passed' || a.result === 'passed_remarks').length

  const DASH_STATS = [
    { key: 'all',     icon: '📋', label: 'Заявок',  val: totalApps,    fn: () => apps },
    { key: 'admitted',icon: '✅', label: 'Допущ.',   val: admittedCount, fn: () => apps.filter(a => a.req_override_by != null || (a.req_tenure_ok !== false && a.req_visits_ok !== false && a.req_age_ok !== false && (a.req_tenure_ok !== null || a.req_visits_ok !== null || a.req_age_ok !== null))) },
    { key: 'preatt1', icon: '1️⃣', label: 'Пред.1',   val: preatt1Count,  fn: () => apps.filter(a => a.preatt1_status === 'approved' || a.preatt1_status === 'conditional') },
    { key: 'paid',    icon: '💳', label: 'Оплатили', val: paidCount,     fn: () => apps.filter(a => a.paid) },
    { key: 'preatt2', icon: '2️⃣', label: 'Пред.2',   val: preatt2Count,  fn: () => apps.filter(a => a.preatt2_status === 'approved' || a.preatt2_status === 'conditional') },
    { key: 'passed',  icon: '🎖', label: 'Сдали',    val: passedCount,   fn: () => apps.filter(a => a.result === 'passed' || a.result === 'passed_remarks') },
  ]
  const dashFiltered = dashFilter ? (DASH_STATS.find(s => s.key === dashFilter)?.fn() ?? apps) : apps
  const filtered = discFilter === 'all' ? dashFiltered : dashFiltered.filter((a: Application) => a.discipline === discFilter)

  return (
    <div className="ap">
    <style>{`
      body { background: #ffffff !important; color: #111827 !important; }
      .ap  { background: #ffffff; min-height: 100vh; }

      [data-theme="dark"] .ap .bg-white    { background: #ffffff !important; }
      [data-theme="dark"] .ap .bg-gray-50  { background: #f9fafb !important; }
      [data-theme="dark"] .ap .bg-gray-100 { background: #f3f4f6 !important; }
      [data-theme="dark"] .ap .bg-gray-200 { background: #e5e7eb !important; }
      [data-theme="dark"] .ap .bg-black    { background: #111827 !important; }
      [data-theme="dark"] .ap .bg-amber-50 { background: #fffbeb !important; }
      [data-theme="dark"] .ap .bg-blue-50  { background: #eff6ff !important; }
      [data-theme="dark"] .ap .bg-green-50 { background: #f0fdf4 !important; }
      [data-theme="dark"] .ap .bg-purple-50{ background: #faf5ff !important; }

      [data-theme="dark"] .ap .text-gray-900 { color: #111827 !important; }
      [data-theme="dark"] .ap .text-gray-800 { color: #1f2937 !important; }
      [data-theme="dark"] .ap .text-gray-700 { color: #374151 !important; }
      [data-theme="dark"] .ap .text-gray-600 { color: #4b5563 !important; }
      [data-theme="dark"] .ap .text-gray-500 { color: #6b7280 !important; }
      [data-theme="dark"] .ap .text-gray-400 { color: #9ca3af !important; }
      [data-theme="dark"] .ap .text-gray-300 { color: #d1d5db !important; }
      [data-theme="dark"] .ap .text-black    { color: #111827 !important; }
      [data-theme="dark"] .ap .text-white    { color: #ffffff !important; }
      [data-theme="dark"] .ap .text-green-600{ color: #16a34a !important; }
      [data-theme="dark"] .ap .text-green-700{ color: #15803d !important; }
      [data-theme="dark"] .ap .text-amber-600{ color: #d97706 !important; }
      [data-theme="dark"] .ap .text-amber-700{ color: #b45309 !important; }
      [data-theme="dark"] .ap .text-red-500  { color: #ef4444 !important; }
      [data-theme="dark"] .ap .text-blue-600 { color: #2563eb !important; }
      [data-theme="dark"] .ap .text-blue-700 { color: #1d4ed8 !important; }
      [data-theme="dark"] .ap .text-purple-600{ color: #9333ea !important; }
      [data-theme="dark"] .ap .text-purple-700{ color: #7e22ce !important; }

      [data-theme="dark"] .ap .border-gray-200 { border-color: #e5e7eb !important; }
      [data-theme="dark"] .ap .border-gray-300 { border-color: #d1d5db !important; }
      [data-theme="dark"] .ap .border-black    { border-color: #111827 !important; }

      [data-theme="dark"] .ap input,
      [data-theme="dark"] .ap select,
      [data-theme="dark"] .ap textarea {
        background: #ffffff !important; color: #111827 !important; border-color: #d1d5db !important;
      }
      [data-theme="dark"] .ap .hover\:bg-black:hover  { background: #1f2937 !important; }
      [data-theme="dark"] .ap .hover\:bg-gray-50:hover { background: #f9fafb !important; }
      [data-theme="dark"] .ap .hover\:text-black:hover { color: #111827 !important; }
      [data-theme="dark"] .ap .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important; }

      @media print {
        @page { size: A4 portrait; margin: 15mm 12mm; }
        .ap-no-print { display: none !important; }
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; background: #fff !important; }
        .ap a { text-decoration: none !important; }
      }
    `}</style>
    <main className="max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/attestations" className="ap-no-print text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{event.title}</h1>
          <p className="text-sm text-gray-500">{DISC_LABEL[event.discipline] || event.discipline} · {event.event_date}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${si.color}`}>{si.label}</span>
        <button
          onClick={() => window.print()}
          className="ap-no-print text-xs px-3 py-1.5 border border-gray-300 rounded-xl text-gray-600 hover:border-gray-500 shrink-0"
        >
          🖨 Печать
        </button>
        <button
          onClick={() => setShowEditForm(v => !v)}
          className="ap-no-print text-xs px-3 py-1.5 border border-gray-300 rounded-xl text-gray-600 hover:border-gray-500 shrink-0"
        >
          ✏️ Изменить
        </button>
      </div>

      {/* Edit form */}
      {showEditForm && (
        <form onSubmit={saveEdit} className="ap-no-print bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">Редактирование мероприятия</h3>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Название</label>
            <input
              required
              value={editForm.title}
              onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Открытие заявок</label>
              <input type="date" value={editForm.applications_open_at}
                onChange={e => setEditForm(p => ({ ...p, applications_open_at: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Дата аттестации *</label>
              <input required type="date" value={editForm.event_date}
                onChange={e => setEditForm(p => ({ ...p, event_date: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>

          {editGroups.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Даты предаттестаций по группам</p>
              {editGroups.map((g, idx) => (
                <div key={g.label} className="bg-white rounded-xl p-3 space-y-2 border border-gray-200">
                  <p className="text-xs font-medium text-gray-800">{g.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Предатт. 1</label>
                      <input type="date" value={g.preatt1_date}
                        onChange={e => updateEditGroup(idx, 'preatt1_date', e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-xs" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Предатт. 2</label>
                      <input type="date" value={g.preatt2_date}
                        onChange={e => updateEditGroup(idx, 'preatt2_date', e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-xs" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Заметки</label>
            <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
              rows={2} className="w-full border rounded-xl px-3 py-2 text-sm resize-none" />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={editSaving}
              className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60">
              {editSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" onClick={() => setShowEditForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-xl text-sm">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Stats dashboard */}
      <div className="grid grid-cols-6 gap-1.5 mb-4">
        {DASH_STATS.map(s => {
          const active = dashFilter === s.key || (dashFilter === null && s.key === 'all')
          return (
            <button key={s.key}
              onClick={() => setDashFilter(dashFilter === s.key || (s.key === 'all' && dashFilter === null) ? null : s.key === 'all' ? null : s.key)}
              className={`rounded-xl p-2 text-center transition-all border ${active ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}>
              <div className="text-base leading-none">{s.icon}</div>
              <div className={`text-lg font-bold leading-tight mt-0.5 ${active ? 'text-white' : 'text-gray-900'}`}>{s.val}</div>
              <div className={`text-[10px] leading-tight mt-0.5 ${active ? 'text-gray-300' : 'text-gray-400'}`}>{s.label}</div>
            </button>
          )
        })}
      </div>

      {/* Group schedule */}
      {event.preatt_groups && event.preatt_groups.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowGroupSchedule(v => !v)}
            className="text-xs text-blue-600 hover:underline mb-2 flex items-center gap-1"
          >
            {showGroupSchedule ? '▾' : '▸'} Расписание предаттестаций
          </button>
          {showGroupSchedule && (
            <div className="space-y-2">
              {event.preatt_groups.map((g, idx) => (
                <div key={g.label} className={`border rounded-xl px-3 py-2 text-xs ${GROUP_COLORS[idx % GROUP_COLORS.length]}`}>
                  <p className="font-semibold">{g.label}</p>
                  <div className="flex gap-4 mt-0.5 text-xs opacity-80">
                    {g.preatt1_date && <span>Предатт. 1: {g.preatt1_date}</span>}
                    {g.preatt2_date && <span>Предатт. 2: {g.preatt2_date}</span>}
                    {!g.preatt1_date && !g.preatt2_date && <span className="opacity-50">Даты не заданы</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="ap-no-print flex gap-2 mb-4">
        {EVENT_STATUS_NEXT[event.status] && (
          <button onClick={advanceStatus} disabled={changingStatus} className="bg-black text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-60">
            {changingStatus ? '...' : EVENT_STATUS_NEXT_LABEL[event.status]}
          </button>
        )}
        <button onClick={() => setShowAddForm(v => !v)} className="border border-gray-300 px-4 py-2 rounded-xl text-sm">
          + Добавить заявку
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={addApplication} className="ap-no-print bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">Новая заявка</h3>

          <div className="relative">
            <input
              value={studentSearch}
              onChange={e => { setStudentSearch(e.target.value); setAddForm(p => ({ ...p, student_id: '' })) }}
              placeholder="Имя ученика"
              className="w-full border rounded-xl px-3 py-2 text-sm"
            />
            {filteredStudents.length > 0 && !addForm.student_id && (
              <div className="absolute z-10 bg-white border border-gray-200 rounded-xl shadow mt-1 w-full max-h-40 overflow-auto">
                {filteredStudents.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => { setAddForm(p => ({ ...p, student_id: s.id })); setStudentSearch(s.name) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >{s.name}</button>
                ))}
              </div>
            )}
          </div>

          {event.discipline === 'both' && (
            <select value={addForm.discipline} onChange={e => setAddForm(p => ({ ...p, discipline: e.target.value, current_grade: '', target_grade: '' }))} className="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="aikido">Айкидо</option>
              <option value="wushu">Ушу</option>
            </select>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Текущий кю/степень</label>
              <select value={addForm.current_grade} onChange={e => setAddForm(p => ({ ...p, current_grade: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm">
                <option value="">—</option>
                {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Сдаёт на</label>
              <select required value={addForm.target_grade} onChange={e => setAddForm(p => ({ ...p, target_grade: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm">
                <option value="">—</option>
                {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {/* Show which group this will be in */}
          {addForm.target_grade && event.preatt_groups && (() => {
            const g = getGroup(event.preatt_groups, addForm.target_grade)
            const idx = event.preatt_groups.indexOf(g!)
            if (!g) return null
            return (
              <div className={`border rounded-xl px-3 py-2 text-xs ${GROUP_COLORS[idx % GROUP_COLORS.length]}`}>
                Группа: <strong>{g.label}</strong>
                {g.preatt1_date && <span className="ml-2">· Предатт. 1: {g.preatt1_date}</span>}
                {g.preatt2_date && <span className="ml-2">· Предатт. 2: {g.preatt2_date}</span>}
              </div>
            )
          })()}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Дата прошлой аттестации (если есть)</label>
            <input type="date" value={addForm.last_attestation_date} onChange={e => setAddForm(p => ({ ...p, last_attestation_date: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm" />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving || !addForm.student_id} className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60">
              {saving ? 'Сохранение...' : 'Добавить'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-gray-300 rounded-xl text-sm">Отмена</button>
          </div>
        </form>
      )}

      {/* Discipline filter */}
      {event.discipline === 'both' && (
        <div className="ap-no-print flex gap-2 mb-3">
          {(['all', 'aikido', 'wushu'] as const).map(d => (
            <button key={d} onClick={() => setDiscFilter(d)} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${discFilter === d ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
              {d === 'all' ? 'Все' : d === 'aikido' ? 'Айкидо' : 'Ушу'}
            </button>
          ))}
        </div>
      )}

      {/* Applications list */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-8">Заявок нет</p>
      ) : (
        <div className="space-y-1.5">
          {/* Header */}
          <div className="grid grid-cols-[1fr_44px_36px_36px_28px_52px] gap-2 px-3 pb-1 text-xs text-gray-400 font-medium">
            <span>Ученик</span>
            <span className="text-center">Норм.</span>
            <span className="text-center">П1</span>
            <span className="text-center">П2</span>
            <span className="text-center">₽</span>
            <span className="text-center">Итог</span>
          </div>

          {filtered.map(app => {
            const groupIdx = groupIndexMap.get(app.target_grade)
            const groupInfo = event.preatt_groups && groupIdx !== undefined ? event.preatt_groups[groupIdx] : null
            const colorClass = groupIdx !== undefined ? GROUP_COLORS[groupIdx % GROUP_COLORS.length] : ''

            // Single req indicator
            const hasOverride = !!app.req_override_by
            const anyFail = app.req_tenure_ok === false || app.req_visits_ok === false || app.req_age_ok === false
            const allChecked = app.req_tenure_ok !== null || app.req_visits_ok !== null || app.req_age_ok !== null
            const allOk = app.req_tenure_ok !== false && app.req_visits_ok !== false && app.req_age_ok !== false && allChecked

            let reqEl: React.ReactNode
            if (hasOverride) {
              reqEl = <span className="inline-block text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 leading-4">доп</span>
            } else if (!allChecked) {
              reqEl = <span className="text-gray-300 text-sm">—</span>
            } else if (allOk) {
              reqEl = <span className="text-green-600 text-sm font-bold">✓</span>
            } else {
              reqEl = <span className="text-red-500 text-sm font-bold">✗</span>
            }

            const preattCell = (status: string | null) => {
              if (!status) return <span className="text-gray-300">—</span>
              const info = PREATT_INFO[status]
              return <span className={`font-bold ${info?.color}`}>{info?.symbol}</span>
            }

            return (
              <Link key={app.id} href={`/attestations/${id}/${app.id}`}
                className="grid grid-cols-[1fr_44px_36px_36px_28px_52px] gap-2 items-center bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:border-gray-400 transition-colors"
              >
                {/* Name + grade */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{studentName(app)}</p>
                    {groupInfo && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium shrink-0 leading-4 ${colorClass}`}>
                        {groupInfo.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{app.current_grade} → {app.target_grade}</p>
                </div>

                <div className="flex justify-center">{reqEl}</div>
                <div className="text-center text-sm">{preattCell(app.preatt1_status)}</div>
                <div className="text-center text-sm">{preattCell(app.preatt2_status)}</div>
                <div className="text-center text-sm">
                  {app.paid ? <span className="text-green-600 font-bold">✓</span> : <span className="text-gray-300">—</span>}
                </div>
                <div className="text-center text-xs font-medium">
                  {app.result
                    ? <span className={RESULT_INFO[app.result]?.color}>{RESULT_INFO[app.result]?.label}</span>
                    : <span className="text-gray-300">—</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {event.notes && <p className="mt-4 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">{event.notes}</p>}
    </main>
    </div>
  )
}
