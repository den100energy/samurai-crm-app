'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTheme } from '@/components/ThemeProvider'
import { hasAccess } from '@/lib/auth'
import { FujiScene } from '@/components/FujiScene'

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
    dates[i + 1] = d.toISOString().split('T')[0]
  }
  return dates
}

export default function TrainerPage() {
  const { userName, role, permissions, loading } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const router = useRouter()
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([])
  const [overrides, setOverrides] = useState<Override[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [trainerPhone, setTrainerPhone] = useState('')
  const [trainerTg, setTrainerTg] = useState('')
  const [showProfile, setShowProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const dark = theme === 'dark'

  useEffect(() => {
    if (!loading && role !== 'trainer') {
      router.replace('/')
      return
    }
    if (!loading && userName) loadData()
  }, [loading, role, userName])

  async function loadData() {
    const weekDates = getWeekDates()
    const monday = weekDates[1]
    const sunday = weekDates[7]

    const [{ data: slots }, { data: students }, { data: ovData }, { data: trainerRow }] = await Promise.all([
      supabase.from('schedule').select('*').eq('trainer_name', userName).order('day_of_week').order('time_start'),
      supabase.from('students').select('id, group_name').eq('status', 'active'),
      supabase.from('schedule_overrides').select('date, group_name, trainer_name, cancelled')
        .gte('date', monday).lte('date', sunday),
      supabase.from('trainers').select('phone, telegram_username').eq('name', userName).maybeSingle(),
    ])
    setSchedule(slots || [])
    setOverrides(ovData || [])
    if (trainerRow) {
      setTrainerPhone(trainerRow.phone || '')
      setTrainerTg(trainerRow.telegram_username || '')
    }

    const trainerGroups = [...new Set((slots || []).map(s => s.group_name))]
    const myStudents = (students || []).filter(s => s.group_name && trainerGroups.includes(s.group_name))
    setStudentCount(myStudents.length)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function saveProfile() {
    if (!userName) return
    setSavingProfile(true)
    await supabase.from('trainers')
      .update({ phone: trainerPhone || null, telegram_username: trainerTg || null })
      .eq('name', userName)
    setSavingProfile(false)
    setProfileSaved(true)
    setShowProfile(false)
    setTimeout(() => setProfileSaved(false), 2000)
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
        if (override?.trainer_name && override.trainer_name !== userName) return null
        return { ...s, dateStr, dayNum, override }
      })
      .filter(Boolean)
    ) as (ScheduleSlot & { dateStr: string; dayNum: number; override: Override | undefined })[]

  // Sections available to this trainer based on permissions
  const navSections = [
    { key: 'students', label: 'Ученики', emoji: '🥋', href: '/trainer/students', sub: `${studentCount} чел.` },
    { key: 'leads', label: 'Лиды', emoji: '📋', href: '/leads', sub: 'Заявки' },
    { key: 'finance', label: 'Финансы', emoji: '💰', href: '/finance', sub: 'Платежи' },
    { key: 'events', label: 'Мероприятия', emoji: '🎉', href: '/events', sub: 'Список' },
    { key: 'schedule', label: 'Расписание', emoji: '🗓', href: '/schedule', sub: 'Просмотр' },
    { key: 'analytics', label: 'Аналитика', emoji: '📊', href: '/analytics', sub: 'Статистика' },
    { key: 'broadcast', label: 'Рассылка', emoji: '📣', href: '/broadcast', sub: 'Telegram' },
    { key: 'tickets', label: 'Обращения', emoji: '📝', href: '/tickets', sub: 'Вопросы' },
  ].filter(s => hasAccess(role!, permissions, s.key))

  const card = dark
    ? 'bg-[#2C2C2E] border-[#3A3A3C]'
    : 'bg-white border-gray-100 shadow-sm'

  const textPrimary = dark ? 'text-[#E5E5E7]' : 'text-gray-800'
  const textSecondary = dark ? 'text-[#8E8E93]' : 'text-gray-400'

  return (
    <main className="max-w-lg mx-auto" style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Hero: FujiScene + header overlay */}
      <div className="relative overflow-hidden">
        <FujiScene dark={dark} bgColor={dark ? '#1C1C1E' : '#F5F4F0'} />
        <div className="absolute inset-x-0 top-0 px-5 pt-8 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white text-xl font-bold leading-tight drop-shadow-lg">
                🥋 {userName || 'Тренер'}
              </h1>
              <p className="text-white/60 text-xs mt-0.5">Кабинет тренера</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme}
                className="text-sm text-white/70 border border-white/20 bg-black/25 backdrop-blur-sm
                  px-2.5 py-1.5 rounded-lg hover:text-white transition-all duration-200">
                {dark ? '☀' : '🌙'}
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

      <div className="p-4">

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
            <button onClick={saveProfile} disabled={savingProfile}
              className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {savingProfile ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>

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

      {/* Schedule warning */}
      {schedule.length === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 mb-4 text-xs text-amber-700">
          ⚠️ Расписание не настроено. Попросите администратора добавить ваши группы.
        </div>
      )}

      {/* Upcoming slots this week */}
      {upcomingSlots.length > 0 && (
        <div className={`rounded-2xl border p-4 mb-4 ${card}`}>
          <h2 className={`font-semibold mb-3 ${textPrimary}`}>Занятия на этой неделе</h2>
          <div className="space-y-2">
            {upcomingSlots.map(slot => {
              const isToday = slot.dayNum === TODAY_NUM
              const dateLabel = new Date(slot.dateStr + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
              return (
                <div key={`${slot.id}-${slot.dateStr}`}
                  className={`flex items-center justify-between py-2 border-b last:border-0 ${dark ? 'border-[#3A3A3C]' : 'border-gray-50'}`}>
                  <div>
                    <div className={`text-sm ${isToday ? (dark ? 'text-white font-semibold' : 'text-black font-semibold') : textPrimary}`}>
                      {slot.group_name}
                    </div>
                    <div className={`text-xs mt-0.5 ${textSecondary}`}>
                      {DAYS_SHORT[slot.dayNum]} {dateLabel}
                      {isToday && <span className={`ml-1 font-medium ${dark ? 'text-[#E5E5E7]' : 'text-black'}`}>— сегодня</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${textPrimary}`}>{slot.time_start?.slice(0, 5)}</span>
                    <Link
                      href={`/trainer/attendance?date=${slot.dateStr}&group=${encodeURIComponent(slot.group_name)}`}
                      className="text-xs bg-black text-white px-2.5 py-1 rounded-lg">
                      ✅
                    </Link>
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
