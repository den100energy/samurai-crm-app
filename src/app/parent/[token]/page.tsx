'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FujiScene } from '@/components/FujiScene'
import { localDateStr } from '@/lib/dates'
import { CabinetTour } from '@/components/CabinetTour'
import { PARENT_TOUR_SLIDES } from '@/lib/onboarding'
import { SubscriptionQuiz } from '@/components/SubscriptionQuiz'

type Student = { id: string; name: string; group_name: string | null; birth_date: string | null; photo_url: string | null }
type ScheduleSlot = { day_of_week: number; time_start: string | null; trainer_name: string | null }
type ScheduleOverride = { date: string; trainer_name: string | null; cancelled: boolean }

const DAYS = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const DAYS_FULL = ['', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
type Subscription = { id: string; type: string; sessions_total: number | null; sessions_left: number | null; start_date: string | null; end_date: string | null; amount: number | null; bonuses: Record<string, number> | null; bonuses_used: Record<string, number | string[]> | null; is_pending: boolean }
type InstallmentPlan = { id: string; total_amount: number; deposit_amount: number; deposit_paid_at: string | null; installment_payments: { id: string; amount: number; due_date: string; status: string; paid_at: string | null; actual_amount: number | null }[] }
type Attendance = { id: string; date: string; present: boolean }
type Survey = { id: string; survey_number: number; title: string | null; filled_at: string | null; created_at: string } & Record<string, number | null>
type Ticket = { id: string; type: string; description: string | null; status: string; resolution_note: string | null; created_at: string }
type Cert = { id: string; type: string; title: string; date: string | null }
type AttestationApp = {
  id: string
  discipline: string
  current_grade: string
  target_grade: string
  preatt1_status: string | null
  preatt1_notes: string | null
  preatt2_status: string | null
  preatt2_notes: string | null
  paid: boolean
  price: number | null
  result: string | null
  result_grade: string | null
  sensei_notes: string | null
  status: string
  attestation_events: { title: string; event_date: string } | null
}

const TICKET_TYPE_LABELS: Record<string, string> = {
  'болезнь': '🤒 Болезнь',
  'перенос': '🔄 Перенос занятия',
  'жалоба':  '⚠️ Жалоба',
  'вопрос':  '❓ Вопрос',
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

const AIKIDO_GRADES = ['11 кю','10 кю','9 кю','8 кю','7 кю','6 кю','5 кю','4 кю','3 кю','2 кю','1 кю','1 дан','2 дан','3 дан','4 дан']
const WUSHU_GRADES  = ['10 туди','9 туди','8 туди','7 туди','6 туди','5 туди','4 туди','3 туди','2 туди','1 степень','2 степень','3 степень','4 степень']
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
function monthsBetween(from: string, to: string): number {
  const a = new Date(from), b = new Date(to)
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

const QUALITIES = ['strength','speed','endurance','agility','coordination','posture','flexibility','discipline','sociability','confidence','learnability','attentiveness','emotional_balance','goal_orientation','activity','self_defense']
const QUALITY_LABELS: Record<string, string> = {
  strength:'Сила', speed:'Быстрота', endurance:'Выносливость', agility:'Ловкость',
  coordination:'Координация', posture:'Осанка', flexibility:'Гибкость', discipline:'Дисциплина',
  sociability:'Общительность', confidence:'Уверенность', learnability:'Обучаемость',
  attentiveness:'Внимательность', emotional_balance:'Уравновешенность',
  goal_orientation:'Целеустремлённость', activity:'Активность', self_defense:'Самозащита',
}
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

function calcScore(s: Survey) {
  const vals = QUALITIES.map(k => s[`trainer_${k}`] as number | null).filter(v => v != null) as number[]
  return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) : 0
}

function ParentRadarChart({ surveys }: { surveys: Survey[] }) {
  const filled = surveys.filter(s => s.filled_at).slice(-3)
  if (filled.length === 0) return null
  const size = 260, cx = 130, cy = 130, r = 95, n = QUALITIES.length
  function getPoint(i: number, val: number) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return { x: cx + (val / 10) * r * Math.cos(angle), y: cy + (val / 10) * r * Math.sin(angle) }
  }
  function getLabelPoint(i: number) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return { x: cx + (r + 22) * Math.cos(angle), y: cy + (r + 22) * Math.sin(angle) }
  }
  return (
    <div className="flex flex-col items-center">
      <svg width={size + 80} height={size + 40} viewBox={`-40 -20 ${size + 80} ${size + 40}`}>
        {[2,4,6,8,10].map(level => {
          const pts = QUALITIES.map((_, i) => getPoint(i, level))
          return <path key={level} d={pts.map((p,i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ')+'Z'} fill="none" stroke="#E5E7EB" strokeWidth="1" />
        })}
        {QUALITIES.map((_, i) => {
          const p = getPoint(i, 10)
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="1" />
        })}
        {filled.map((survey, si) => {
          const pts = QUALITIES.map((k, i) => getPoint(i, (survey[`trainer_${k}`] as number) || 0))
          const d = pts.map((p,i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ')+'Z'
          return <path key={si} d={d} fill={COLORS[si]} fillOpacity="0.15" stroke={COLORS[si]} strokeWidth="2" />
        })}
        {QUALITIES.map((k, i) => {
          const lp = getLabelPoint(i)
          return (
            <text key={k} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#6B7280">
              {QUALITY_LABELS[k].length <= 7 ? QUALITY_LABELS[k] : QUALITY_LABELS[k].slice(0,6)+'.'}
            </text>
          )
        })}
      </svg>
      <div className="flex gap-3 flex-wrap justify-center mt-1">
        {filled.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i] }} />
            <span className="text-xs text-gray-500">
              {s.title || (i === 0 ? 'Старт' : `Срез ${i + 1}`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ParentPage() {
  const { token } = useParams<{ token: string }>()
  const [student, setStudent] = useState<Student | null>(null)
  const [activeSub, setActiveSub] = useState<Subscription | null>(null)
  const [installmentPlan, setInstallmentPlan] = useState<InstallmentPlan | null>(null)
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [tab, setTab] = useState<'sub' | 'attendance' | 'progress' | 'tasks' | 'attestation' | 'tickets'>('sub')
  const [attestationApps, setAttestationApps] = useState<AttestationApp[]>([])
  const [assignments, setAssignments] = useState<{ id: string; title: string; description: string | null; due_date: string | null; completed: boolean }[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketForm, setTicketForm] = useState({ type: '', description: '' })
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketSending, setTicketSending] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([])
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>([])
  const [trainers, setTrainers] = useState<{ name: string; phone: string | null; telegram_username: string | null }[]>([])
  const [certs, setCerts] = useState<Cert[]>([])
  const [bonusTotalValue, setBonusTotalValue] = useState<number | null>(null)
  const [subTypes, setSubTypes] = useState<any[]>([])
  const [eventVisits, setEventVisits] = useState<{ date: string; title: string; bonus_type: string | null }[]>([])
  const [seminarHistory, setSeminarHistory] = useState<{ id: string; title: string; starts_at: string }[]>([])
  const [openEvents, setOpenEvents] = useState<{ id: string; title: string; discipline: string; event_date: string }[]>([])
  const [upcomingRegEvents, setUpcomingRegEvents] = useState<{ id: string; name: string; date: string; time_start: string | null; bonus_type: string | null }[]>([])
  const [openSeminars, setOpenSeminars] = useState<{ id: string; title: string; starts_at: string; ends_at: string; seminar_tariffs: { id: string; name: string; base_price: number | null; increase_pct: number; increase_every_days: number; increase_starts_at: string | null; min_deposit_pct: number }[] }[]>([])
  const [myRegistrations, setMyRegistrations] = useState<{ id: string; seminar_id: string; participant_name: string; status: string; locked_price: number | null; deposit_amount: number | null; seminar_tariffs: { name: string } | null }[]>([])
  const [showAppForm, setShowAppForm] = useState(false)
  const [appSubmitting, setAppSubmitting] = useState(false)
  const [appForm, setAppForm] = useState({ event_id: '', discipline: 'aikido' as 'aikido' | 'wushu', current_grade: '', target_grade: '', last_attestation_date: '' })

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase
        .from('students').select('id, name, group_name, birth_date, photo_url')
        .eq('parent_token', token).eq('status', 'active').single()
      if (!s) { setNotFound(true); return }
      setStudent(s)
      // Даты текущей недели для overrides
      const now = new Date()
      const jsDay = now.getDay()
      const monday = new Date(now); monday.setDate(now.getDate() - (jsDay === 0 ? 6 : jsDay - 1))
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 13) // 2 недели вперёд
      const mondayStr = localDateStr(monday)
      const sundayStr = localDateStr(sunday)

      const [{ data: subs }, { data: att }, { data: sv }, { data: tk }, { data: certsData }, { data: sched }, { data: ovs }, { data: evParts }, { data: asgnData }, { data: attApps }, { data: openEventsData }, { data: beltsData }, { data: openSeminarsData }, { data: myRegsData }, { data: semRegsData }, { data: regEventsData }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('student_id', s.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('attendance').select('*').eq('student_id', s.id).order('date', { ascending: false }).limit(90),
        supabase.from('progress_surveys').select('*').eq('student_id', s.id).not('filled_at', 'is', null).order('created_at'),
        supabase.from('tickets').select('id, type, description, status, resolution_note, created_at').eq('student_id', s.id).neq('type', 'crm_задача').order('created_at', { ascending: false }),
        supabase.from('certifications').select('id, type, title, date').eq('student_id', s.id).order('date', { ascending: false }),
        s.group_name
          ? supabase.from('schedule').select('day_of_week, time_start, trainer_name').eq('group_name', s.group_name).order('day_of_week').order('time_start')
          : Promise.resolve({ data: [] }),
        s.group_name
          ? supabase.from('schedule_overrides').select('date, trainer_name, cancelled').eq('group_name', s.group_name).gte('date', mondayStr).lte('date', sundayStr)
          : Promise.resolve({ data: [] }),
        supabase.from('event_participants').select('events(name, date, bonus_type)').eq('student_id', s.id),
        supabase.from('assignments').select('id, title, description, due_date, completed')
          .eq('student_id', s.id).eq('status', 'approved').order('created_at', { ascending: false }),
        supabase.from('attestation_applications')
          .select('id, discipline, current_grade, target_grade, preatt1_status, preatt1_notes, preatt2_status, preatt2_notes, paid, price, result, result_grade, sensei_notes, status, attestation_events(title, event_date)')
          .eq('student_id', s.id).order('created_at', { ascending: false }),
        supabase.from('attestation_events').select('id, title, discipline, event_date').eq('status', 'open').order('event_date'),
        supabase.from('belts').select('discipline, belt_name, date').eq('student_id', s.id).order('date', { ascending: false }),
        supabase.from('seminar_events').select('id, title, starts_at, ends_at, seminar_tariffs(id, name, base_price, increase_pct, increase_every_days, increase_starts_at, min_deposit_pct)').eq('status', 'open').order('starts_at'),
        supabase.from('seminar_registrations').select('id, seminar_id, participant_name, status, locked_price, deposit_amount, seminar_tariffs(name)').eq('student_id', s.id).order('submitted_at', { ascending: false }),
        supabase.from('seminar_registrations').select('id, seminar_events(title, starts_at)').eq('student_id', s.id).eq('attended', true).order('created_at', { ascending: false }),
        supabase.from('events').select('id, name, date, time_start, bonus_type, group_restriction').gte('date', localDateStr(new Date())).order('date'),
      ])
      const evVisits = ((evParts || []) as any[])
        .map(ep => ep.events)
        .filter(ev => ev?.date && ev?.name)
        .map(ev => ({ date: ev.date as string, title: ev.name as string, bonus_type: (ev.bonus_type as string | null) ?? null }))
      setEventVisits(evVisits)

      const semRegs = ((semRegsData || []) as any[])
        .filter(r => r.seminar_events?.title)
        .map(r => ({ id: r.id as string, title: r.seminar_events.title as string, starts_at: r.seminar_events.starts_at as string }))
      setSeminarHistory(semRegs)

      const groupName = s.group_name
      const regEvs = ((regEventsData || []) as any[])
        .filter(e => !e.group_restriction || e.group_restriction.length === 0 || (groupName && e.group_restriction.includes(groupName)))
        .map(e => ({ id: e.id, name: e.name, date: e.date, time_start: e.time_start, bonus_type: e.bonus_type }))
      setUpcomingRegEvents(regEvs)
      const foundSub = subs?.find((s: Subscription) => !s.is_pending) || null
      if (subs && subs.length > 0) setActiveSub(foundSub)
      if (foundSub?.id) {
        const { data: iplan } = await supabase
          .from('installment_plans')
          .select('id, total_amount, deposit_amount, deposit_paid_at, installment_payments(id, amount, due_date, status, paid_at, actual_amount)')
          .eq('subscription_id', foundSub.id)
          .eq('status', 'active')
          .maybeSingle()
        setInstallmentPlan(iplan as InstallmentPlan | null)
      }
      if (foundSub?.type) {
        // Сначала ищем по точному имени (новые абонементы)
        let { data: stData } = await supabase
          .from('subscription_types').select('bonus_total_value')
          .eq('name', foundSub.type).maybeSingle()
        // Если не нашли — старое название вида "Старт16", ищем по кол-ву занятий
        if (!stData) {
          const sessCount = foundSub.sessions_total
          const grp = foundSub.type?.startsWith('Комбат') ? 'Комбат' : 'Старт'
          if (sessCount) {
            const { data: stData2 } = await supabase
              .from('subscription_types').select('bonus_total_value')
              .eq('sessions_count', sessCount).eq('group_type', grp).eq('is_for_newcomers', false).maybeSingle()
            stData = stData2
          }
        }
        setBonusTotalValue(stData?.bonus_total_value ?? null)
      }
      setAttendance(att || [])
      setSurveys(sv || [])
      setTickets(tk || [])
      setAssignments(asgnData || [])
      setAttestationApps((attApps as unknown as AttestationApp[]) || [])
      const openEvs = (openEventsData || []) as { id: string; title: string; discipline: string; event_date: string }[]
      setOpenEvents(openEvs)
      setOpenSeminars((openSeminarsData as any[]) || [])
      setMyRegistrations((myRegsData as any[]) || [])
      if (openEvs.length > 0) {
        const ev = openEvs[0]
        const disc: 'aikido' | 'wushu' = ev.discipline === 'wushu' ? 'wushu' : 'aikido'
        const grades = disc === 'aikido' ? AIKIDO_GRADES : WUSHU_GRADES
        const lastBelt = (beltsData || []).find((b: { discipline: string | null; belt_name: string; date: string }) => !b.discipline || b.discipline === disc)
        const currentIdx = lastBelt ? grades.indexOf(lastBelt.belt_name) : -1
        const nextGrade = currentIdx >= 0 && currentIdx + 1 < grades.length ? grades[currentIdx + 1] : (grades[0] || '')
        setAppForm({
          event_id: ev.id,
          discipline: disc,
          current_grade: lastBelt?.belt_name || '',
          target_grade: nextGrade,
          last_attestation_date: lastBelt?.date || '',
        })
      }
      setCerts(certsData || [])
      const slots = (sched as ScheduleSlot[]) || []
      setSchedule(slots)
      setScheduleOverrides((ovs as ScheduleOverride[]) || [])
      // Загрузить тарифы группы для квиза
      const groupType = s.group_name?.includes('4-9') || s.group_name?.includes('Дети') ? 'Старт' : 'Комбат'
      const { data: stData } = await supabase
        .from('subscription_types')
        .select('id, name, group_type, sessions_count, price, price_per_session, duration_months, bonuses, bonus_total_value, is_for_newcomers')
        .eq('group_type', groupType)
        .order('sessions_count')
      setSubTypes(stData || [])

      // Загрузить контакты тренеров этой группы
      const trainerNames = [...new Set(slots.map(sl => sl.trainer_name).filter(Boolean))] as string[]
      if (trainerNames.length > 0) {
        const { data: trData } = await supabase.from('trainers').select('name, phone, telegram_username').in('name', trainerNames)
        setTrainers(trData || [])
      }
    }
    load()
  }, [token])

  if (notFound) return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center text-gray-400 p-8">
        <div className="text-4xl mb-3">🔒</div>
        <div className="font-medium text-gray-600">Страница не найдена</div>
        <div className="text-sm mt-1">Проверьте ссылку или обратитесь к тренеру</div>
      </div>
    </main>
  )

  if (!student) return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400 text-sm">Загрузка...</div>
    </main>
  )

  // Ближайшее занятие
  function getNextLesson() {
    if (schedule.length === 0) return null
    const now = new Date()
    const todayTime = now.getHours() * 60 + now.getMinutes()
    // Ищем в ближайшие 7 дней
    for (let offset = 0; offset <= 7; offset++) {
      const checkDate = new Date(now)
      checkDate.setDate(now.getDate() + offset)
      const checkDay = checkDate.getDay() === 0 ? 7 : checkDate.getDay()
      const checkStr = localDateStr(checkDate)
      // Проверяем override на этот день
      const override = scheduleOverrides.find(o => o.date === checkStr)
      if (override?.cancelled) continue
      const slots = schedule.filter(s => s.day_of_week === checkDay)
      for (const slot of slots) {
        if (!slot.time_start) continue
        const [h, m] = slot.time_start.split(':').map(Number)
        const slotMins = h * 60 + m
        if (offset === 0 && slotMins <= todayTime) continue // уже прошло сегодня
        const trainerName = override?.trainer_name ?? slot.trainer_name
        return { date: checkStr, day: checkDay, time: slot.time_start, trainer: trainerName, isToday: offset === 0, isTomorrow: offset === 1 }
      }
    }
    return null
  }
  const nextLesson = getNextLesson()

  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1)
  const presentCount = attendance.filter(a => a.present && new Date(a.date) >= monthAgo).length
  const lastVisit = attendance.find(a => a.present)?.date

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })
  }
  const latestSurvey = surveys[surveys.length - 1] ?? null
  const firstSurvey = surveys[0] ?? null

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
    if (data) setTickets(prev => [data, ...prev])
    setTicketForm({ type: '', description: '' })
    setShowTicketForm(false)
    setTicketSending(false)
  }

  async function submitApplication() {
    if (!student || !appForm.event_id || !appForm.discipline || !appForm.current_grade || !appForm.target_grade) return
    setAppSubmitting(true)
    const { data: newApp } = await supabase.from('attestation_applications').insert({
      event_id: appForm.event_id,
      student_id: student.id,
      discipline: appForm.discipline,
      current_grade: appForm.current_grade,
      target_grade: appForm.target_grade,
      last_attestation_date: appForm.last_attestation_date || null,
      status: 'pending',
    }).select('id, discipline, current_grade, target_grade, preatt1_status, preatt1_notes, preatt2_status, preatt2_notes, paid, price, result, result_grade, sensei_notes, status, attestation_events(title, event_date)').single()
    if (newApp) setAttestationApps(prev => [newApp as unknown as AttestationApp, ...prev])
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `🥋 Новая заявка на аттестацию\nУченик: ${student.name}\nДисциплина: ${appForm.discipline === 'aikido' ? 'Айкидо' : 'Ушу'}\nЦель: ${appForm.target_grade}\nТекущий уровень: ${appForm.current_grade || '—'}`,
      }),
    }).catch(() => {})
    setShowAppForm(false)
    setAppSubmitting(false)
  }

  function sessionsColor(left: number | null) {
    if (left === null) return 'text-gray-600'
    if (left === 0) return 'text-red-600'
    if (left <= 2) return 'text-orange-500'
    return 'text-green-600'
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <CabinetTour
        storageKey="samurai_parent_tour_done"
        slides={PARENT_TOUR_SLIDES}
        personName={student.name.split(' ')[0]}
      />
      <div className="max-w-sm mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden">
          <FujiScene dark={false} bgColor="#F9FAFB" />
          <div className="absolute inset-x-0 bottom-0 pb-4 flex flex-col items-center z-10">
            {student.photo_url ? (
              <img src={student.photo_url} alt={student.name}
                className="w-16 h-16 rounded-full object-cover shadow-lg border-2 border-white mb-2" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/90 text-gray-800 flex items-center justify-center text-2xl font-bold shadow-lg border-2 border-white mb-2">
                {student.name[0]}
              </div>
            )}
            <div className="text-white text-lg font-bold drop-shadow-lg">{student.name}</div>
            <div className="text-white/70 text-sm drop-shadow">{student.group_name || 'Группа не указана'}</div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex">
          {([
            { key: 'sub',         icon: '💳', label: 'Або-т' },
            { key: 'attendance',  icon: '📅', label: 'Посещ.' },
            { key: 'progress',    icon: '📈', label: 'Прогр.', badge: surveys.length > 0 ? surveys.length : null },
            { key: 'tasks',       icon: '📋', label: 'Задан.', badge: assignments.filter(a => !a.completed).length || null },
            { key: 'attestation', icon: '🎉', label: 'Мероп.',  badge: attestationApps.filter(a => a.status === 'pending' || (!a.paid && a.preatt1_status === 'approved')).length || null },
            { key: 'tickets',     icon: '📞', label: 'Тренер', badge: tickets.filter(t => t.status === 'pending').length || null },
          ] as { key: typeof tab; icon: string; label: string; badge?: number | null }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex flex-col items-center pt-2 pb-1.5 border-b-2 transition-colors relative ${
                tab === t.key ? 'border-black text-black' : 'border-transparent text-gray-400'
              }`}>
              <div className="relative">
                <span className="text-base leading-none">{t.icon}</span>
                {t.badge && tab !== t.key && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{t.badge}</span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 font-medium">{t.label}</span>
            </button>
          ))}
          </div>
        </div>

        <div className="p-4 space-y-3">

          {/* ── АБОНЕМЕНТ ── */}
          {tab === 'sub' && (
            <>
              {(() => {
                const today = localDateStr()
                const isExpiredByDate = activeSub?.end_date ? activeSub.end_date < today : false
                const isExpiredBySessions = activeSub !== null && activeSub.sessions_left !== null && activeSub.sessions_left <= 0
                const isExpired = isExpiredByDate || isExpiredBySessions
                const bonusEntries = activeSub?.bonuses ? Object.entries(activeSub.bonuses) : []
                return (
                  <div className={`bg-white rounded-2xl p-5 border shadow-sm ${isExpired ? 'border-red-200' : 'border-gray-100'}`}>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Текущий абонемент</div>
                    {isExpired && (
                      <div className="bg-red-500 text-white text-sm font-medium text-center py-2 rounded-xl mb-3">
                        ❌ Абонемент окончен — необходимо продление
                      </div>
                    )}
                    {activeSub ? (
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-3">{activeSub.type}</div>
                        {activeSub.sessions_left !== null && (
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-500">Осталось занятий</span>
                            <span className={`text-2xl font-bold ${sessionsColor(activeSub.sessions_left)}`}>
                              {activeSub.sessions_left}
                              {activeSub.sessions_total ? <span className="text-sm font-normal text-gray-400"> / {activeSub.sessions_total}</span> : ''}
                            </span>
                          </div>
                        )}
                        {activeSub.start_date && (
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-500">Начало</span>
                            <span className="text-sm text-gray-600">{fmtDate(activeSub.start_date)}</span>
                          </div>
                        )}
                        {activeSub.end_date && (
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-500">Действует до</span>
                            <span className={`text-sm font-medium ${isExpiredByDate ? 'text-red-500' : 'text-gray-700'}`}>{fmtDate(activeSub.end_date)}</span>
                          </div>
                        )}
                        {activeSub.amount && (
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-500">Стоимость</span>
                            <span className="text-sm font-medium text-gray-700">{activeSub.amount.toLocaleString('ru-RU')} ₽</span>
                          </div>
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
                              const val = activeSub.bonuses_used?.[key]
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
                        {!isExpired && activeSub.sessions_left !== null && activeSub.sessions_left <= 2 && activeSub.sessions_left > 0 && (
                          <div className="mt-3 p-2 bg-orange-50 rounded-xl text-xs text-orange-600 text-center">
                            Скоро закончится — пора продлить абонемент
                          </div>
                        )}
                        {/* Апсейл */}
                        {!isExpired && activeSub.sessions_left !== null && activeSub.sessions_total !== null &&
                          activeSub.sessions_total >= 8 &&
                          activeSub.sessions_left <= Math.ceil(activeSub.sessions_total * 0.15) &&
                          activeSub.sessions_left > 0 && (
                          <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700">
                            <div className="font-semibold mb-1">💡 {student.name} ходит на полную!</div>
                            <div className="text-purple-600">Ваш ребёнок использует абонемент максимально. Спросите тренера о безлимитном варианте — обычно выгоднее при такой активности.</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 text-center py-2">Абонемент не найден</div>
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
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Оплачено: {paidAmount.toLocaleString('ru-RU')} ₽</span>
                      <span>{installmentPlan.total_amount.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : hasOverdue ? 'bg-red-400' : 'bg-blue-500'}`}
                        style={{ width: `${progress}%` }} />
                    </div>
                    {nextPending && daysToNext !== null && (
                      <div className={`text-sm rounded-xl px-3 py-2 mb-3 ${daysToNext <= 3 ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 'bg-blue-50 text-blue-700'}`}>
                        {daysToNext <= 0
                          ? `⚠ Платёж ${nextPending.amount.toLocaleString('ru-RU')} ₽ просрочен`
                          : daysToNext <= 3
                          ? `⏰ Ближайший платёж через ${daysToNext} дн. — ${nextPending.amount.toLocaleString('ru-RU')} ₽`
                          : `Следующий платёж: ${new Date(nextPending.due_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — ${nextPending.amount.toLocaleString('ru-RU')} ₽`}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs py-1.5 border-b border-gray-50">
                        <span className="text-gray-500">Аванс</span>
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
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                  <div className="text-2xl font-bold text-gray-800">{presentCount}</div>
                  <div className="text-xs text-gray-400 mt-1">посещений за месяц</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                  <div className="text-sm font-bold text-gray-800">{lastVisit ? fmtDate(lastVisit) : '—'}</div>
                  <div className="text-xs text-gray-400 mt-1">последнее посещение</div>
                </div>
              </div>

              {/* Аттестации */}
              {certs.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Аттестации и пояса</div>
                  <div className="space-y-2">
                    {certs.map(c => (
                      <div key={c.id} className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium text-gray-500 mr-2">{c.type}</span>
                          <span className="text-sm text-gray-800">{c.title}</span>
                        </div>
                        {c.date && <span className="text-xs text-gray-400">{new Date(c.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ближайшее занятие */}
              {nextLesson && (
                <div className="bg-black text-white rounded-2xl p-4">
                  <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Ближайшее занятие</div>
                  <div className="text-xl font-bold">{nextLesson.time}</div>
                  <div className="text-sm text-white/80 mt-0.5">
                    {nextLesson.isToday ? 'Сегодня' : nextLesson.isTomorrow ? 'Завтра' : DAYS_FULL[nextLesson.day]}, {new Date(nextLesson.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                  </div>
                  {nextLesson.trainer && <div className="text-xs text-white/60 mt-1">Тренер: {nextLesson.trainer}</div>}
                </div>
              )}

              {/* Расписание на неделю */}
              {schedule.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Расписание группы</div>
                  <div className="space-y-2">
                    {schedule.map((slot, i) => {
                      const slotDate = (() => {
                        const now = new Date()
                        const jsDay = now.getDay() === 0 ? 7 : now.getDay()
                        const diff = slot.day_of_week - jsDay
                        const d = new Date(now); d.setDate(now.getDate() + (diff < 0 ? diff + 7 : diff))
                        return localDateStr(d)
                      })()
                      const override = scheduleOverrides.find(o => o.date === slotDate)
                      const isCancelled = override?.cancelled
                      const trainerName = override?.trainer_name ?? slot.trainer_name
                      return (
                        <div key={i} className={`flex items-center justify-between text-sm ${isCancelled ? 'opacity-40 line-through' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span className="w-6 text-xs font-medium text-gray-500">{DAYS[slot.day_of_week]}</span>
                            <span className="font-medium text-gray-800">{slot.time_start}</span>
                            {isCancelled && <span className="text-xs text-red-500 no-underline" style={{textDecoration:'none'}}>отменено</span>}
                          </div>
                          {trainerName && <span className="text-xs text-gray-400">{trainerName}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── ПОСЕЩЕНИЯ ── */}
          {tab === 'attendance' && (
            <>
              {/* История посещений со скроллом */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">История посещений</div>
                {(() => {
                  const bonusRows: { date: string; label: string; kind: 'bonus' }[] = []
                  if (activeSub?.bonuses && activeSub?.bonuses_used) {
                    for (const key of Object.keys(activeSub.bonuses)) {
                      const val = activeSub.bonuses_used[key]
                      const dates: string[] = Array.isArray(val) ? val : Array.from({ length: (val as number) || 0 }, () => '')
                      for (const d of dates) {
                        if (d) bonusRows.push({ date: d, label: key, kind: 'bonus' })
                      }
                    }
                  }
                  type Row =
                    | { kind: 'att'; date: string; a: Attendance }
                    | { kind: 'bonus'; date: string; label: string }
                    | { kind: 'event'; date: string; label: string }
                  const rows: Row[] = [
                    ...attendance.map(a => ({ kind: 'att' as const, date: a.date, a })),
                    ...bonusRows.map(b => ({ kind: 'bonus' as const, date: b.date, label: b.label })),
                    ...eventVisits.map(ev => ({ kind: 'event' as const, date: ev.date, label: ev.title })),
                  ].sort((a, b) => b.date.localeCompare(a.date))

                  if (rows.length === 0) return <div className="text-sm text-gray-400 text-center py-4">Нет данных</div>

                  const ROW_H = 36 // px на строку
                  const VISIBLE = 12
                  const needScroll = rows.length > VISIBLE

                  return (
                    <>
                      <div
                        className={needScroll ? 'overflow-y-auto pr-1' : ''}
                        style={needScroll ? { maxHeight: `${VISIBLE * ROW_H}px` } : {}}
                      >
                        <div className="space-y-1">
                          {rows.map((row, i) => {
                            if (row.kind === 'bonus') return (
                              <div key={`b-${i}`} className="flex items-center justify-between text-sm py-0.5">
                                <span className="text-gray-500">{fmtDate(row.date)}</span>
                                <span className="text-purple-600 font-medium">🎁 {row.label}</span>
                              </div>
                            )
                            if (row.kind === 'event') return (
                              <div key={`e-${i}`} className="flex items-center justify-between text-sm py-0.5">
                                <span className="text-gray-500">{fmtDate(row.date)}</span>
                                <span className="text-blue-600 font-medium">🏟 {row.label}</span>
                              </div>
                            )
                            const a = row.a
                            return (
                              <div key={a.id} className="flex items-center justify-between text-sm py-0.5">
                                <span className="text-gray-500">{fmtDate(a.date)}</span>
                                <span className={a.present ? 'text-green-600 font-medium' : 'text-gray-300'}>
                                  {a.present ? '✓ был' : '— не был'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      {needScroll && (
                        <div className="text-xs text-gray-400 text-center mt-2 pt-2 border-t border-gray-50">
                          Всего записей: {rows.length} · прокрутите вверх для более ранних
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Активность — семинары и мероприятия */}
              {(seminarHistory.length > 0 || eventVisits.length > 0) && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-gray-800">🏆 Активность</h2>
                    <span className="text-xs text-gray-400">{seminarHistory.length + eventVisits.length} событий</span>
                  </div>

                  {seminarHistory.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Семинары</div>
                      <div className="space-y-2">
                        {seminarHistory.map(s => (
                          <div key={s.id} className="flex items-center gap-3 py-1.5">
                            <span className="text-lg">🥋</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800 truncate">{s.title}</div>
                              <div className="text-xs text-gray-400">
                                {new Date(s.starts_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {eventVisits.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Мероприятия</div>
                      <div className="space-y-2">
                        {eventVisits.map((ev, i) => {
                          const icon = ev.bonus_type === 'тренировка с оружием' ? '⚔️'
                            : ev.bonus_type === 'мастер-класс' ? '🎓'
                            : ev.bonus_type === 'индивидуальное занятие' ? '👤'
                            : '📅'
                          return (
                            <div key={i} className="flex items-center gap-3 py-1.5">
                              <span className="text-lg">{icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800 truncate">{ev.title}</div>
                                <div className="text-xs text-gray-400">
                                  {new Date(ev.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  {ev.bonus_type && <span className="ml-1">· {ev.bonus_type}</span>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
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
                  {latestSurvey && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                        <div className="text-center">
                          <div className="text-xl font-bold leading-none">{calcScore(latestSurvey)}</div>
                          <div className="text-xs">балл</div>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">Общий прогресс</div>
                        {surveys.length > 1 && firstSurvey && (
                          <div className="text-sm mt-0.5 font-medium text-green-600">
                            ↑ +{calcScore(latestSurvey) - calcScore(firstSurvey)} с начала
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">
                          {surveys.length} {surveys.length === 1 ? 'срез' : surveys.length < 5 ? 'среза' : 'срезов'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Пояснение */}
                  <div className="bg-blue-50 rounded-2xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
                    📋 Оценки выставляет тренер по наблюдениям на тренировках. Шкала от 1 до 10.
                    Срезы проводятся раз в 3 месяца — так видна динамика развития ребёнка.
                  </div>

                  {/* Радарная диаграмма */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h2 className="font-semibold text-gray-800 mb-3">Профиль качеств</h2>
                    <ParentRadarChart surveys={surveys} />
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

                  {/* Динамика по качествам */}
                  {surveys.length >= 2 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <h2 className="font-semibold text-gray-800 mb-1">Динамика по качествам</h2>
                      <p className="text-xs text-gray-400 mb-4">Оценки тренера: начало → сейчас</p>
                      <div className="space-y-2.5">
                        {QUALITIES.map(k => {
                          const first = firstSurvey?.[`trainer_${k}`] as number | null
                          const last = latestSurvey?.[`trainer_${k}`] as number | null
                          if (first == null && last == null) return null
                          const diff = first != null && last != null ? last - first : null
                          return (
                            <div key={k} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-28 shrink-0">{QUALITY_LABELS[k]}</span>
                              <div className="flex-1 flex items-center gap-1">
                                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                  <div className="h-full rounded-full bg-blue-400" style={{ width: `${(last ?? 0) * 10}%` }} />
                                </div>
                              </div>
                              <span className="text-xs text-gray-500 w-12 text-right shrink-0">
                                {first ?? '—'} → {last ?? '—'}
                              </span>
                              {diff != null && diff !== 0 && (
                                <span className={`text-xs font-bold w-6 shrink-0 ${diff > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                  {diff > 0 ? `+${diff}` : diff}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* История срезов */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h2 className="font-semibold text-gray-800 mb-3">История срезов</h2>
                    <div className="space-y-2">
                      {surveys.slice().reverse().map((s, i) => (
                        <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <div className="text-sm text-gray-700">{s.title || `Срез ${surveys.length - i}`}</div>
                            <div className="text-xs text-gray-400 mt-0.5">балл: {calcScore(s)}</div>
                          </div>
                          <span className="text-xs text-gray-400">
                            {s.filled_at ? new Date(s.filled_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── ЗАДАНИЯ ── */}
          {tab === 'tasks' && (
            <div className="space-y-3">
              {assignments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                  <div className="text-4xl mb-3">🥋</div>
                  <div className="font-medium text-gray-700">Заданий пока нет</div>
                  <div className="text-sm text-gray-400 mt-1">
                    После первого среза тренер назначит домашние задания
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 rounded-2xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
                    🥋 Задания составлены тренером на основе анализа прогресса. Помогите ребёнку выполнять их дома.
                  </div>
                  <div className="space-y-2">
                    {assignments.map(a => (
                      <div key={a.id}
                        className={`bg-white rounded-2xl border shadow-sm p-4 ${
                          a.completed ? 'border-green-100 opacity-70' : 'border-amber-100'
                        }`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                            a.completed ? 'bg-green-500 border-green-500 text-white' : 'border-amber-300'
                          }`}>
                            {a.completed && <span className="text-xs font-bold">✓</span>}
                          </div>
                          <div className="flex-1">
                            <div className={`font-medium text-sm ${a.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                              {a.title}
                            </div>
                            {a.description && (
                              <div className="text-sm text-gray-500 mt-1 leading-relaxed">{a.description}</div>
                            )}
                            {a.due_date && !a.completed && (
                              <div className={`text-xs mt-1.5 ${
                                new Date(a.due_date) < new Date() ? 'text-red-500' : 'text-gray-400'
                              }`}>
                                до {new Date(a.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── АТТЕСТАЦИЯ ── */}
          {tab === 'attestation' && (
            <div className="space-y-3">

              {/* ── БЛИЖАЙШИЕ СОБЫТИЯ ── */}
              {(openSeminars.length > 0 || openEvents.length > 0 || upcomingRegEvents.length > 0) && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h2 className="font-semibold text-gray-800 mb-3">📌 Ближайшие события</h2>
                  <div className="space-y-3">
                    {/* Семинары */}
                    {openSeminars.map(sem => {
                      const myReg = myRegistrations.find(r => r.seminar_id === sem.id)
                      return (
                        <div key={sem.id} className="pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800">🥋 {sem.title}</div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                📅 {sem.starts_at}{sem.ends_at !== sem.starts_at ? ` — ${sem.ends_at}` : ''}
                              </div>
                            </div>
                            {myReg ? (
                              <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${myReg.status === 'fully_paid' ? 'bg-green-100 text-green-700' : myReg.status === 'deposit_paid' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {myReg.status === 'fully_paid' ? 'Оплачен' : myReg.status === 'deposit_paid' ? 'Предоплата' : 'Заявка'}
                              </span>
                            ) : (
                              <a href={`/seminars/${sem.id}/register`} target="_blank" rel="noreferrer"
                                className="shrink-0 text-xs bg-black text-white px-3 py-1.5 rounded-lg font-medium">
                                Записаться
                              </a>
                            )}
                          </div>
                          {myReg && myReg.seminar_tariffs && (
                            <div className="text-xs text-gray-500 mt-1 ml-0">
                              {(myReg.seminar_tariffs as any).name}{myReg.locked_price ? ` · ${myReg.locked_price.toLocaleString('ru')} ₽` : ''}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {/* Аттестации */}
                    {openEvents.map(ev => (
                      <div key={ev.id} className="pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                        <div className="text-sm font-medium text-gray-800">📋 {ev.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">📅 {ev.event_date}</div>
                        <div className="text-xs text-indigo-600 mt-1 font-medium">Аттестация · заявку принимает тренер</div>
                      </div>
                    ))}
                    {/* Мероприятия */}
                    {upcomingRegEvents.map(ev => {
                      const icon = ev.bonus_type === 'тренировка с оружием' ? '⚔️'
                        : ev.bonus_type === 'мастер-класс' ? '🎓'
                        : ev.bonus_type === 'индивидуальное занятие' ? '👤'
                        : '📅'
                      return (
                        <div key={ev.id} className="pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800">{icon} {ev.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                📅 {new Date(ev.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                                {ev.time_start && <span className="ml-1">· {ev.time_start.slice(0, 5)}</span>}
                              </div>
                            </div>
                            <a href={`/events/${ev.id}/register`} target="_blank" rel="noreferrer"
                              className="shrink-0 text-xs bg-black text-white px-3 py-1.5 rounded-lg font-medium">
                              Записаться
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── ФОРМА ЗАЯВКИ НА АТТЕСТАЦИЮ ── */}
              {openEvents.length > 0 && !attestationApps.some(a => a.status !== 'rejected') && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  {!showAppForm ? (
                    <div className="text-center">
                      <div className="text-2xl mb-2">🥋</div>
                      <div className="text-sm font-medium text-gray-800 mb-1">Открыт приём заявок</div>
                      <div className="text-xs text-gray-500 mb-3">{openEvents[0].title}</div>
                      <button onClick={() => setShowAppForm(true)}
                        className="bg-black text-white text-sm font-medium px-6 py-2.5 rounded-xl w-full">
                        Подать заявку
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="font-semibold text-gray-800 text-sm">Заявка на аттестацию</div>
                      {openEvents.length > 1 && (
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Мероприятие</label>
                          <select value={appForm.event_id} onChange={e => setAppForm(p => ({ ...p, event_id: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                            {openEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                          </select>
                        </div>
                      )}
                      {openEvents.find(ev => ev.id === appForm.event_id)?.discipline === 'both' && (
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Дисциплина</label>
                          <select value={appForm.discipline} onChange={e => {
                            const d = e.target.value as 'aikido' | 'wushu'
                            const grades = d === 'aikido' ? AIKIDO_GRADES : WUSHU_GRADES
                            setAppForm(p => ({ ...p, discipline: d, current_grade: '', target_grade: grades[0] || '' }))
                          }} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                            <option value="aikido">Айкидо</option>
                            <option value="wushu">Ушу</option>
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Текущий уровень</label>
                        <select value={appForm.current_grade} onChange={e => setAppForm(p => ({ ...p, current_grade: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                          <option value="">— нет / начинающий —</option>
                          {(appForm.discipline === 'aikido' ? AIKIDO_GRADES : WUSHU_GRADES).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Сдаю на</label>
                        <select value={appForm.target_grade} onChange={e => setAppForm(p => ({ ...p, target_grade: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                          <option value="">— выберите —</option>
                          {(appForm.discipline === 'aikido' ? AIKIDO_GRADES : WUSHU_GRADES).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Дата последней аттестации</label>
                        <input type="date" value={appForm.last_attestation_date}
                          onChange={e => setAppForm(p => ({ ...p, last_attestation_date: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                      </div>
                      {/* Предупреждение нормативов */}
                      {appForm.target_grade && appForm.last_attestation_date && (() => {
                        const req = (appForm.discipline === 'aikido' ? AIKIDO_REQ : WUSHU_REQ).find(r => r.grade === appForm.target_grade)
                        if (!req) return null
                        const months = monthsBetween(appForm.last_attestation_date, new Date().toISOString().split('T')[0])
                        if (months >= req.minMonthsSinceLast) return null
                        return (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                            ⚠️ Требуется минимум {req.minMonthsSinceLast} мес. с последней аттестации — у вас {months}. Заявка будет на рассмотрении тренера.
                          </div>
                        )
                      })()}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setShowAppForm(false)}
                          className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl">
                          Отмена
                        </button>
                        <button onClick={submitApplication}
                          disabled={appSubmitting || !appForm.target_grade}
                          className="flex-1 bg-black text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-60">
                          {appSubmitting ? 'Отправка...' : 'Подать заявку'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ИСТОРИЯ АТТЕСТАЦИЙ ── */}
              {attestationApps.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h2 className="font-semibold text-gray-800 mb-3">🥋 Аттестации</h2>
                  <div className="space-y-3">
                  {attestationApps.map(app => {
                const discLabel = app.discipline === 'aikido' ? 'Айкидо' : 'Ушу'
                const evTitle = (app.attestation_events as any)?.title || ''
                const evDate = (app.attestation_events as any)?.event_date || ''

                // Определяем текущий этап
                const step = app.result ? 'done'
                  : app.preatt2_status ? 'preatt2'
                  : app.preatt1_status ? 'preatt1'
                  : 'pending'

                const PREATT_LABEL: Record<string, { text: string; color: string }> = {
                  approved:    { text: 'Допущен',          color: 'text-green-600' },
                  conditional: { text: 'Условно допущен',  color: 'text-amber-600' },
                  rejected:    { text: 'Не допущен',       color: 'text-red-500' },
                }
                const RESULT_LABEL: Record<string, { text: string; color: string; emoji: string }> = {
                  passed:         { text: 'Аттестация пройдена!',          color: 'text-green-700', emoji: '🎉' },
                  passed_remarks: { text: 'Пройдена с замечаниями',        color: 'text-amber-700', emoji: '✅' },
                  failed:         { text: 'Аттестация не пройдена',        color: 'text-red-600',   emoji: '😔' },
                }

                return (
                  <div key={app.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Шапка */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900">{discLabel} · {app.current_grade} → {app.target_grade}</div>
                          {evTitle && <div className="text-xs text-gray-400 mt-0.5">{evTitle}{evDate ? ` · ${evDate}` : ''}</div>}
                        </div>
                        {app.result ? (
                          <span className={`text-xs font-medium ${RESULT_LABEL[app.result]?.color}`}>
                            {RESULT_LABEL[app.result]?.emoji}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
                            {step === 'pending' ? 'Заявка подана' : step === 'preatt1' ? 'Предатт. 1' : 'Предатт. 2'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-4 py-3 space-y-3">
                      {/* Предаттестация 1 */}
                      {app.preatt1_status && (
                        <div>
                          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Предаттестация 1</div>
                          <div className={`text-sm font-medium ${PREATT_LABEL[app.preatt1_status]?.color}`}>
                            {PREATT_LABEL[app.preatt1_status]?.text}
                          </div>
                          {app.preatt1_notes && (
                            <div className="text-sm text-gray-600 mt-1 bg-gray-50 rounded-xl px-3 py-2">{app.preatt1_notes}</div>
                          )}
                        </div>
                      )}

                      {/* Предаттестация 2 */}
                      {app.preatt2_status && (
                        <div>
                          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Предаттестация 2</div>
                          <div className={`text-sm font-medium ${PREATT_LABEL[app.preatt2_status]?.color}`}>
                            {PREATT_LABEL[app.preatt2_status]?.text}
                          </div>
                          {app.preatt2_notes && (
                            <div className="text-sm text-gray-600 mt-1 bg-gray-50 rounded-xl px-3 py-2">{app.preatt2_notes}</div>
                          )}
                        </div>
                      )}

                      {/* Оплата */}
                      {!app.result && (
                        <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${app.paid ? 'bg-green-50' : 'bg-amber-50'}`}>
                          <span className="text-sm text-gray-700">Оплата {app.price ? `${app.price} ₽` : ''}</span>
                          <span className={`text-sm font-medium ${app.paid ? 'text-green-600' : 'text-amber-600'}`}>
                            {app.paid ? '✓ Оплачено' : '⏳ Ожидает'}
                          </span>
                        </div>
                      )}

                      {/* Результат */}
                      {app.result && (
                        <div className={`rounded-xl px-3 py-3 ${app.result === 'passed' ? 'bg-green-50' : app.result === 'failed' ? 'bg-red-50' : 'bg-amber-50'}`}>
                          <div className={`font-semibold text-sm ${RESULT_LABEL[app.result]?.color}`}>
                            {RESULT_LABEL[app.result]?.emoji} {RESULT_LABEL[app.result]?.text}
                          </div>
                          {app.result_grade && (
                            <div className="text-sm text-gray-700 mt-1">Присвоено: <strong>{app.result_grade}</strong></div>
                          )}
                          {app.sensei_notes && (
                            <div className="text-sm text-gray-600 mt-2 italic">«{app.sensei_notes}»</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
                  </div>
                </div>
              )}

              {/* ── ДОСТИЖЕНИЯ ── */}
              {certs.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h2 className="font-semibold text-gray-800 mb-3">🏆 Достижения</h2>
                  <div className="space-y-2">
                    {certs.map(c => (
                      <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-xl">{c.type === 'belt' ? '🥋' : c.type === 'competition' ? '🏆' : c.type === 'seminar' ? '📚' : c.type === 'masterclass' ? '🎯' : '⭐'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800">{c.title}</div>
                        </div>
                        {c.date && (
                          <div className="text-xs text-gray-400 shrink-0">
                            {new Date(c.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Пусто */}
              {openSeminars.length === 0 && openEvents.length === 0 && upcomingRegEvents.length === 0 && attestationApps.length === 0 && certs.length === 0 && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
                  <div className="text-4xl mb-2">🎉</div>
                  <div className="text-gray-500 text-sm">Мероприятий пока нет</div>
                  <div className="text-gray-400 text-xs mt-1">Здесь появятся семинары, аттестации и другие события</div>
                </div>
              )}
            </div>
          )}

          {/* ── ТРЕНЕР ── */}
          {tab === 'tickets' && (
            <div className="space-y-3">
              {/* Контакты тренеров */}
              {trainers.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Ваши тренеры</div>
                  {trainers.map(tr => (
                    <div key={tr.name} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold shrink-0">
                        {tr.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 text-sm">{tr.name}</div>
                        <div className="flex gap-2 mt-1">
                          {tr.phone && (
                            <a href={`tel:${tr.phone}`} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg font-medium">
                              📞 Позвонить
                            </a>
                          )}
                          {tr.telegram_username && (
                            <a href={`https://t.me/${tr.telegram_username}`} target="_blank" rel="noreferrer"
                              className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-medium">
                              ✈ Telegram
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Форма создания */}
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

              {/* История обращений */}
              {tickets.length === 0 && !showTicketForm ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                  <div className="text-3xl mb-2">📬</div>
                  <div className="text-sm text-gray-500">Обращений пока нет</div>
                  <div className="text-xs text-gray-400 mt-1">Здесь появятся ваши вопросы и сообщения тренеру</div>
                </div>
              ) : tickets.length > 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                  {tickets.map(t => (
                    <div key={t.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-800">
                          {TICKET_TYPE_LABELS[t.type] ?? t.type}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.status === 'pending' && (
                            <span className="text-orange-500 text-base leading-none" title="Ожидает ответа">!</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TICKET_STATUS_COLORS[t.status]}`}>
                            {TICKET_STATUS_LABELS[t.status] ?? t.status}
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

          <div className="text-center text-xs text-gray-300 pb-2">Школа Самурая</div>
        </div>
      </div>
    </main>
  )
}
