'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { FujiScene } from '@/components/FujiScene'
import { localDateStr } from '@/lib/dates'
import { CabinetTour } from '@/components/CabinetTour'
import { CABINET_TOUR_SLIDES } from '@/lib/onboarding'
import { SubscriptionQuiz } from '@/components/SubscriptionQuiz'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 16 качеств
const QUALITIES = ['strength','speed','endurance','agility','coordination','posture','flexibility','discipline','sociability','confidence','learnability','attentiveness','emotional_balance','goal_orientation','activity','self_defense']
const QUALITY_LABELS: Record<string,string> = {
  strength:'Сила', speed:'Быстрота', endurance:'Выносливость', agility:'Ловкость',
  coordination:'Координация', posture:'Осанка', flexibility:'Гибкость', discipline:'Дисциплина',
  sociability:'Общительность', confidence:'Уверенность', learnability:'Обучаемость',
  attentiveness:'Внимательность', emotional_balance:'Уравновешенность',
  goal_orientation:'Целеустремлённость', activity:'Активность', self_defense:'Самозащита',
}

type Student = { id: string; name: string; group_name: string | null; birth_date: string | null; photo_url: string | null; created_at: string }
type TrainerInfo = { name: string; phone: string | null; telegram_username: string | null; vk_url: string | null; days: string[] }
type Subscription = { id: string; sessions_left: number | null; sessions_total: number | null; start_date: string | null; end_date: string | null; type: string; amount: number | null; bonuses: Record<string, number> | null; bonuses_used: Record<string, number | string[]> | null }
type InstallmentPlan = { id: string; total_amount: number; deposit_amount: number; deposit_paid_at: string | null; installment_payments: { id: string; amount: number; due_date: string; status: string; paid_at: string | null; actual_amount: number | null }[] }
type Survey = { id: string; filled_at: string | null; created_at: string } & Record<string, number | null | string>
type Task = { id: string; title: string; description: string | null; due_date: string | null; completed: boolean }
type Cert = { id: string; type: string; title: string; date: string | null; notes: string | null }
type Ticket = { id: string; type: string; description: string | null; status: string; resolution_note: string | null; created_at: string }
type ScheduleSlot = { id: string; day_of_week: number; time_start: string | null; trainer_name: string | null }
type ScheduleOverride = { date: string; group_name: string; trainer_name: string | null; cancelled: boolean; note: string | null }

const WEEK_DAYS_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function getThisWeekDates(): Record<number, string> {
  const now = new Date()
  const jsDay = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (jsDay === 0 ? 6 : jsDay - 1))
  const dates: Record<number, string> = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates[i + 1] = localDateStr(d)
  }
  return dates
}

const CERT_ICONS: Record<string,string> = {
  belt: '🥋', seminar: '📚', masterclass: '🎯', competition: '🏆', other: '⭐'
}
const CERT_LABELS: Record<string,string> = {
  belt: 'Пояс', seminar: 'Семинар', masterclass: 'Мастер-класс', competition: 'Соревнование', other: 'Другое'
}

// Календарь посещений по месяцам
function AttendanceCalendar({ attendance }: { attendance: { date: string; present: boolean }[] }) {
  const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  if (attendance.length === 0) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h2 className="font-semibold text-gray-800 mb-2">📅 Посещения</h2>
      <div className="text-sm text-gray-400 text-center py-4">Нет данных о посещениях</div>
    </div>
  )

  // Группируем по месяцам
  const byMonth: Record<string, Record<string, boolean>> = {}
  attendance.forEach(a => {
    const d = new Date(a.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!byMonth[key]) byMonth[key] = {}
    byMonth[key][a.date] = a.present
  })

  const months = Object.keys(byMonth).sort().reverse().slice(0, 3)
  const presentTotal = attendance.filter(a => a.present).length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">📅 Посещения</h2>
        <span className="text-sm font-medium text-green-600">{presentTotal} занятий</span>
      </div>

      <div className="space-y-5">
        {months.map(monthKey => {
          const [year, month] = monthKey.split('-').map(Number)
          const daysInMonth = new Date(year, month, 0).getDate()
          const firstDayOfMonth = new Date(year, month - 1, 1).getDay()
          // JS: 0=вс, преобразуем в пн=0
          const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
          const monthData = byMonth[monthKey]
          const monthPresent = Object.values(monthData).filter(Boolean).length

          const monthName = new Date(year, month - 1, 1)
            .toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

          return (
            <div key={monthKey}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 capitalize">{monthName}</span>
                <span className="text-xs text-gray-400">{monthPresent} из {Object.keys(monthData).length}</span>
              </div>

              {/* Дни недели */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="text-center text-xs text-gray-300 font-medium">{d}</div>
                ))}
              </div>

              {/* Дни месяца */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const hasRecord = dateStr in monthData
                  const present = monthData[dateStr]

                  return (
                    <div key={day}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors
                        ${!hasRecord ? 'text-gray-300' :
                          present ? 'bg-green-500 text-white' : 'bg-red-100 text-red-400'
                        }`}>
                      {day}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Легенда */}
      <div className="flex gap-4 mt-4 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-xs text-gray-500">Был на занятии</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-100" />
          <span className="text-xs text-gray-500">Пропустил</span>
        </div>
      </div>
    </div>
  )
}

// SVG радарная диаграмма
const SURVEY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

function ProgressLineChart({ surveys }: { surveys: Survey[] }) {
  const filled = surveys.filter(s => s.trainer_filled_at)
  if (filled.length < 2) return (
    <div className="text-sm text-gray-400 text-center py-4">Нужно минимум 2 среза для отображения динамики</div>
  )
  const W = 90, H = 28, PAD = 4
  return (
    <div className="space-y-2.5">
      {QUALITIES.map(k => {
        const values = filled.map(s => (s[`trainer_${k}`] as number) || 0)
        const xStep = (W - PAD * 2) / (values.length - 1)
        const pts = values.map((v, i) => ({ x: PAD + i * xStep, y: H - PAD - (v / 10) * (H - PAD * 2) }))
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
        const diff = values[values.length - 1] - values[0]
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-28 shrink-0">{QUALITY_LABELS[k]}</span>
            <svg width={W} height={H} className="shrink-0 overflow-visible">
              <path d={pathD} fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={SURVEY_COLORS[i % SURVEY_COLORS.length]} />)}
            </svg>
            <span className="text-xs text-gray-400 shrink-0">{values.join(' → ')}</span>
            {diff !== 0 && (
              <span className={`text-xs font-bold shrink-0 ${diff > 0 ? 'text-green-500' : 'text-red-400'}`}>
                {diff > 0 ? `+${diff}` : diff}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RadarChart({ surveys }: { surveys: Survey[] }) {
  if (surveys.length === 0) return (
    <div className="text-center text-gray-400 text-sm py-8">Данных пока нет — заполните анкету прогресса</div>
  )

  const size = 280
  const cx = size / 2
  const cy = size / 2
  const r = 100
  const n = QUALITIES.length
  const colors = SURVEY_COLORS

  function getPoint(i: number, val: number) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const rv = (val / 10) * r
    return { x: cx + rv * Math.cos(angle), y: cy + rv * Math.sin(angle) }
  }

  function getLabelPoint(i: number) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const rv = r + 22
    return { x: cx + rv * Math.cos(angle), y: cy + rv * Math.sin(angle) }
  }

  // Сетка
  const gridLevels = [2, 4, 6, 8, 10]

  return (
    <div className="flex flex-col items-center">
      <svg width={size + 80} height={size + 60} viewBox={`-40 -30 ${size + 80} ${size + 60}`}>
        {/* Сетка */}
        {gridLevels.map(level => {
          const pts = QUALITIES.map((_, i) => getPoint(i, level))
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'
          return <path key={level} d={d} fill="none" stroke="#E5E7EB" strokeWidth="1" />
        })}
        {/* Оси */}
        {QUALITIES.map((_, i) => {
          const p = getPoint(i, 10)
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="1" />
        })}
        {/* Данные по каждому срезу (последние 4) */}
        {surveys.slice(-4).map((survey, si) => {
          const pts = QUALITIES.map((k, i) => getPoint(i, (survey[`trainer_${k}`] as number) || 0))
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'
          return (
            <path key={si} d={d}
              fill={colors[si % colors.length]} fillOpacity="0.15"
              stroke={colors[si % colors.length]} strokeWidth="2" />
          )
        })}
        {/* Подписи */}
        {QUALITIES.map((k, i) => {
          const lp = getLabelPoint(i)
          const short = QUALITY_LABELS[k].split('').slice(0, 6).join('') + (QUALITY_LABELS[k].length > 6 ? '.' : '')
          return (
            <text key={k} x={lp.x} y={lp.y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fill="#6B7280">
              {QUALITY_LABELS[k].length <= 7 ? QUALITY_LABELS[k] : short}
            </text>
          )
        })}
      </svg>
      {/* Легенда */}
      {surveys.length > 0 && (
        <div className="flex gap-3 flex-wrap justify-center mt-1">
          {surveys.slice(-4).map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: colors[i % colors.length] }} />
              <span className="text-xs text-gray-500">
                {s.title || (i === 0 ? 'Старт' : `Срез ${i + 1}`)}
                {s.filled_at ? ` (${new Date(s.filled_at).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })})` : ''}
              </span>
            </div>
          ))}
          {surveys.length > 4 && <span className="text-xs text-gray-400">+{surveys.length - 4} ранее</span>}
        </div>
      )}
    </div>
  )
}

// Прогресс-бар качества
function QualityBar({ label, values, colors }: { label: string; values: number[]; colors: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
      <div className="flex-1 flex gap-1">
        {values.map((v, i) => (
          <div key={i} className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${v * 10}%`, background: colors[i] }} />
          </div>
        ))}
      </div>
      <span className="text-xs font-medium text-gray-700 w-5 text-right">
        {values[values.length - 1]}
      </span>
    </div>
  )
}

export default function CabinetPage() {
  const { token } = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const isAdminView = searchParams.get('back') === '1'
  const [student, setStudent] = useState<Student | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [installmentPlan, setInstallmentPlan] = useState<InstallmentPlan | null>(null)
  const [firstSubDate, setFirstSubDate] = useState<string | null>(null)
  const [trainingStartDate, setTrainingStartDate] = useState<string | null>(null)
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [certs, setCerts] = useState<Cert[]>([])
  const [attendance, setAttendance] = useState<{ date: string; present: boolean }[]>([])
  const [eventVisits, setEventVisits] = useState<{ date: string; title: string }[]>([])
  const [aiProgram, setAiProgram] = useState<string | null>(null)
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([])
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>([])
  const [trainersInfo, setTrainersInfo] = useState<TrainerInfo[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketForm, setTicketForm] = useState({ type: '', description: '' })
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketSending, setTicketSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bonusTotalValue, setBonusTotalValue] = useState<number | null>(null)
  const [subTypes, setSubTypes] = useState<any[]>([])
  const [tab, setTab] = useState<'home' | 'progress' | 'tasks' | 'achievements' | 'tickets'>('home')
  const [togglingTask, setTogglingTask] = useState<string | null>(null)

  useEffect(() => {
    if (token) loadAll()
  }, [token])

  async function loadAll() {
    // Найти ученика по токену
    const { data: studentData } = await supabase
      .from('students')
      .select('id, name, group_name, birth_date, photo_url, created_at')
      .eq('cabinet_token', token)
      .single()

    if (!studentData) { setLoading(false); return }
    setStudent(studentData)

    const sid = studentData.id

    const weekDates = getThisWeekDates()
    const monday = weekDates[1]
    const sunday = weekDates[7]

    const [subRes, surveysRes, tasksRes, certsRes, attRes, evParticipantsRes, tkRes, diagRes, schedRes, ovRes, firstSubRes, profileRes] = await Promise.all([
      supabase.from('subscriptions').select('id, sessions_left, sessions_total, start_date, end_date, type, amount, bonuses, bonuses_used')
        .eq('student_id', sid).eq('is_pending', false).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('progress_surveys').select('*').eq('student_id', sid).order('created_at'),
      supabase.from('trainer_tasks').select('id, title, description, due_date, completed')
        .eq('student_id', sid).order('created_at', { ascending: false }),
      supabase.from('certifications').select('id, type, title, date, notes')
        .eq('student_id', sid).order('date', { ascending: false }),
      supabase.from('attendance').select('date, present').eq('student_id', sid)
        .order('date', { ascending: false }).limit(180),
      supabase.from('event_participants').select('events(date, title)').eq('student_id', sid),
      supabase.from('tickets').select('id, type, description, status, resolution_note, created_at')
        .eq('student_id', sid).neq('type', 'crm_задача').order('created_at', { ascending: false }),
      supabase.from('diagnostic_surveys').select('ai_program').eq('student_id', sid)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      studentData.group_name
        ? supabase.from('schedule').select('id, day_of_week, time_start, trainer_name')
            .eq('group_name', studentData.group_name).order('day_of_week').order('time_start')
        : Promise.resolve({ data: [] }),
      studentData.group_name
        ? supabase.from('schedule_overrides').select('date, group_name, trainer_name, cancelled, note')
            .eq('group_name', studentData.group_name)
            .gte('date', monday).lte('date', sunday)
        : Promise.resolve({ data: [] }),
      supabase.from('subscriptions').select('start_date').eq('student_id', sid)
        .order('start_date', { ascending: true }).limit(1).maybeSingle(),
      supabase.from('student_profiles').select('training_start_date').eq('student_id', sid).maybeSingle(),
    ])

    setSubscription(subRes.data)

    // Загрузить план рассрочки если есть подписка
    if (subRes.data?.id) {
      const { data: iplan } = await supabase
        .from('installment_plans')
        .select('id, total_amount, deposit_amount, deposit_paid_at, installment_payments(id, amount, due_date, status, paid_at, actual_amount)')
        .eq('subscription_id', subRes.data.id)
        .eq('status', 'active')
        .maybeSingle()
      setInstallmentPlan(iplan as InstallmentPlan | null)
    }

    // Загрузить тарифы группы для квиза
    const groupType = studentData.group_name?.includes('4-9') || studentData.group_name?.includes('Дети') ? 'Старт' : 'Комбат'
    const { data: stTypes } = await supabase
      .from('subscription_types')
      .select('id, name, group_type, sessions_count, price, price_per_session, duration_months, bonuses, bonus_total_value, is_for_newcomers')
      .eq('group_type', groupType)
      .eq('is_hidden', false)
      .order('sessions_count')
    setSubTypes(stTypes || [])

    if (subRes.data?.type) {
      // Сначала ищем по точному имени (новые абонементы)
      let { data: stData } = await supabase
        .from('subscription_types').select('bonus_total_value')
        .eq('name', subRes.data.type).maybeSingle()
      // Если не нашли — старое название вида "Старт16", ищем по кол-ву занятий
      if (!stData) {
        const sessCount = subRes.data.sessions_total
        const grp = subRes.data.type?.startsWith('Комбат') ? 'Комбат' : 'Старт'
        if (sessCount) {
          const { data: stData2 } = await supabase
            .from('subscription_types').select('bonus_total_value')
            .eq('sessions_count', sessCount).eq('group_type', grp).eq('is_for_newcomers', false).maybeSingle()
          stData = stData2
        }
      }
      setBonusTotalValue(stData?.bonus_total_value ?? null)
    }
    setFirstSubDate((firstSubRes as any).data?.start_date || null)
    setTrainingStartDate((profileRes as any).data?.training_start_date || null)
    setSurveys(surveysRes.data || [])
    setTasks(tasksRes.data || [])
    setCerts(certsRes.data || [])
    setAttendance(attRes.data || [])
    const evVisits = ((evParticipantsRes.data || []) as any[])
      .map(ep => ep.events)
      .filter(ev => ev?.date && ev?.title)
      .map(ev => ({ date: ev.date as string, title: ev.title as string }))
    setEventVisits(evVisits)
    setTickets(tkRes.data || [])
    setAiProgram(diagRes.data?.ai_program || null)
    const slots = (schedRes.data as ScheduleSlot[]) || []
    setScheduleSlots(slots)
    setScheduleOverrides((ovRes.data as ScheduleOverride[]) || [])

    // Загрузить все контакты тренеров группы
    const trainerDaysMap = new Map<string, string[]>()
    for (const slot of slots) {
      if (!slot.trainer_name) continue
      const dayLabel = WEEK_DAYS_SHORT[slot.day_of_week] ?? ''
      const existing = trainerDaysMap.get(slot.trainer_name) ?? []
      if (!existing.includes(dayLabel)) existing.push(dayLabel)
      trainerDaysMap.set(slot.trainer_name, existing)
    }
    const uniqueTrainerNames = Array.from(trainerDaysMap.keys())
    if (uniqueTrainerNames.length > 0) {
      const { data: trRows } = await supabase
        .from('trainers').select('name, phone, telegram_username, vk_url')
        .in('name', uniqueTrainerNames)
      if (trRows) {
        setTrainersInfo(trRows.map(tr => ({
          ...tr,
          days: trainerDaysMap.get(tr.name) ?? [],
        })))
      }
    }

    setLoading(false)
  }

  async function sendTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!student || !ticketForm.type) return
    setTicketSending(true)
    const { data } = await supabase.from('tickets').insert({
      student_id: student.id,
      type: ticketForm.type,
      description: ticketForm.description || null,
      status: 'pending',
    }).select('id, type, description, status, resolution_note, created_at').single()
    if (data) setTickets(prev => [data as Ticket, ...prev])
    setTicketForm({ type: '', description: '' })
    setShowTicketForm(false)
    setTicketSending(false)
  }

  async function toggleTask(taskId: string, current: boolean) {
    setTogglingTask(taskId)
    await supabase.from('trainer_tasks').update({
      completed: !current,
      completed_at: !current ? new Date().toISOString() : null,
    }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !current } : t))
    setTogglingTask(null)
  }

  // Streak — дней подряд с посещением
  function calcStreak() {
    const presentDates = attendance.filter(a => a.present).map(a => a.date).sort().reverse()
    if (presentDates.length === 0) return 0
    let streak = 0
    let prev: Date | null = null
    for (const d of presentDates) {
      const curr = new Date(d)
      if (!prev) { streak = 1; prev = curr; continue }
      const diff = (prev.getTime() - curr.getTime()) / 86400000
      if (diff <= 7) { streak++; prev = curr } else break
    }
    return streak
  }

  // Общий балл прогресса (последний срез)
  function calcScore(survey: Survey) {
    const vals = QUALITIES.map(k => (survey[`trainer_${k}`] as number) || 0)
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400">Загрузка...</div>
    </div>
  )

  if (!student) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <div className="text-4xl mb-3">🥋</div>
        <div className="text-gray-600 font-medium">Кабинет не найден</div>
        <div className="text-gray-400 text-sm mt-1">Ссылка недействительна</div>
      </div>
    </div>
  )

  const streak = calcStreak()
  const latestScore = surveys.length > 0 ? calcScore(surveys[surveys.length - 1]) : null
  const firstScore = surveys.length > 1 ? calcScore(surveys[0]) : null
  const scoreDiff = latestScore !== null && firstScore !== null ? latestScore - firstScore : null
  const daysLeft = subscription?.end_date
    ? Math.max(0, Math.ceil((new Date(subscription.end_date).getTime() - Date.now()) / 86400000))
    : null
  const totalAttendance = attendance.filter(a => a.present).length
  const pendingTasks = tasks.filter(t => !t.completed).length

  const colors = ['#3B82F6', '#10B981', '#F59E0B']

  // Сегодняшняя тренировка
  const todayIso = localDateStr()
  const todayNum = new Date().getDay() === 0 ? 7 : new Date().getDay()
  const todaySlot = scheduleSlots.find(s => s.day_of_week === todayNum)
  const todayOverride = scheduleOverrides.find(o => o.date === todayIso)
  const todayCancelled = todaySlot && todayOverride?.cancelled
  const todayTrainer = todayOverride?.trainer_name ?? todaySlot?.trainer_name ?? null
  const hasTodayTraining = !!todaySlot && !todayCancelled

  // Милстоуны
  const milestones = [
    { count: 1,   icon: '🌱', label: 'Первая тренировка' },
    { count: 5,   icon: '⭐', label: '5 тренировок' },
    { count: 10,  icon: '🔥', label: '10 тренировок' },
    { count: 25,  icon: '💪', label: '25 тренировок' },
    { count: 50,  icon: '🥋', label: '50 тренировок' },
    { count: 100, icon: '🏆', label: '100 тренировок' },
  ].map(m => ({ ...m, achieved: totalAttendance >= m.count }))

  return (
    <div className="min-h-screen bg-gray-50">
      <CabinetTour
        storageKey="samurai_cabinet_tour_done"
        slides={CABINET_TOUR_SLIDES}
        personName={student.name.split(' ')[0]}
      />
      {/* Кнопка возврата для администратора */}
      {isAdminView && (
        <div className="fixed top-3 right-3 z-50">
          <button onClick={() => window.close()}
            className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-full shadow-lg">
            ✕ Закрыть
          </button>
        </div>
      )}
      {/* Шапка */}
      <div className="relative overflow-hidden">
        <FujiScene dark={true} bgColor="#111827" />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-5 z-10">
          <div className="max-w-lg mx-auto">
            <div className="flex items-end gap-3 mb-3">
              {student.photo_url ? (
                <img src={student.photo_url} alt={student.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 shadow-lg shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-2xl font-bold text-white shrink-0">
                  {student.name[0]}
                </div>
              )}
              <div>
                <div className="text-xs text-white/50 mb-0.5">Личный кабинет</div>
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">{student.name}</h1>
                {student.group_name && (
                  <div className="text-sm text-white/60 mt-0.5">{student.group_name}</div>
                )}
              </div>
            </div>
            {/* Быстрые показатели */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-3 text-center">
                <div className="text-xl font-bold text-white">{totalAttendance}</div>
                <div className="text-xs text-white/50 mt-0.5">тренировок</div>
              </div>
              <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-3 text-center">
                <div className="text-xl font-bold text-white">{streak}</div>
                <div className="text-xs text-white/50 mt-0.5">серия 🔥</div>
              </div>
              <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-3 text-center">
                <div className="text-xl font-bold text-white">{latestScore ?? '—'}</div>
                <div className="text-xs text-white/50 mt-0.5">балл {scoreDiff !== null && scoreDiff > 0 ? `↑${scoreDiff}` : ''}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Навигация */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex">
          {([
            { key: 'home',         label: 'Главная',    icon: '🏠',  badge: null },
            { key: 'progress',     label: 'Прогресс',   icon: '📊',  badge: null },
            { key: 'tasks',        label: 'Задания',     icon: '📋',  badge: null },
            { key: 'achievements', label: 'Достижения',  icon: '🏆',  badge: null },
            { key: 'tickets',      label: 'Связь',       icon: '💬',  badge: tickets.filter(t => t.status === 'pending').length || null },
          ] as { key: typeof tab; label: string; icon: string; badge: number | null }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-xs font-medium transition-colors border-b-2 relative ${
                tab === t.key
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400'
              }`}>
              <div className="relative inline-block">
                {t.icon}
                {t.badge && tab !== t.key && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                    {t.badge}
                  </span>
                )}
              </div>
              <div>{t.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">

        {/* ── ГЛАВНАЯ ── */}
        {tab === 'home' && (
          <>
            {/* Сегодняшняя тренировка */}
            {todaySlot && (
              <div className={`rounded-2xl p-4 border ${todayCancelled ? 'bg-red-50 border-red-200' : 'bg-black border-black text-white'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-xs font-medium mb-1 ${todayCancelled ? 'text-red-400' : 'text-white/60'}`}>
                      {todayCancelled ? '❌ Сегодня' : '⚡ Сегодня тренировка'}
                    </div>
                    {todayCancelled ? (
                      <div className="font-semibold text-red-700">Тренировка отменена</div>
                    ) : (
                      <div className="font-bold text-xl">{todaySlot.time_start?.slice(0,5)}</div>
                    )}
                    {!todayCancelled && todayTrainer && (
                      <div className="text-sm text-white/70 mt-0.5">
                        {todayOverride?.trainer_name ? '🔄 ' : ''}{todayTrainer}
                      </div>
                    )}
                  </div>
                  {!todayCancelled && (
                    <div className="text-4xl opacity-20">🥋</div>
                  )}
                </div>
              </div>
            )}

            {/* Абонемент */}
            {(() => {
              const today = localDateStr()
              const isExpiredByDate = subscription?.end_date ? subscription.end_date < today : false
              const isExpiredBySessions = subscription !== null && subscription.sessions_left !== null && subscription.sessions_left <= 0
              const isExpired = isExpiredByDate || isExpiredBySessions
              const bonusEntries = subscription?.bonuses ? Object.entries(subscription.bonuses) : []
              return (
                <div className={`bg-white rounded-2xl border shadow-sm p-4 ${isExpired ? 'border-red-200' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-gray-800">🎫 Абонемент</h2>
                    {subscription && (
                      <span className="text-xs text-gray-400">{subscription.type}</span>
                    )}
                  </div>
                  {isExpired && (
                    <div className="bg-red-500 text-white text-sm font-medium text-center py-2 rounded-xl mb-3">
                      ❌ Абонемент окончен — необходимо продление
                    </div>
                  )}
                  {subscription ? (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${
                            isExpiredBySessions ? 'text-red-500' :
                            (subscription.sessions_left ?? 0) <= 2 ? 'text-red-500' :
                            (subscription.sessions_left ?? 0) <= 5 ? 'text-yellow-500' : 'text-green-600'
                          }`}>
                            {subscription.sessions_left ?? 0}
                          </div>
                          <div className="text-xs text-gray-400">осталось занятий</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${daysLeft !== null && daysLeft <= 7 ? 'text-red-500' : 'text-gray-800'}`}>
                            {daysLeft ?? '—'}
                          </div>
                          <div className="text-xs text-gray-400">дней до конца</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-gray-800">{subscription.sessions_total ?? '—'}</div>
                          <div className="text-xs text-gray-400">всего в абоне</div>
                        </div>
                      </div>
                      {subscription.sessions_total && subscription.sessions_left !== null && (
                        <div className="bg-gray-100 rounded-full h-2 overflow-hidden mb-3">
                          <div className="h-full bg-black rounded-full transition-all"
                            style={{ width: `${Math.round((subscription.sessions_left / subscription.sessions_total) * 100)}%` }} />
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-gray-400 mb-2">
                        {subscription.start_date && (
                          <span>с {new Date(subscription.start_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
                        )}
                        {subscription.end_date && (
                          <span className={isExpiredByDate ? 'text-red-500 font-medium' : ''}>
                            до {new Date(subscription.end_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                          </span>
                        )}
                      </div>
                      {subscription.amount && (
                        <div className="text-xs text-gray-400 mb-2">💳 Стоимость: <span className="text-gray-600 font-medium">{subscription.amount.toLocaleString('ru-RU')} ₽</span></div>
                      )}
                      {bonusEntries.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-gray-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium text-gray-500">🎁 Бонусы абонемента</div>
                            {bonusTotalValue ? (
                              <div className="text-xs font-semibold text-green-600">на {bonusTotalValue.toLocaleString('ru-RU')} ₽</div>
                            ) : null}
                          </div>
                          {bonusEntries.map(([key, total]) => {
                            const val = subscription.bonuses_used?.[key]
                            const usedDates: string[] = Array.isArray(val) ? val : Array.from({ length: (val as number) || 0 }, () => '')
                            const used = usedDates.length
                            const left = total - used
                            return (
                              <div key={key} className={`px-3 py-2 rounded-xl ${left > 0 ? 'bg-purple-50' : 'bg-gray-50'}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs font-medium ${left > 0 ? 'text-purple-700' : 'text-gray-400'}`}>{key}</span>
                                  <span className={`text-xs ${left > 0 ? 'text-purple-500' : 'text-gray-400'}`}>
                                    {left > 0 ? `осталось ${left} из ${total}` : '✓ использован'}
                                  </span>
                                </div>
                                <div className="flex gap-1 mb-1">
                                  {Array.from({ length: total }).map((_, i) => (
                                    <div key={i} className={`w-4 h-4 rounded-full ${i < used ? 'bg-gray-300' : 'bg-purple-400'}`} />
                                  ))}
                                </div>
                                {usedDates.filter(d => d).map((d, i) => (
                                  <div key={i} className="text-xs text-gray-400">✓ {d}</div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {!isExpired && (subscription.sessions_left ?? 0) <= 2 && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                          ⚠️ Заканчиваются занятия — пора продлить абонемент
                          {trainersInfo[0]?.phone && (
                            <a href={`tel:${trainersInfo[0].phone}`}
                              className="block mt-2 text-center bg-red-600 text-white rounded-lg py-1.5 font-medium text-sm">
                              📞 Позвонить тренеру
                            </a>
                          )}
                          {trainersInfo[0]?.telegram_username && (
                            <a href={`https://t.me/${trainersInfo[0].telegram_username}`} target="_blank"
                              className="block mt-1.5 text-center bg-white border border-red-200 text-red-600 rounded-lg py-1.5 font-medium text-sm">
                              ✈️ Написать в Telegram
                            </a>
                          )}
                          {trainersInfo[0]?.vk_url && (
                            <a href={trainersInfo[0].vk_url} target="_blank"
                              className="block mt-1.5 text-center bg-white border border-red-200 text-red-600 rounded-lg py-1.5 font-medium text-sm">
                              ВК Написать ВКонтакте
                            </a>
                          )}
                        </div>
                      )}
                      {isExpired && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                          Для продления абонемента свяжитесь с тренером:
                          {trainersInfo[0]?.phone && (
                            <a href={`tel:${trainersInfo[0].phone}`}
                              className="block mt-2 text-center bg-red-600 text-white rounded-lg py-1.5 font-medium text-sm">
                              📞 Позвонить тренеру
                            </a>
                          )}
                          {trainersInfo[0]?.telegram_username && (
                            <a href={`https://t.me/${trainersInfo[0].telegram_username}`} target="_blank"
                              className="block mt-1.5 text-center bg-white border border-red-200 text-red-600 rounded-lg py-1.5 font-medium text-sm">
                              ✈️ Написать в Telegram
                            </a>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-gray-400 text-center py-4">Абонемент не найден</div>
                  )}
                </div>
              )
            })()}

            {/* Квиз подбора абонемента */}
            {subTypes.length > 0 && <SubscriptionQuiz types={subTypes} />}

            {/* Рассрочка */}
            {installmentPlan && (() => {
              const today = localDateStr()
              const payments = [...installmentPlan.installment_payments].sort((a, b) => a.due_date.localeCompare(b.due_date))
              const paidAmount = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.actual_amount ?? p.amount), 0) + installmentPlan.deposit_amount
              const progress = Math.min(100, Math.round((paidAmount / installmentPlan.total_amount) * 100))
              const nextPending = payments.find(p => p.status === 'pending')
              const hasOverdue = payments.some(p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < today))
              const daysToNext = nextPending ? Math.ceil((new Date(nextPending.due_date).getTime() - Date.now()) / 86400000) : null
              return (
                <div className={`bg-white rounded-2xl border shadow-sm p-4 ${hasOverdue ? 'border-red-200' : 'border-gray-100'}`}>
                  <h2 className="font-semibold text-gray-800 mb-3">🗓 Рассрочка</h2>
                  {hasOverdue && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3 text-sm text-red-700">
                      ⚠️ Есть просроченный платёж. Занятия могут быть приостановлены.
                    </div>
                  )}
                  {/* Прогресс */}
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Оплачено: {paidAmount.toLocaleString('ru-RU')} ₽</span>
                    <span>{installmentPlan.total_amount.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : hasOverdue ? 'bg-red-400' : 'bg-blue-500'}`}
                      style={{ width: `${progress}%` }} />
                  </div>
                  {/* Следующий платёж */}
                  {nextPending && daysToNext !== null && (
                    <div className={`text-sm rounded-xl px-3 py-2 mb-3 ${daysToNext <= 3 ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 'bg-blue-50 text-blue-700'}`}>
                      {daysToNext <= 0
                        ? `⚠ Платёж ${nextPending.amount.toLocaleString('ru-RU')} ₽ просрочен`
                        : daysToNext <= 3
                        ? `⏰ Ближайший платёж через ${daysToNext} дн. — ${nextPending.amount.toLocaleString('ru-RU')} ₽`
                        : `Следующий платёж: ${new Date(nextPending.due_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — ${nextPending.amount.toLocaleString('ru-RU')} ₽`}
                    </div>
                  )}
                  {/* График */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs py-1.5 border-b border-gray-50">
                      <span className="text-gray-500">Аванс {installmentPlan.deposit_paid_at ? `(${installmentPlan.deposit_paid_at})` : ''}</span>
                      <span className="text-green-600 font-medium">✓ {installmentPlan.deposit_amount.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    {payments.map(p => {
                      const isOverdue = p.status === 'overdue' || (p.status === 'pending' && p.due_date < today)
                      const isPaid = p.status === 'paid'
                      return (
                        <div key={p.id} className="flex justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                          <span className={isPaid ? 'text-green-600' : isOverdue ? 'text-red-500' : 'text-gray-700'}>
                            {isPaid ? '✓' : isOverdue ? '⚠' : '○'}{' '}
                            {new Date(p.due_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                          </span>
                          <span className={`font-medium ${isPaid ? 'text-green-600' : isOverdue ? 'text-red-500' : 'text-gray-700'}`}>
                            {(p.actual_amount ?? p.amount).toLocaleString('ru-RU')} ₽
                            {isPaid && p.paid_at && <span className="text-gray-400 font-normal ml-1">({p.paid_at})</span>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Расписание на эту неделю */}
            {scheduleSlots.length > 0 && (() => {
              const weekDates = getThisWeekDates()
              const jsDay = new Date().getDay()
              const todayNum = jsDay === 0 ? 7 : jsDay
              return (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h2 className="font-semibold text-gray-800 mb-3">📅 Расписание на неделю</h2>
                  <div className="space-y-2">
                    {[1,2,3,4,5,6,7].map(dayNum => {
                      const slot = scheduleSlots.find(s => s.day_of_week === dayNum)
                      if (!slot) return null
                      const dateStr = weekDates[dayNum]
                      const override = scheduleOverrides.find(o => o.date === dateStr)
                      const isToday = dayNum === todayNum
                      const isPast = new Date(dateStr + 'T23:59:59') < new Date()
                      const cancelled = override?.cancelled
                      const trainerName = override && !override.cancelled && override.trainer_name
                        ? override.trainer_name
                        : slot.trainer_name

                      return (
                        <div key={dayNum} className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${isPast && !isToday ? 'opacity-40' : ''}`}>
                          <div className={`text-xs w-20 shrink-0 ${isToday ? 'font-bold text-black' : 'text-gray-500'}`}>
                            {WEEK_DAYS_SHORT[dayNum]}{' '}
                            <span className="text-gray-400">
                              {new Date(dateStr + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          {cancelled ? (
                            <div className="flex-1">
                              <span className="text-xs text-red-500">❌ Тренировка отменена</span>
                              {override?.note && <span className="text-xs text-gray-400 ml-1">· {override.note}</span>}
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center gap-2">
                              {slot.time_start && (
                                <span className="text-xs font-medium text-gray-700">{slot.time_start.slice(0,5)}</span>
                              )}
                              {trainerName && (
                                <span className={`text-xs ${override && !override.cancelled ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                                  {override && !override.cancelled && override.trainer_name ? '🔄 ' : ''}
                                  {trainerName}
                                </span>
                              )}
                            </div>
                          )}
                          {isToday && <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full shrink-0">сегодня</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Контакты тренеров */}
            {trainersInfo.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
                  {trainersInfo.length === 1 ? 'Тренер' : 'Тренеры'}
                </div>
                <div className="space-y-4">
                  {trainersInfo.map(tr => (
                    <div key={tr.name}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-500 shrink-0">
                          {tr.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 text-sm">{tr.name}</div>
                          {tr.days.length > 0 && (
                            <div className="text-xs text-gray-400 mt-0.5">{tr.days.join(', ')}</div>
                          )}
                        </div>
                      </div>
                      {(tr.phone || tr.telegram_username || tr.vk_url) && (
                        <div className="flex gap-2 ml-13">
                          {tr.phone && (
                            <a href={`tel:${tr.phone}`}
                              className="flex-1 text-center border border-gray-200 text-gray-700 text-sm py-2 rounded-xl">
                              📞 Позвонить
                            </a>
                          )}
                          {tr.telegram_username && (
                            <a href={`https://t.me/${tr.telegram_username}`} target="_blank"
                              className="flex-1 text-center border border-blue-200 bg-blue-50 text-blue-700 text-sm py-2 rounded-xl">
                              ✈️ Telegram
                            </a>
                          )}
                          {tr.vk_url && (
                            <a href={tr.vk_url} target="_blank"
                              className="flex-1 text-center border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm py-2 rounded-xl">
                              ВК
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Календарь посещений */}
            <AttendanceCalendar attendance={attendance} />

            {/* Бонусные тренировки и мероприятия */}
            {(() => {
              const bonusRows: { date: string; label: string; kind: 'bonus' }[] = []
              if (subscription?.bonuses && subscription?.bonuses_used) {
                for (const key of Object.keys(subscription.bonuses)) {
                  const val = subscription.bonuses_used[key]
                  const dates: string[] = Array.isArray(val) ? val : Array.from({ length: (val as number) || 0 }, () => '')
                  for (const d of dates) {
                    if (d) bonusRows.push({ date: d, label: key, kind: 'bonus' })
                  }
                }
              }
              const evRows = eventVisits.map(ev => ({ date: ev.date, label: ev.title, kind: 'event' as const }))
              const extra = [...bonusRows, ...evRows].sort((a, b) => b.date.localeCompare(a.date))
              if (extra.length === 0) return null
              return (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h2 className="font-semibold text-gray-800 mb-3">🎁 Бонусы и мероприятия</h2>
                  <div className="space-y-2">
                    {extra.map((row, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          {new Date(row.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                        </span>
                        <span className={row.kind === 'bonus' ? 'text-purple-600' : 'text-blue-600'}>
                          {row.kind === 'bonus' ? '🎁' : '🏟'} {row.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Задания — плашка если есть */}
            {pendingTasks > 0 && (
              <button onClick={() => setTab('tasks')}
                className="w-full bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center gap-3 text-left">
                <span className="text-2xl">📋</span>
                <div>
                  <div className="font-semibold text-yellow-800">Есть задания от тренера</div>
                  <div className="text-sm text-yellow-600">{pendingTasks} не выполнено</div>
                </div>
                <span className="ml-auto text-yellow-500">→</span>
              </button>
            )}

            {/* Программа развития */}
            {aiProgram && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h2 className="font-semibold text-gray-800 mb-3">🗺 Программа развития</h2>
                <div className="space-y-2">
                  {aiProgram.split('\n').filter(l => l.trim()).map((line, i) => {
                    const isHeader = line.trim().match(/^[\d]+\.|^[-•]|^[А-ЯA-Z].*:$/)
                    return (
                      <div key={i} className={`text-sm leading-relaxed ${
                        isHeader ? 'font-medium text-gray-800 mt-1' : 'text-gray-500 pl-2'
                      }`}>
                        {line}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── ПРОГРЕСС ── */}
        {tab === 'progress' && (
          <>
            {surveys.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <div className="text-4xl mb-3">📊</div>
                <div className="font-medium text-gray-700">Пока нет данных</div>
                <div className="text-sm text-gray-400 mt-1">Прогресс появится после первого среза</div>
              </div>
            ) : (
              <>
                {/* Общий балл */}
                {latestScore !== null && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                      <div className="text-center">
                        <div className="text-xl font-bold leading-none">{latestScore}</div>
                        <div className="text-xs">балл</div>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">Общий прогресс</div>
                      {scoreDiff !== null && (
                        <div className={`text-sm mt-0.5 font-medium ${scoreDiff > 0 ? 'text-green-600' : scoreDiff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {scoreDiff > 0 ? `↑ +${scoreDiff}` : scoreDiff < 0 ? `↓ ${scoreDiff}` : '= без изменений'} с начала
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">{surveys.length} {surveys.length === 1 ? 'срез' : surveys.length < 5 ? 'среза' : 'срезов'}</div>
                    </div>
                  </div>
                )}

                {/* Радарная диаграмма */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h2 className="font-semibold text-gray-800 mb-3">Профиль качеств</h2>
                  <RadarChart surveys={surveys} />
                </div>

                {/* Физические показатели */}
                {(() => {
                  const physSurveys = [...surveys]
                    .filter(s => (s.height_cm as any) != null || (s.weight_kg as any) != null)
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  if (physSurveys.length === 0) return null
                  const weights = physSurveys.map(s => s.weight_kg as number | null)
                  const heights = physSurveys.map(s => s.height_cm as number | null)
                  const validW = weights.filter(v => v != null) as number[]
                  const validH = heights.filter(v => v != null) as number[]
                  const latestW = validW[validW.length - 1]
                  const latestH = validH[validH.length - 1]
                  const bmi = latestW != null && latestH != null ? latestW / (latestH / 100) ** 2 : null
                  const bmiCat = bmi == null ? null
                    : bmi < 18.5 ? { label: 'Дефицит веса', color: 'text-blue-600', bg: 'bg-blue-50' }
                    : bmi < 25   ? { label: 'Норма', color: 'text-green-600', bg: 'bg-green-50' }
                    : bmi < 30   ? { label: 'Избыточный вес', color: 'text-orange-500', bg: 'bg-orange-50' }
                    : { label: 'Ожирение', color: 'text-red-500', bg: 'bg-red-50' }

                  function trendOf(vals: number[]): { arrow: string; color: string; delta: string } {
                    if (vals.length < 2) return { arrow: '→', color: 'text-gray-400', delta: '' }
                    const n = vals.length; let sx = 0, sy = 0, sxy = 0, sx2 = 0
                    vals.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sx2 += x * x })
                    const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx)
                    if (Math.abs(slope) < 0.15) return { arrow: '→', color: 'text-gray-400', delta: '±0' }
                    const d = (slope * (n - 1)).toFixed(1)
                    return slope > 0
                      ? { arrow: '↑', color: 'text-green-500', delta: `+${d}` }
                      : { arrow: '↓', color: 'text-red-400', delta: d }
                  }
                  const wTrend = trendOf(validW)
                  const hTrend = trendOf(validH)

                  const W = 280, H = 110, pad = { t: 10, b: 22, l: 0, r: 0 }
                  const cw = W - pad.l - pad.r
                  const ch = H - pad.t - pad.b
                  const np = physSurveys.length
                  function xPos(i: number) { return pad.l + (np <= 1 ? cw / 2 : i / (np - 1) * cw) }

                  function buildLine(vals: (number | null)[], minV: number, maxV: number) {
                    const range = maxV - minV || 1
                    const pts = vals.map((v, i) => v == null ? null : {
                      x: xPos(i), y: pad.t + ch - (v - minV) / range * ch
                    })
                    const d = pts.reduce((acc, p, i) => {
                      if (!p) return acc
                      const cmd = acc === '' || pts.slice(0, i).every(pp => pp == null) ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : `L${p.x.toFixed(1)},${p.y.toFixed(1)}`
                      return acc + cmd
                    }, '')
                    return { d, pts }
                  }

                  const wLine = validW.length >= 1 ? buildLine(weights, Math.min(...validW) - 2, Math.max(...validW) + 2) : null
                  const hLine = validH.length >= 1 ? buildLine(heights, Math.min(...validH) - 2, Math.max(...validH) + 2) : null
                  const dates = physSurveys.map(s => {
                    const d = new Date(s.filled_at || s.created_at)
                    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
                  })

                  return (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <h2 className="font-semibold text-gray-800 mb-3">📏 Физические показатели</h2>
                      <div className="flex gap-2 mb-3">
                        {latestH != null && (
                          <div className="flex-1 bg-green-50 rounded-xl p-2.5 text-center">
                            <div className="text-lg font-bold text-green-700">{latestH}</div>
                            <div className="text-xs text-green-600">см рост</div>
                            {validH.length >= 2 && <div className={`text-xs font-medium ${hTrend.color}`}>{hTrend.arrow} {hTrend.delta}</div>}
                          </div>
                        )}
                        {latestW != null && (
                          <div className="flex-1 bg-blue-50 rounded-xl p-2.5 text-center">
                            <div className="text-lg font-bold text-blue-700">{latestW}</div>
                            <div className="text-xs text-blue-600">кг вес</div>
                            {validW.length >= 2 && <div className={`text-xs font-medium ${wTrend.color}`}>{wTrend.arrow} {wTrend.delta}</div>}
                          </div>
                        )}
                        {bmi != null && bmiCat != null && (
                          <div className={`flex-1 ${bmiCat.bg} rounded-xl p-2.5 text-center`}>
                            <div className={`text-lg font-bold ${bmiCat.color}`}>{bmi.toFixed(1)}</div>
                            <div className={`text-xs ${bmiCat.color}`}>ИМТ</div>
                            <div className={`text-[10px] font-medium ${bmiCat.color} leading-tight`}>{bmiCat.label}</div>
                          </div>
                        )}
                      </div>
                      {physSurveys.length >= 2 && (
                        <>
                          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
                            {[0, 0.25, 0.5, 0.75, 1].map(f => (
                              <line key={f} x1={0} x2={W} y1={pad.t + ch * (1 - f)} y2={pad.t + ch * (1 - f)}
                                stroke="#F3F4F6" strokeWidth="1" />
                            ))}
                            {hLine && hLine.d && (
                              <>
                                <path d={hLine.d} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                {hLine.pts.map((p, i) => p && (
                                  <g key={i}>
                                    <circle cx={p.x} cy={p.y} r="3" fill="#10B981" />
                                    <text x={p.x} y={p.y - 5} textAnchor="middle" fontSize="8" fill="#059669">{heights[i]}</text>
                                  </g>
                                ))}
                              </>
                            )}
                            {wLine && wLine.d && (
                              <>
                                <path d={wLine.d} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                {wLine.pts.map((p, i) => p && (
                                  <g key={i}>
                                    <circle cx={p.x} cy={p.y} r="3" fill="#3B82F6" />
                                    <text x={p.x} y={p.y + 13} textAnchor="middle" fontSize="8" fill="#2563EB">{weights[i]}</text>
                                  </g>
                                ))}
                              </>
                            )}
                            {dates.map((d, i) => (
                              <text key={i} x={xPos(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="#9CA3AF">{d}</text>
                            ))}
                          </svg>
                          <div className="flex gap-4 text-xs text-gray-400 mt-1">
                            {validH.length > 0 && <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-500 rounded" />Рост (см)</span>}
                            {validW.length > 0 && <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-blue-500 rounded" />Вес (кг)</span>}
                          </div>
                        </>
                      )}
                      {physSurveys.length === 1 && (
                        <p className="text-xs text-gray-400">График появится после второго среза</p>
                      )}
                    </div>
                  )
                })()}

                {/* Динамика по качествам — линейный график */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h2 className="font-semibold text-gray-800 mb-1">Динамика по качествам</h2>
                  <p className="text-xs text-gray-400 mb-4">Оценки тренера по всем срезам</p>
                  <ProgressLineChart surveys={surveys} />
                  {surveys.filter(s => s.trainer_filled_at).length >= 2 && (
                    <div className="flex gap-3 mt-4 flex-wrap border-t border-gray-50 pt-3">
                      {surveys.filter(s => s.trainer_filled_at).map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: SURVEY_COLORS[i % SURVEY_COLORS.length] }} />
                          <span className="text-xs text-gray-400">
                            {s.title || (i === 0 ? 'Старт' : `Срез ${i + 1}`)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* История срезов */}
                {surveys.length > 1 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h2 className="font-semibold text-gray-800 mb-3">История срезов</h2>
                    <div className="space-y-2">
                      {Object.entries(
                        surveys.reduce((acc, s) => {
                          const y = new Date(s.created_at || s.filled_at || '').getFullYear() || 'Неизвестно'
                          if (!acc[y]) acc[y] = []
                          acc[y].push(s)
                          return acc
                        }, {} as Record<string | number, Survey[]>)
                      ).sort(([a], [b]) => Number(b) - Number(a)).map(([year, sList]) => (
                        <div key={year}>
                          {surveys.length > 3 && (
                            <div className="text-xs text-gray-400 font-medium mb-1.5">{year}</div>
                          )}
                          {sList.map((s, i) => (
                            <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                              <span className="text-sm text-gray-700">{s.title || `Срез ${i + 1}`}</span>
                              <span className="text-xs text-gray-400">
                                {s.filled_at
                                  ? new Date(s.filled_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
                                  : '⏳ ожидается'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── ЗАДАНИЯ ── */}
        {tab === 'tasks' && (
          <>
            {tasks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <div className="text-4xl mb-3">📋</div>
                <div className="font-medium text-gray-700">Заданий нет</div>
                <div className="text-sm text-gray-400 mt-1">Тренер пока не назначил задания</div>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id}
                    className={`bg-white rounded-2xl border shadow-sm p-4 transition-opacity ${
                      task.completed ? 'border-green-100 opacity-70' : 'border-gray-100'
                    }`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleTask(task.id, task.completed)}
                        disabled={togglingTask === task.id}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          task.completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-black'
                        }`}>
                        {task.completed && <span className="text-xs font-bold">✓</span>}
                      </button>
                      <div className="flex-1">
                        <div className={`font-medium text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-sm text-gray-500 mt-1">{task.description}</div>
                        )}
                        {task.due_date && !task.completed && (
                          <div className={`text-xs mt-1.5 ${
                            new Date(task.due_date) < new Date() ? 'text-red-500' : 'text-gray-400'
                          }`}>
                            до {new Date(task.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ДОСТИЖЕНИЯ ── */}
        {tab === 'achievements' && (
          <>
            {certs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <div className="text-4xl mb-3">🏆</div>
                <div className="font-medium text-gray-700">Достижений пока нет</div>
                <div className="text-sm text-gray-400 mt-1">Здесь будут аттестации, семинары и соревнования</div>
              </div>
            ) : (
              <>
                {/* Сгруппировать по типу */}
                {(['belt','competition','seminar','masterclass','other'] as const).map(type => {
                  const list = certs.filter(c => c.type === type)
                  if (list.length === 0) return null
                  return (
                    <div key={type} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <h2 className="font-semibold text-gray-800 mb-3">
                        {CERT_ICONS[type]} {CERT_LABELS[type]}
                      </h2>
                      <div className="space-y-2">
                        {list.map(c => (
                          <div key={c.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-800">{c.title}</div>
                              {c.notes && <div className="text-xs text-gray-500 mt-0.5">{c.notes}</div>}
                            </div>
                            {c.date && (
                              <div className="text-xs text-gray-400 shrink-0">
                                {new Date(c.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* Милстоуны */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="font-semibold text-gray-800 mb-3">🎯 Ступени мастерства</h2>
              <div className="grid grid-cols-3 gap-2">
                {milestones.map(m => (
                  <div key={m.count} className={`rounded-xl p-3 text-center transition-all ${
                    m.achieved ? 'bg-black text-white' : 'bg-gray-50 text-gray-300'
                  }`}>
                    <div className={`text-2xl mb-1 ${m.achieved ? '' : 'grayscale opacity-40'}`}>{m.icon}</div>
                    <div className={`text-xs font-medium leading-tight ${m.achieved ? 'text-white' : 'text-gray-400'}`}>
                      {m.label}
                    </div>
                    {m.achieved && <div className="text-xs text-white/60 mt-0.5">✓</div>}
                  </div>
                ))}
              </div>
              {totalAttendance > 0 && (
                <div className="mt-3 text-xs text-gray-400 text-center">
                  Всего тренировок: <span className="font-semibold text-gray-700">{totalAttendance}</span>
                  {totalAttendance < 100 && (() => {
                    const next = milestones.find(m => !m.achieved)
                    return next ? ` · до «${next.label}»: ${next.count - totalAttendance}` : null
                  })()}
                </div>
              )}
            </div>

            {/* Статистика */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="font-semibold text-gray-800 mb-3">📈 Статистика</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-800">{totalAttendance}</div>
                  <div className="text-xs text-gray-500 mt-0.5">тренировок всего</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-800">{certs.length}</div>
                  <div className="text-xs text-gray-500 mt-0.5">достижений</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-800">{streak}</div>
                  <div className="text-xs text-gray-500 mt-0.5">серия занятий 🔥</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-800">{tasks.filter(t => t.completed).length}</div>
                  <div className="text-xs text-gray-500 mt-0.5">заданий выполнено</div>
                </div>
              </div>
            </div>

            {/* Паспорт прогресса — История */}
            {(() => {
              type TimelineEvent = { date: string; icon: string; title: string }
              const events: TimelineEvent[] = []

              const startDate = trainingStartDate || firstSubDate || student?.created_at
              if (startDate) {
                events.push({ date: startDate, icon: '🎌', title: 'Начало пути в Школе Самурая' })
              }

              const presentSorted = [...attendance]
                .filter(a => a.present)
                .sort((a, b) => a.date.localeCompare(b.date))

              if (presentSorted.length > 0) {
                events.push({ date: presentSorted[0].date, icon: '🥋', title: 'Первая тренировка' })
              }

              const milestoneList: { n: number; icon: string }[] = [
                { n: 10, icon: '🔥' }, { n: 25, icon: '💪' }, { n: 50, icon: '🥋' }, { n: 100, icon: '🏆' },
              ]
              for (const { n, icon } of milestoneList) {
                if (presentSorted.length >= n) {
                  events.push({ date: presentSorted[n - 1].date, icon, title: `${n} тренировок` })
                }
              }

              surveys.filter(s => s.filled_at).forEach(s => {
                events.push({ date: s.filled_at as string, icon: '📊', title: 'Срез прогресса' })
              })

              certs.filter(c => c.date).forEach(c => {
                events.push({ date: c.date as string, icon: CERT_ICONS[c.type] || '⭐', title: c.title })
              })

              events.sort((a, b) => b.date.localeCompare(a.date))
              if (events.length === 0) return null

              return (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h2 className="font-semibold text-gray-800 mb-4">🗺️ История</h2>
                  <div>
                    {events.map((ev, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-base shrink-0">
                            {ev.icon}
                          </div>
                          {i < events.length - 1 && (
                            <div className="w-0.5 bg-gray-100 flex-1 mt-1 min-h-[16px]" />
                          )}
                        </div>
                        <div className="pt-1 pb-3 flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800">{ev.title}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {new Date(ev.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </>
        )}

        {/* ── СВЯЗЬ С ТРЕНЕРОМ ── */}
        {tab === 'tickets' && (
          <div className="space-y-3">
            {showTicketForm ? (
              <form onSubmit={sendTicket} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                <div className="font-semibold text-gray-800 text-sm">Новое обращение</div>
                <select required value={ticketForm.type}
                  onChange={e => setTicketForm({ ...ticketForm, type: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
                  <option value="">Выберите тип *</option>
                  <option value="болезнь">🤒 Болезнь / пропуск</option>
                  <option value="перенос">🔄 Перенос занятия</option>
                  <option value="жалоба">⚠️ Жалоба</option>
                  <option value="вопрос">❓ Вопрос тренеру</option>
                </select>
                <textarea value={ticketForm.description}
                  onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })}
                  placeholder="Опишите подробнее (необязательно)" rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
                <div className="flex gap-2">
                  <button type="submit" disabled={ticketSending}
                    className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                    {ticketSending ? 'Отправка...' : 'Отправить'}
                  </button>
                  <button type="button" onClick={() => setShowTicketForm(false)}
                    className="px-4 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm">
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowTicketForm(true)}
                className="w-full bg-black text-white py-3 rounded-2xl text-sm font-medium">
                + Написать тренеру
              </button>
            )}

            {tickets.length === 0 && !showTicketForm ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <div className="text-4xl mb-3">📬</div>
                <div className="font-medium text-gray-700">Обращений пока нет</div>
                <div className="text-sm text-gray-400 mt-1">Здесь появятся твои вопросы и сообщения тренеру</div>
              </div>
            ) : tickets.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {tickets.map(t => (
                  <div key={t.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800">
                        {{ болезнь: '🤒 Болезнь', перенос: '🔄 Перенос занятия', жалоба: '⚠️ Жалоба', вопрос: '❓ Вопрос' }[t.type] ?? t.type}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {t.status === 'pending' && (
                          <span className="text-orange-500 font-bold text-base leading-none" title="Ожидает ответа">!</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${{
                          pending:   'bg-yellow-100 text-yellow-700',
                          in_review: 'bg-blue-100 text-blue-700',
                          resolved:  'bg-green-100 text-green-700',
                        }[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {{ pending: 'Новое', in_review: 'В работе', resolved: 'Решено' }[t.status] ?? t.status}
                        </span>
                      </div>
                    </div>
                    {t.description && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.description}</p>
                    )}
                    {t.resolution_note && (
                      <div className="mt-2 bg-green-50 rounded-xl px-3 py-2">
                        <div className="text-xs text-green-600 font-medium mb-0.5">✅ Ответ тренера:</div>
                        <p className="text-sm text-green-800 leading-relaxed">{t.resolution_note}</p>
                      </div>
                    )}
                    <div className="text-xs text-gray-300 mt-2">
                      {new Date(t.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
