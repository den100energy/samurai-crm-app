'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FujiScene } from '@/components/FujiScene'

type Student = {
  id: string
  name: string
  group_name: string | null
  birth_date: string | null
}

type Subscription = {
  id: string
  type: string
  sessions_total: number | null
  sessions_left: number | null
  start_date: string | null
  end_date: string | null
}

type Attendance = {
  id: string
  date: string
  present: boolean
}

export default function ParentPage() {
  const { token } = useParams<{ token: string }>()
  const [student, setStudent] = useState<Student | null>(null)
  const [activeSub, setActiveSub] = useState<Subscription | null>(null)
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase
        .from('students')
        .select('id, name, group_name, birth_date')
        .eq('parent_token', token)
        .eq('status', 'active')
        .single()

      if (!s) { setNotFound(true); return }
      setStudent(s)

      const [{ data: subs }, { data: att }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('student_id', s.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('attendance').select('*').eq('student_id', s.id).order('date', { ascending: false }).limit(15),
      ])
      if (subs && subs.length > 0) setActiveSub(subs[0])
      setAttendance(att || [])
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

        <div className="p-4">

        {/* Active subscription */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-3">
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

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
            <div className="text-2xl font-bold text-gray-800">{presentCount}</div>
            <div className="text-xs text-gray-400 mt-1">посещений за месяц</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
            <div className="text-sm font-bold text-gray-800">{lastVisit || '—'}</div>
            <div className="text-xs text-gray-400 mt-1">последнее посещение</div>
          </div>
        </div>

        {/* Attendance history */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">История посещений</div>
          {attendance.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-2">Нет данных</div>
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

        <div className="text-center text-xs text-gray-300">Школа Самурая</div>
        </div>
      </div>
    </main>
  )
}
