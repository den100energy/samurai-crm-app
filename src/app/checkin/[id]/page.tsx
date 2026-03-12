'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  name: string
  group_name: string | null
}

export default function CheckinPage() {
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<Student | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'already' | 'error'>('idle')
  const [sessionsLeft, setSessionsLeft] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('students')
        .select('id, name, group_name')
        .eq('id', id)
        .eq('status', 'active')
        .single()
      if (!data) setNotFound(true)
      else setStudent(data)
    }
    load()
  }, [id])

  async function checkin() {
    if (!student) return
    setStatus('loading')
    const today = new Date().toISOString().split('T')[0]

    // Check if already marked today
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('student_id', id)
      .eq('date', today)
      .single()

    if (existing) {
      setStatus('already')
      return
    }

    // Get active subscription
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('student_id', id)
      .order('created_at', { ascending: false })
      .limit(1)

    const sub = subs && subs.length > 0 ? subs[0] : null

    // Record attendance
    const { error } = await supabase.from('attendance').insert({
      student_id: id,
      date: today,
      present: true,
    })

    if (error) { setStatus('error'); return }

    // Deduct session
    if (sub && sub.sessions_left != null && sub.sessions_left > 0) {
      const newLeft = sub.sessions_left - 1
      await supabase.from('subscriptions').update({ sessions_left: newLeft }).eq('id', sub.id)
      setSessionsLeft(newLeft)
    } else if (sub && sub.sessions_left != null) {
      setSessionsLeft(sub.sessions_left)
    }

    setStatus('done')
  }

  if (notFound) return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <div className="text-5xl mb-3">🔒</div>
        <div className="font-medium text-gray-600">Ученик не найден</div>
      </div>
    </main>
  )

  if (!student) return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400 text-sm">Загрузка...</div>
    </main>
  )

  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-sm w-full mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-black text-white flex items-center justify-center text-3xl font-bold mx-auto mb-4">
            {student.name[0]}
          </div>
          <div className="text-xl font-bold text-gray-800 mb-1">{student.name}</div>
          <div className="text-sm text-gray-400 mb-1">{student.group_name || 'Группа не указана'}</div>
          <div className="text-xs text-gray-300 mb-8">{today}</div>

          {status === 'idle' && (
            <button
              onClick={checkin}
              className="w-full bg-black text-white py-4 rounded-2xl text-lg font-semibold active:scale-95 transition-transform"
            >
              ✅ Я пришёл на тренировку
            </button>
          )}

          {status === 'loading' && (
            <div className="text-gray-400 py-4">Записываем...</div>
          )}

          {status === 'done' && (
            <div>
              <div className="text-5xl mb-3">🎉</div>
              <div className="text-lg font-bold text-green-600 mb-2">Отлично! Записано</div>
              <div className="text-sm text-gray-400 mb-4">Посещение засчитано</div>
              {sessionsLeft !== null && (
                <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                  sessionsLeft === 0 ? 'bg-red-100 text-red-600' :
                  sessionsLeft <= 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  {sessionsLeft === 0
                    ? 'Занятия закончились — продлите абонемент'
                    : `Осталось занятий: ${sessionsLeft}`}
                </div>
              )}
            </div>
          )}

          {status === 'already' && (
            <div>
              <div className="text-5xl mb-3">👍</div>
              <div className="text-lg font-bold text-gray-700 mb-2">Уже отмечен сегодня</div>
              <div className="text-sm text-gray-400">Посещение уже записано</div>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div className="text-5xl mb-3">❌</div>
              <div className="text-lg font-bold text-red-600 mb-2">Ошибка</div>
              <button onClick={() => setStatus('idle')} className="text-sm text-gray-500 underline">Попробовать снова</button>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-gray-300 mt-6">Школа Самурая</div>
      </div>
    </main>
  )
}
