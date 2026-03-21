'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

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

const DAYS = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
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
  const { userName, role, loading } = useAuth()
  const router = useRouter()
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([])
  const [overrides, setOverrides] = useState<Override[]>([])
  const [studentCount, setStudentCount] = useState(0)

  useEffect(() => {
    if (!loading && role !== 'trainer') {
      router.replace('/')
      return
    }
    if (!loading && userName) {
      loadData()
    }
  }, [loading, role, userName])

  async function loadData() {
    const weekDates = getWeekDates()
    const monday = weekDates[1]
    const sunday = weekDates[7]

    const [{ data: slots }, { data: students }, { data: ovData }] = await Promise.all([
      supabase.from('schedule').select('*').eq('trainer_name', userName).order('day_of_week').order('time_start'),
      supabase.from('students').select('id, group_name').eq('status', 'active'),
      supabase.from('schedule_overrides').select('date, group_name, trainer_name, cancelled')
        .gte('date', monday).lte('date', sunday),
    ])
    setSchedule(slots || [])
    setOverrides(ovData || [])

    const trainerGroups = [...new Set((slots || []).map(s => s.group_name))]
    const myStudents = (students || []).filter(s => s.group_name && trainerGroups.includes(s.group_name))
    setStudentCount(myStudents.length)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>

  const weekDates = getWeekDates()
  const todaySlots = schedule.filter(s => s.day_of_week === TODAY_NUM)
  const myGroups = [...new Set(schedule.map(s => s.group_name))]

  // Build upcoming slots with dates (today + future this week), applying overrides
  const upcomingSlots = [TODAY_NUM, ...Array.from({length: 7 - TODAY_NUM}, (_, i) => TODAY_NUM + i + 1)]
    .flatMap(dayNum => {
      return schedule
        .filter(s => s.day_of_week === dayNum)
        .map(s => {
          const dateStr = weekDates[dayNum]
          const override = overrides.find(o => o.date === dateStr && o.group_name === s.group_name)
          // If cancelled or reassigned to another trainer — skip
          if (override?.cancelled) return null
          if (override?.trainer_name && override.trainer_name !== userName) return null
          return { ...s, dateStr, dayNum, override }
        })
        .filter(Boolean)
    }) as (ScheduleSlot & { dateStr: string; dayNum: number; override: Override | undefined })[]

  return (
    <main className="max-w-lg mx-auto p-4">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">🥋 {userName || 'Тренер'}</h1>
          <p className="text-sm text-gray-400">Кабинет тренера</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm text-gray-400 border border-gray-200 px-3 py-1.5 rounded-xl">
            Главная
          </Link>
          <button onClick={signOut} className="text-sm text-gray-400 border border-gray-200 px-3 py-1.5 rounded-xl">
            Выйти
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{studentCount}</div>
          <div className="text-xs text-gray-400 mt-0.5">учеников</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{myGroups.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">групп</div>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link href="/trainer/attendance"
          className="bg-black text-white rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-2xl">✅</span>
          <span className="font-medium text-sm">Посещаемость</span>
          <span className="text-xs text-gray-400">Отметить сегодня</span>
        </Link>
        <Link href="/trainer/students"
          className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-2xl">👥</span>
          <span className="font-medium text-sm text-gray-800">Мои ученики</span>
          <span className="text-xs text-gray-400">{studentCount} чел.</span>
        </Link>
      </div>

      {/* Предупреждение если расписание не настроено */}
      {schedule.length === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 mb-4 text-xs text-amber-700">
          ⚠️ Расписание не настроено. Попросите администратора добавить ваши группы в расписание. Пока доступны все группы.
        </div>
      )}

      {/* Занятия на этой неделе с датами */}
      {upcomingSlots.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <h2 className="font-semibold text-gray-800 mb-3">Занятия на этой неделе</h2>
          <div className="space-y-2">
            {upcomingSlots.map((slot, idx) => {
              const isToday = slot.dayNum === TODAY_NUM
              const dateLabel = new Date(slot.dateStr + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
              return (
                <div key={`${slot.id}-${slot.dateStr}`}
                  className={`flex items-center justify-between py-2 border-b border-gray-50 last:border-0 ${isToday ? 'font-medium' : ''}`}>
                  <div>
                    <div className={`text-sm ${isToday ? 'text-black font-semibold' : 'text-gray-700'}`}>
                      {slot.group_name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {DAYS_SHORT[slot.dayNum]} {dateLabel}
                      {isToday && <span className="ml-1 text-black font-medium">— сегодня</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700">{slot.time_start?.slice(0,5)}</span>
                    <Link
                      href={`/trainer/attendance?date=${slot.dateStr}&group=${encodeURIComponent(slot.group_name)}`}
                      className="text-xs bg-black text-white px-2.5 py-1 rounded-lg"
                    >
                      ✅
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Расписание на неделю (шаблон) */}
      {schedule.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Шаблон расписания</h2>
          <div className="space-y-1">
            {[1,2,3,4,5,6,7].map(day => {
              const slots = schedule.filter(s => s.day_of_week === day)
              if (slots.length === 0) return null
              return (
                <div key={day} className="flex items-start gap-3 py-1.5">
                  <span className={`text-xs w-20 shrink-0 pt-0.5 ${day === TODAY_NUM ? 'font-bold text-black' : 'text-gray-400'}`}>
                    {DAYS[day]}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map(s => (
                      <span key={s.id} className="text-xs bg-gray-100 rounded-lg px-2 py-1">
                        {s.time_start?.slice(0,5)} {s.group_name}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
