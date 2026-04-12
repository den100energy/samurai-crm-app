'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTheme } from '@/components/ThemeProvider'
import { hasAccess } from '@/lib/auth'
import { FujiScene } from '@/components/FujiScene'
import { localDateStr } from '@/lib/dates'
import { OnboardingHint } from '@/components/OnboardingHint'
import { resetAllHints } from '@/lib/onboarding'

type ScheduleSlot = {
  id: string
  day_of_week: number
  time_start: string
  group_name: string
  trainer_name: string | null
}

type Override = {
  date: string
  group_name: string
  trainer_name: string | null
  cancelled: boolean
}

const DAYS_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const TODAY_NUM = new Date().getDay() === 0 ? 7 : new Date().getDay()

function getWeekDates(): Record<number, string> {
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

function TrainerPageInner() {
  const { userName, role, trainerId, permissions, loading } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  // Основатель может просматривать кабинет любого тренера через ?as=ИмяТренера
  const viewAsName = role === 'founder' ? (searchParams.get('as') || null) : null
  const effectiveName = viewAsName ?? userName
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([])
  const [overrides, setOverrides] = useState<Override[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [trainerDbId, setTrainerDbId] = useState<string | null>(null)
  const [trainerPhone, setTrainerPhone] = useState('')
  const [trainerTg, setTrainerTg] = useState('')
  const [trainerVk, setTrainerVk] = useState('')
  const [trainerPhoto, setTrainerPhoto] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [needSurveyStudents, setNeedSurveyStudents] = useState<{ id: string; name: string }[]>([])
  const [showSurveyList, setShowSurveyList] = useState(false)
  const [missingDays, setMissingDays] = useState<{ date: string; group_name: string }[]>([])
  const [trainerTgLinked, setTrainerTgLinked] = useState(false)
  const [tgLinkUrl, setTgLinkUrl] = useState<string | null>(null)
  const [tgLinkLoading, setTgLinkLoading] = useState(false)
  const [weekEvents, setWeekEvents] = useState<{ id: string; name: string; date: string; time_start: string | null; bonus_type: string | null; trainer_name: string | null }[]>([])
  const [weekSeminars, setWeekSeminars] = useState<{ id: string; title: string; starts_at: string; location: string | null; trainer_name: string | null }[]>([])

  const dark = theme === 'dark'

  useEffect(() => {
    if (!loading && role !== 'trainer' && role !== 'founder') {
      router.replace('/')
      return
    }
    if (!loading && effectiveName) loadData()
  }, [loading, role, effectiveName])

  async function loadData() {
    const weekDates = getWeekDates()
    const monday = weekDates[1]
    const sunday = weekDates[7]

    const [{ data: slots }, { data: students }, { data: ovData }, { data: trainerRow }, { data: eventsData }, { data: seminarsData }] = await Promise.all([
      supabase.from('schedule').select('*').eq('trainer_name', effectiveName).order('day_of_week').order('time_start'),
      supabase.from('students').select('id, group_name').eq('status', 'active'),
      supabase.from('schedule_overrides').select('date, group_name, trainer_name, cancelled')
        .gte('date', monday).lte('date', sunday),
      supabase.from('trainers').select('id, phone, telegram_username, vk_url, photo_url, telegram_chat_id').eq('name', effectiveName).maybeSingle(),
      supabase.from('events').select('id, name, date, time_start, bonus_type, trainer_name').gte('date', monday).lte('date', sunday).order('date').order('time_start'),
      supabase.from('seminar_events').select('id, title, starts_at, location, trainer_name').eq('status', 'open').gte('starts_at', monday + 'T00:00:00').lte('starts_at', sunday + 'T23:59:59').order('starts_at'),
    ])
    setSchedule(slots || [])
    setOverrides(ovData || [])
    if (trainerRow) {
      setTrainerDbId(trainerRow.id)
      setTrainerPhone(trainerRow.phone || '')
      setTrainerTg(trainerRow.telegram_username || '')
      setTrainerVk(trainerRow.vk_url || '')
      setTrainerPhoto(trainerRow.photo_url || null)
      setTrainerTgLinked(!!trainerRow.telegram_chat_id)
    }
    setWeekEvents(eventsData || [])
    setWeekSeminars(seminarsData || [])

    const trainerGroups = [...new Set((slots || []).map(s => s.group_name))]
    const myStudents = (students || []).filter(s => s.group_name && trainerGroups.includes(s.group_name))
    setStudentCount(myStudents.length)

    // Срезы — ученики которым пора (3+ мес. с последнего)
    if (myStudents.length > 0) {
      const myIds = myStudents.map(s => s.id)
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      const { data: latestSurveys } = await supabase
        .from('progress_surveys')
        .select('student_id, filled_at, created_at')
        .in('student_id', myIds)
        .order('created_at', { ascending: false })

      const latestMap = new Map<string, { filled_at: string | null; created_at: string }>()
      for (const s of (latestSurveys || [])) {
        if (!latestMap.has(s.student_id)) latestMap.set(s.student_id, s)
      }
      const needSurvey = myStudents.filter(st => {
        const latest = latestMap.get(st.id)
        if (!latest) return true // никогда не было среза
        if (!latest.filled_at) return false // есть незаполненный — не беспокоим
        return new Date(latest.filled_at) < threeMonthsAgo
      })
      const { data: studentNames } = await supabase
        .from('students').select('id, name').in('id', needSurvey.map(s => s.id))
      setNeedSurveyStudents(studentNames || [])
    }

    // Пропущенные тренировки за 14 дней (только у этого тренера)
    if (slots && slots.length > 0) {
      const today = localDateStr(new Date())
      const days: string[] = []
      for (let i = 1; i <= 14; i++) {
        const d = new Date(); d.setDate(d.getDate() - i)
        days.push(localDateStr(d))
      }
      const periodStart = days[days.length - 1]

      const { data: allOverrides } = await supabase
        .from('schedule_overrides').select('date, group_name, cancelled')
        .gte('date', periodStart).lte('date', today)

      const cancelledSet = new Set<string>()
      for (const ov of allOverrides || []) {
        if (ov.cancelled) cancelledSet.add(`${ov.date}|${ov.group_name}`)
      }

      const expected: { date: string; group_name: string }[] = []
      for (const dayStr of days) {
        const jsDay = new Date(dayStr + 'T00:00:00').getDay()
        const dow = jsDay === 0 ? 7 : jsDay
        for (const s of slots) {
          if (s.day_of_week === dow && !cancelledSet.has(`${dayStr}|${s.group_name}`)) {
            expected.push({ date: dayStr, group_name: s.group_name })
          }
        }
      }

      if (expected.length > 0) {
        const dateSet = [...new Set(expected.map(e => e.date))]
        const groupSet = [...new Set(expected.map(e => e.group_name))]
        const { data: attData } = await supabase
          .from('attendance').select('date, group_name')
          .in('date', dateSet).in('group_name', groupSet)

        const markedSet = new Set<string>((attData || []).map(a => `${a.date}|${a.group_name}`))
        const missing = expected
          .filter(e => !markedSet.has(`${e.date}|${e.group_name}`))
          .sort((a, b) => b.date.localeCompare(a.date))
        setMissingDays(missing)
      }
    }
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !trainerDbId) return
    setUploadingPhoto(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('trainer_id', trainerDbId)
    const res = await fetch('/api/upload-trainer-photo', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) setTrainerPhoto(data.url)
    setUploadingPhoto(false)
    e.target.value = ''
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function saveProfile() {
    if (!effectiveName) return
    setSavingProfile(true)
    await supabase.from('trainers')
      .update({ phone: trainerPhone || null, telegram_username: trainerTg || null, vk_url: trainerVk || null })
      .eq('name', effectiveName)
    setSavingProfile(false)
    setProfileSaved(true)
    setShowProfile(false)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  async function generateTgLink() {
    setTgLinkLoading(true)
    setTgLinkUrl(null)
    const res = await fetch('/api/trainer/telegram-link', { method: 'POST' })
    const data = await res.json()
    if (data.link) setTgLinkUrl(data.link)
    setTgLinkLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>

  const weekDates = getWeekDates()
  const myGroups = [...new Set(schedule.map(s => s.group_name))]

  const upcomingSlots = [TODAY_NUM, ...Array.from({ length: 7 - TODAY_NUM }, (_, i) => TODAY_NUM + i + 1)]
    .flatMap(dayNum => schedule
      .filter(s => s.day_of_week === dayNum)
      .map(s => {
        const dateStr = weekDates[dayNum]
        const override = overrides.find(o => o.date === dateStr && o.group_name === s.group_name)
        if (override?.cancelled) return null
        if (override?.trainer_name && override.trainer_name !== effectiveName) return null
        return { ...s, dateStr, dayNum, override }
      })
      .filter(Boolean)
    ) as (ScheduleSlot & { dateStr: string; dayNum: number; override: Override | undefined })[]

  // Единая лента недели: тренировки + мероприятия + семинары по дням
  type WeekItem = { type: 'training' | 'event' | 'seminar'; dateStr: string; dayNum: number; time: string | null; title: string; subtitle: string | null; href: string; isMine: boolean }
  const allWeekItems: WeekItem[] = []

  // Тренировки из расписания
  for (const slot of upcomingSlots) {
    allWeekItems.push({
      type: 'training', dateStr: slot.dateStr, dayNum: slot.dayNum,
      time: slot.time_start?.slice(0, 5) || null,
      title: slot.group_name, subtitle: null,
      href: `/trainer/attendance?date=${slot.dateStr}&group=${encodeURIComponent(slot.group_name)}`,
      isMine: true,
    })
  }
  // Мероприятия
  for (const ev of weekEvents) {
    const d = new Date(ev.date + 'T00:00:00'); const jsDay = d.getDay(); const dayNum = jsDay === 0 ? 7 : jsDay
    allWeekItems.push({
      type: 'event', dateStr: ev.date, dayNum,
      time: ev.time_start ? ev.time_start.slice(0, 5) : null,
      title: ev.name, subtitle: ev.bonus_type || null,
      href: `/events/${ev.id}`,
      isMine: ev.trainer_name === effectiveName,
    })
  }
  // Семинары
  for (const sem of weekSeminars) {
    const d = new Date(sem.starts_at); const jsDay = d.getDay(); const dayNum = jsDay === 0 ? 7 : jsDay
    const dateStr = sem.starts_at.slice(0, 10)
    const time = sem.starts_at.slice(11, 16)
    allWeekItems.push({
      type: 'seminar', dateStr, dayNum,
      time: time || null,
      title: sem.title, subtitle: sem.location || null,
      href: `/seminars/${sem.id}`,
      isMine: sem.trainer_name === effectiveName,
    })
  }

  // Группируем по дате
  const itemsByDay = new Map<string, WeekItem[]>()
  for (let i = 1; i <= 7; i++) {
    const dateStr = weekDates[i]
    if (dateStr) itemsByDay.set(dateStr, [])
  }
  for (const item of allWeekItems) {
    if (itemsByDay.has(item.dateStr)) itemsByDay.get(item.dateStr)!.push(item)
  }
  for (const items of itemsByDay.values()) {
    items.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'))
  }
  const weekDaysWithItems = [...itemsByDay.entries()]
    .filter(([, items]) => items.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))

  // Sections available to this trainer based on permissions
  const navSections = [
    { key: 'students',     label: 'Ученики',       emoji: '🥋', href: '/trainer/students', sub: `${studentCount} чел.` },
    { key: 'leads',        label: 'Лиды',           emoji: '📋', href: '/leads',            sub: 'Заявки' },
    { key: 'finance',      label: 'Финансы',        emoji: '💰', href: '/finance',          sub: 'Платежи' },
    { key: 'installments', label: 'Рассрочки',      emoji: '🗓', href: '/installments',     sub: 'Рассрочки' },
    { key: 'salary',       label: 'Зарплата',       emoji: '💵', href: '/salary',           sub: 'Расчёты' },
    { key: 'events',       label: 'Мероприятия',    emoji: '🎉', href: '/events',           sub: 'Список' },
    { key: 'schedule',     label: 'Расписание',     emoji: '🗓', href: '/schedule',         sub: 'Просмотр' },
    { key: 'analytics',    label: 'Аналитика',      emoji: '📊', href: '/analytics',        sub: 'Статистика' },
    { key: 'broadcast',    label: 'Рассылка',       emoji: '📣', href: '/broadcast',        sub: 'Telegram' },
    { key: 'tickets',      label: 'Обращения',      emoji: '📝', href: '/tickets',          sub: 'Вопросы' },
    { key: 'attestations', label: 'Аттестации',     emoji: '🏅', href: '/attestations',     sub: 'Заявки' },
    { key: 'settings',     label: 'Настройки',      emoji: '⚙️', href: '/settings',         sub: 'Система' },
  ].filter(s => hasAccess(role!, permissions, s.key))

  const card = dark
    ? 'bg-[#2C2C2E] border-[#3A3A3C]'
    : 'bg-white border-gray-100 shadow-sm'

  const textPrimary = dark ? 'text-[#E5E5E7]' : 'text-gray-800'
  const textSecondary = dark ? 'text-[#8E8E93]' : 'text-gray-400'

  return (
    <main className="max-w-lg mx-auto" style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Баннер режима просмотра для основателя */}
      {viewAsName && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-700">
          <span>👁 Просмотр кабинета: <b>{viewAsName}</b></span>
          <Link href="/admin-users" className="underline text-indigo-500">← Сотрудники</Link>
        </div>
      )}

      {/* Hero: FujiScene + header overlay */}
      <div className="relative overflow-hidden">
        <FujiScene dark={dark} bgColor={dark ? '#1C1C1E' : '#F5F4F0'} />
        <div className="absolute inset-x-0 top-0 px-5 pt-8 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="relative cursor-pointer shrink-0">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30 bg-black/30 flex items-center justify-center text-xl font-bold text-white">
                  {trainerPhoto
                    ? <img src={trainerPhoto} alt={effectiveName || ''} className="w-full h-full object-cover" />
                    : <span>{(effectiveName || 'Т')[0]}</span>
                  }
                </div>
                {trainerDbId && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow">
                    <span className="text-[10px]">{uploadingPhoto ? '…' : '📷'}</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploadingPhoto} />
              </label>
              <div>
                <h1 className="text-white text-xl font-bold leading-tight drop-shadow-lg">
                  {effectiveName || 'Тренер'}
                </h1>
                <p className="text-white/60 text-xs mt-0.5">Кабинет тренера</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme}
                className="text-sm text-white/70 border border-white/20 bg-black/25 backdrop-blur-sm
                  px-2.5 py-1.5 rounded-lg hover:text-white transition-all duration-200">
                {dark ? '☀' : '🌙'}
              </button>
              <button
                onClick={() => { resetAllHints(); window.location.reload() }}
                title="Показать подсказки заново"
                className="text-sm text-white/70 border border-white/20 bg-black/25 backdrop-blur-sm
                  px-2.5 py-1.5 rounded-lg hover:border-amber-400/60 hover:text-amber-300
                  transition-all duration-200">
                💡
              </button>
              <button onClick={signOut}
                className="text-sm text-white/70 border border-white/20 bg-black/25 backdrop-blur-sm
                  px-3 py-1.5 rounded-lg hover:text-white transition-all duration-200">
                Выйти
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Переключатель в кабинет основателя — только для основателя-тренера */}
      {role === 'founder' && (
        <Link href="/"
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: dark ? '#3A3A3C' : '#E5E4E0', backgroundColor: dark ? '#2C2C2E' : '#F9F8F5' }}>
          <span className="text-sm" style={{ color: dark ? '#8E8E93' : '#6B7280' }}>←</span>
          <span className="text-sm font-medium" style={{ color: dark ? '#E5E5E7' : '#1C1C1E' }}>Кабинет основателя</span>
        </Link>
      )}

      <div className="p-4">

      <OnboardingHint id="trainer_cabinet" className="mb-4" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`rounded-2xl border p-4 text-center ${card}`}>
          <div className={`text-2xl font-bold ${textPrimary}`}>{studentCount}</div>
          <div className={`text-xs mt-0.5 ${textSecondary}`}>учеников</div>
        </div>
        <div className={`rounded-2xl border p-4 text-center ${card}`}>
          <div className={`text-2xl font-bold ${textPrimary}`}>{myGroups.length}</div>
          <div className={`text-xs mt-0.5 ${textSecondary}`}>групп</div>
        </div>
      </div>

      {/* Мой профиль */}
      <div className={`rounded-2xl border mb-4 overflow-hidden ${card}`}>
        <button onClick={() => setShowProfile(p => !p)}
          className="w-full flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">👤</span>
            <span className={`text-sm font-medium ${textPrimary}`}>Мои контакты</span>
            {(trainerPhone || trainerTg) && (
              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">✓</span>
            )}
            {profileSaved && (
              <span className="text-xs text-green-500 font-medium">Сохранено!</span>
            )}
          </div>
          <span className={`text-sm ${textSecondary}`}>{showProfile ? '▲' : '▼'}</span>
        </button>

        {showProfile && (
          <div className={`px-4 pb-4 space-y-3 border-t ${dark ? 'border-[#3A3A3C]' : 'border-gray-100'}`}>
            <p className={`text-xs pt-3 ${textSecondary}`}>
              Ученики увидят эти контакты в своём личном кабинете для связи с вами
            </p>
            <div>
              <label className={`text-xs font-medium ${textSecondary}`}>Телефон</label>
              <input
                value={trainerPhone}
                onChange={e => setTrainerPhone(e.target.value)}
                placeholder="+7 900 000 00 00"
                className={`mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none border ${
                  dark ? 'bg-[#1C1C1E] border-[#3A3A3C] text-[#E5E5E7]' : 'bg-white border-gray-200 text-gray-800'
                }`}
              />
            </div>
            <div>
              <label className={`text-xs font-medium ${textSecondary}`}>Telegram (без @)</label>
              <input
                value={trainerTg}
                onChange={e => setTrainerTg(e.target.value.replace('@', ''))}
                placeholder="username"
                className={`mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none border ${
                  dark ? 'bg-[#1C1C1E] border-[#3A3A3C] text-[#E5E5E7]' : 'bg-white border-gray-200 text-gray-800'
                }`}
              />
            </div>
            <div>
              <label className={`text-xs font-medium ${textSecondary}`}>ВКонтакте (ссылка)</label>
              <input
                value={trainerVk}
                onChange={e => setTrainerVk(e.target.value)}
                placeholder="https://vk.com/username"
                className={`mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none border ${
                  dark ? 'bg-[#1C1C1E] border-[#3A3A3C] text-[#E5E5E7]' : 'bg-white border-gray-200 text-gray-800'
                }`}
              />
            </div>
            <button onClick={saveProfile} disabled={savingProfile}
              className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {savingProfile ? 'Сохранение...' : 'Сохранить'}
            </button>

            {/* Привязка Telegram для уведомлений */}
            {!viewAsName && (
              <div className={`mt-3 pt-3 border-t ${dark ? 'border-[#3A3A3C]' : 'border-gray-100'}`}>
                <div className={`text-xs font-medium mb-2 ${textSecondary}`}>Уведомления в Telegram</div>
                {trainerTgLinked ? (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <span>✅ Telegram подключён</span>
                  </div>
                ) : (
                  <>
                    <p className={`text-xs mb-2 ${textSecondary}`}>
                      Подключите Telegram, чтобы получать уведомления о пропущенных отметках посещаемости.
                    </p>
                    {tgLinkUrl ? (
                      <a href={tgLinkUrl} target="_blank" rel="noopener noreferrer"
                        className="block w-full text-center bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium">
                        📲 Открыть бот и подключить
                      </a>
                    ) : (
                      <button onClick={generateTgLink} disabled={tgLinkLoading}
                        className={`w-full py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 ${
                          dark ? 'border-[#3A3A3C] text-[#E5E5E7] hover:bg-[#3A3A3C]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}>
                        {tgLinkLoading ? 'Генерация ссылки...' : '🔗 Подключить Telegram'}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Срезы прогресса — уведомление */}
      {needSurveyStudents.length > 0 && (
        <div className={`rounded-2xl border mb-4 overflow-hidden ${card}`}>
          <button onClick={() => setShowSurveyList(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <span className={`text-sm font-medium ${textPrimary}`}>Срезы прогресса</span>
              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-medium">
                {needSurveyStudents.length}
              </span>
            </div>
            <span className={`text-sm ${textSecondary}`}>{showSurveyList ? '▲' : '▼'}</span>
          </button>

          {showSurveyList && (
            <div className={`border-t ${dark ? 'border-[#3A3A3C]' : 'border-gray-100'}`}>
              <p className={`text-xs px-4 pt-3 pb-2 ${textSecondary}`}>
                Этим ученикам пора пройти повторный срез (3+ месяца с последнего)
              </p>
              <div className="px-4 pb-4 space-y-2">
                {needSurveyStudents.map(st => (
                  <Link key={st.id} href={`/students/${st.id}`}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${
                      dark ? 'bg-[#1C1C1E] border-[#3A3A3C]' : 'bg-gray-50 border-gray-100'
                    }`}>
                    <span className={`text-sm ${textPrimary}`}>{st.name}</span>
                    <span className={`text-xs ${textSecondary}`}>→</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attendance — always visible */}
      <Link href="/trainer/attendance"
        className="block rounded-2xl border p-4 mb-4 relative overflow-hidden"
        style={{ background: '#B22222', borderColor: '#8B0000' }}>
        <div className="relative z-10">
          <div className="text-2xl mb-1">✅</div>
          <div className="text-white font-semibold">Посещаемость</div>
          <div className="text-red-200 text-xs mt-0.5">Отметить сегодня</div>
        </div>
      </Link>

      {/* Пропущенные тренировки */}
      {missingDays.length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-orange-500 text-base shrink-0 mt-0.5">⚠️</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-orange-800 mb-1">
                Не отмечено {missingDays.length} {missingDays.length === 1 ? 'тренировка' : missingDays.length <= 4 ? 'тренировки' : 'тренировок'} за 14 дней
              </div>
              <div className="space-y-0.5">
                {missingDays.map(m => (
                  <Link
                    key={`${m.date}|${m.group_name}`}
                    href={`/trainer/attendance?date=${m.date}&group=${encodeURIComponent(m.group_name)}`}
                    className="block text-xs text-orange-700 hover:text-orange-900 hover:underline"
                  >
                    {new Date(m.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })} — {m.group_name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule warning */}
      {schedule.length === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 mb-4 text-xs text-amber-700">
          ⚠️ Расписание не настроено. Попросите администратора добавить ваши группы.
        </div>
      )}

      {/* Неделя: тренировки + мероприятия + семинары */}
      {weekDaysWithItems.length > 0 && (
        <div className={`rounded-2xl border p-4 mb-4 ${card}`}>
          <h2 className={`font-semibold mb-3 ${textPrimary}`}>Неделя</h2>
          <div className="space-y-4">
            {weekDaysWithItems.map(([dateStr, items]) => {
              const d = new Date(dateStr + 'T00:00:00')
              const jsDay = d.getDay(); const dayNum = jsDay === 0 ? 7 : jsDay
              const isToday = dayNum === TODAY_NUM
              const dayLabel = DAYS_SHORT[dayNum] + ' ' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
              return (
                <div key={dateStr}>
                  {/* Заголовок дня */}
                  <div className={`text-xs font-semibold mb-1.5 ${isToday ? 'text-indigo-500' : textSecondary}`}>
                    {dayLabel.toUpperCase()}{isToday ? ' — СЕГОДНЯ' : ''}
                  </div>
                  <div className="space-y-1.5">
                    {items.map((item, idx) => {
                      const icon = item.type === 'training' ? '🥋' : item.type === 'event' ? '📅' : '🎓'
                      const accentBorder = item.isMine
                        ? (item.type === 'training' ? (dark ? 'border-l-red-500' : 'border-l-red-400')
                          : item.type === 'event' ? (dark ? 'border-l-indigo-400' : 'border-l-indigo-400')
                          : (dark ? 'border-l-emerald-400' : 'border-l-emerald-500'))
                        : (dark ? 'border-l-[#3A3A3C]' : 'border-l-gray-200')
                      return (
                        <Link key={idx} href={item.href}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl border-l-4 ${accentBorder} ${dark ? 'bg-[#1C1C1E]' : 'bg-gray-50'} hover:opacity-80 transition-opacity`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{icon}</span>
                            <div className="min-w-0">
                              <div className={`text-sm font-medium truncate ${textPrimary}`}>{item.title}</div>
                              {item.subtitle && <div className={`text-xs truncate ${textSecondary}`}>{item.subtitle}</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {item.time && <span className={`text-xs font-semibold ${textSecondary}`}>{item.time}</span>}
                            {item.type === 'training' && (
                              <span className="text-xs bg-black text-white px-2 py-0.5 rounded-lg">✅</span>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Permission-based nav sections */}
      {navSections.length > 0 && (
        <>
          <h2 className={`text-sm font-medium mb-3 ${textSecondary}`}>Доступные разделы</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {navSections.map(s => (
              <Link key={s.key} href={s.href}
                className={`rounded-2xl border p-4 flex flex-col gap-1 transition-opacity hover:opacity-80 ${card}`}>
                <span className="text-2xl">{s.emoji}</span>
                <span className={`font-medium text-sm ${textPrimary}`}>{s.label}</span>
                <span className={`text-xs ${textSecondary}`}>{s.sub}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      </div>
    </main>
  )
}

export default function TrainerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>}>
      <TrainerPageInner />
    </Suspense>
  )
}
