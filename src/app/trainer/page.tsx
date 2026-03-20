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

const DAYS = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
const TODAY_NUM = new Date().getDay() === 0 ? 7 : new Date().getDay()

export default function TrainerPage() {
  const { userName, role, loading } = useAuth()
  const router = useRouter()
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([])
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
    const [{ data: slots }, { data: students }] = await Promise.all([
      supabase.from('schedule').select('*').eq('trainer_name', userName).order('day_of_week').order('time_start'),
      supabase.from('students').select('id, group_name').eq('status', 'active'),
    ])
    setSchedule(slots || [])

    // Считаем только учеников в группах тренера
    const trainerGroups = [...new Set((slots || []).map(s => s.group_name))]
    const myStudents = (students || []).filter(s => s.group_name && trainerGroups.includes(s.group_name))
    setStudentCount(myStudents.length)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>

  const todaySlots = schedule.filter(s => s.day_of_week === TODAY_NUM)
  const myGroups = [...new Set(schedule.map(s => s.group_name))]

  return (
    <main className="max-w-lg mx-auto p-4">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">🥋 {userName || 'Тренер'}</h1>
          <p className="text-sm text-gray-400">Кабинет тренера</p>
        </div>
        <button onClick={signOut} className="text-sm text-gray-400 border border-gray-200 px-3 py-1.5 rounded-xl">
          Выйти
        </button>
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

      {/* Расписание сегодня */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <h2 className="font-semibold text-gray-800 mb-3">
          Сегодня — {DAYS[TODAY_NUM]}
        </h2>
        {todaySlots.length === 0 ? (
          <p className="text-sm text-gray-400">Занятий нет</p>
        ) : (
          <div className="space-y-2">
            {todaySlots.map(slot => (
              <div key={slot.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-800">{slot.group_name}</div>
                </div>
                <div className="text-sm font-bold text-gray-700">{slot.time_start}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Расписание на неделю */}
      {schedule.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Расписание на неделю</h2>
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
                        {s.time_start} {s.group_name}
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
