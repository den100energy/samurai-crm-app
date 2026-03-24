'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FujiScene } from '@/components/FujiScene'

type Student = { id: string; name: string; group_name: string | null; birth_date: string | null }
type Subscription = { id: string; type: string; sessions_total: number | null; sessions_left: number | null; start_date: string | null; end_date: string | null }
type Attendance = { id: string; date: string; present: boolean }
type Survey = { id: string; survey_number: number; title: string | null; filled_at: string | null; created_at: string } & Record<string, number | null>
type Ticket = { id: string; type: string; description: string | null; status: string; created_at: string }

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

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase
        .from('students').select('id, name, group_name, birth_date')
        .eq('parent_token', token).eq('status', 'active').single()
      if (!s) { setNotFound(true); return }
      setStudent(s)
      const [{ data: subs }, { data: att }, { data: sv }, { data: tk }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('student_id', s.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('attendance').select('*').eq('student_id', s.id).order('date', { ascending: false }).limit(15),
        supabase.from('progress_surveys').select('*').eq('student_id', s.id).not('filled_at', 'is', null).order('created_at'),
        supabase.from('tickets').select('id, type, description, status, created_at').eq('student_id', s.id).order('created_at', { ascending: false }),
      ])
      if (subs && subs.length > 0) setActiveSub(subs[0])
      setAttendance(att || [])
      setSurveys(sv || [])
      setTickets(tk || [])
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

  const presentCount = attendance.filter(a => a.present).length
  const lastVisit = attendance.find(a => a.present)?.date
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
    }).select('id, type, description, status, created_at').single()
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
      <div className="max-w-sm mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden">
          <FujiScene dark={false} bgColor="#F9FAFB" />
          <div className="absolute inset-x-0 bottom-0 pb-4 flex flex-col items-center z-10">
            <div className="w-16 h-16 rounded-full bg-white/90 text-gray-800 flex items-center justify-center text-2xl font-bold shadow-lg border-2 border-white mb-2">
              {student.name[0]}
            </div>
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
            { key: 'tickets', label: '📝 Связь', badge: tickets.filter(t => t.status === 'pending').length || null },
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
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Текущий абонемент</div>
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
                    {activeSub.end_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Действует до</span>
                        <span className="text-sm font-medium text-gray-700">{activeSub.end_date}</span>
                      </div>
                    )}
                    {activeSub.sessions_left !== null && activeSub.sessions_left <= 2 && activeSub.sessions_left > 0 && (
                      <div className="mt-3 p-2 bg-orange-50 rounded-xl text-xs text-orange-600 text-center">
                        Скоро закончится — пора продлить абонемент
                      </div>
                    )}
                    {activeSub.sessions_left === 0 && (
                      <div className="mt-3 p-2 bg-red-50 rounded-xl text-xs text-red-600 text-center">
                        Занятия закончились — обратитесь к тренеру для продления
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 text-center py-2">Абонемент не найден</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                  <div className="text-2xl font-bold text-gray-800">{presentCount}</div>
                  <div className="text-xs text-gray-400 mt-1">посещений за месяц</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                  <div className="text-sm font-bold text-gray-800">{lastVisit || '—'}</div>
                  <div className="text-xs text-gray-400 mt-1">последнее посещение</div>
                </div>
              </div>
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
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{a.date}</span>
                      <span className={a.present ? 'text-green-600 font-medium' : 'text-gray-300'}>
                        {a.present ? '● Был' : '○ Не был'}
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

          {/* ── ОБРАЩЕНИЯ ── */}
          {tab === 'tickets' && (
            <div className="space-y-3">
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
