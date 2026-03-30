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
type Attendance = { id: string; date: string; present: boolean }
type Survey = { id: string; survey_number: number; title: string | null; filled_at: string | null; created_at: string } & Record<string, number | null>
type Ticket = { id: string; type: string; description: string | null; status: string; resolution_note: string | null; created_at: string }
type Cert = { id: string; type: string; title: string; date: string | null }

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
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [tab, setTab] = useState<'sub' | 'attendance' | 'progress' | 'tickets'>('sub')
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

      const [{ data: subs }, { data: att }, { data: sv }, { data: tk }, { data: certsData }, { data: sched }, { data: ovs }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('student_id', s.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('attendance').select('*').eq('student_id', s.id).order('date', { ascending: false }).limit(90),
        supabase.from('progress_surveys').select('*').eq('student_id', s.id).not('filled_at', 'is', null).order('created_at'),
        supabase.from('tickets').select('id, type, description, status, resolution_note, created_at').eq('student_id', s.id).order('created_at', { ascending: false }),
        supabase.from('certifications').select('id, type, title, date').eq('student_id', s.id).order('date', { ascending: false }),
        s.group_name
          ? supabase.from('schedule').select('day_of_week, time_start, trainer_name').eq('group_name', s.group_name).order('day_of_week').order('time_start')
          : Promise.resolve({ data: [] }),
        s.group_name
          ? supabase.from('schedule_overrides').select('date, trainer_name, cancelled').eq('group_name', s.group_name).gte('date', mondayStr).lte('date', sundayStr)
          : Promise.resolve({ data: [] }),
      ])
      const foundSub = subs?.find((s: Subscription) => !s.is_pending) || null
      if (subs && subs.length > 0) setActiveSub(foundSub)
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
        <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
          {([
            { key: 'sub', label: 'Абонемент' },
            { key: 'attendance', label: 'Посещения' },
            { key: 'progress', label: '📈 Прогресс', badge: surveys.length > 0 ? surveys.length : null },
            { key: 'tickets', label: '📞 Тренер', badge: tickets.filter(t => t.status === 'pending').length || null },
          ] as { key: typeof tab; label: string; badge?: number | null }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors relative ${
                tab === t.key ? 'border-black text-black' : 'border-transparent text-gray-400'
              }`}>
              {t.label}
              {t.badge && tab !== t.key && (
                <span className="ml-1 bg-blue-500 text-white text-[9px] rounded-full px-1.5 py-0.5">{t.badge}</span>
              )}
            </button>
          ))}
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
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">История посещений</div>
              {attendance.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-4">Нет данных</div>
              ) : (
                <div className="space-y-2">
                  {attendance.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-sm py-0.5">
                      <span className="text-gray-500">{fmtDate(a.date)}</span>
                      <span className={a.present ? 'text-green-600 font-medium' : 'text-gray-300'}>
                        {a.present ? '✓ был' : '— не был'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
