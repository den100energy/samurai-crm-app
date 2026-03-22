'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  name: string
  group_name: string | null
  birth_date: string | null
  health_notes: string | null
  photo_url: string | null
  status: string
}

type Subscription = {
  id: string
  type: string
  sessions_total: number | null
  sessions_left: number | null
  start_date: string | null
  end_date: string | null
  paid: boolean
}

type Attendance = {
  date: string
  present: boolean
}

function getAge(birthDate: string | null) {
  if (!birthDate) return null
  const diff = Date.now() - new Date(birthDate).getTime()
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
}

export default function TrainerStudentCard() {
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<Student | null>(null)
  const [sub, setSub] = useState<Subscription | null>(null)
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadData()
  }, [id])

  async function loadData() {
    const [{ data: s }, { data: subData }, { data: attData }] = await Promise.all([
      supabase.from('students').select('id, name, group_name, birth_date, health_notes, photo_url, status').eq('id', id).single(),
      supabase.from('subscriptions').select('id, type, sessions_total, sessions_left, start_date, end_date, paid')
        .eq('student_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('attendance').select('date, present').eq('student_id', id)
        .order('date', { ascending: false }).limit(20),
    ])
    setStudent(s)
    setSub(subData)
    setAttendance(attData || [])
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>
  )
  if (!student) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Ученик не найден</div>
  )

  const age = getAge(student.birth_date)
  const presentCount = attendance.filter(a => a.present).length
  const totalCount = attendance.length

  function sessionsColor(left: number | null) {
    if (left === null) return 'text-gray-500'
    if (left === 0) return 'text-red-500 font-bold'
    if (left <= 2) return 'text-orange-500 font-semibold'
    return 'text-green-600 font-semibold'
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/trainer/students" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Карточка ученика</h1>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400 overflow-hidden shrink-0">
            {student.photo_url
              ? <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
              : student.name[0]}
          </div>
          <div>
            <div className="text-lg font-bold text-gray-800">{student.name}</div>
            <div className="text-sm text-gray-400 mt-0.5">
              {student.group_name || '—'}
              {age ? ` · ${age} лет` : ''}
            </div>
            {student.birth_date && (
              <div className="text-xs text-gray-400 mt-0.5">
                {new Date(student.birth_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Health notes */}
      {student.health_notes && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-4">
          <div className="text-xs font-semibold text-orange-700 mb-1">⚠️ Здоровье / ограничения</div>
          <div className="text-sm text-orange-900">{student.health_notes}</div>
        </div>
      )}

      {/* Subscription */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Абонемент</div>
        {sub ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{sub.type}</span>
              {!sub.paid && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Не оплачен</span>
              )}
            </div>
            {sub.sessions_total !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Занятий осталось</span>
                <span className={`text-sm ${sessionsColor(sub.sessions_left)}`}>
                  {sub.sessions_left ?? '—'} / {sub.sessions_total}
                </span>
              </div>
            )}
            {sub.end_date && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Действует до</span>
                <span className="text-sm text-gray-700">
                  {new Date(sub.end_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-orange-500 font-medium">⚠️ Нет абонемента</div>
        )}
      </div>

      {/* Attendance */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Посещаемость</div>
          {totalCount > 0 && (
            <span className="text-xs text-gray-400">{presentCount} из {totalCount}</span>
          )}
        </div>
        {attendance.length === 0 ? (
          <div className="text-sm text-gray-400">Нет записей</div>
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            {attendance.map(a => (
              <span key={a.date}
                className={`text-xs px-2 py-1 rounded-lg ${a.present ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-400'}`}>
                {new Date(a.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                {a.present ? ' ✓' : ' —'}
              </span>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
