'use client'

import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

const sections = [
  { href: '/students', emoji: '🥋', title: 'Ученики', desc: 'Список, группы, абонементы' },
  { href: '/attendance', emoji: '✅', title: 'Посещаемость', desc: 'Отметить занятие' },
  { href: '/finance', emoji: '💰', title: 'Финансы', desc: 'Платежи за месяц' },
  { href: '/salary', emoji: '💵', title: 'Зарплата', desc: 'Расчёт для тренеров' },
  { href: '/leads', emoji: '📋', title: 'Лиды', desc: 'Новые заявки' },
  { href: '/analytics', emoji: '📊', title: 'Аналитика', desc: 'Посещаемость, зона риска' },
  { href: '/broadcast', emoji: '📣', title: 'Рассылка', desc: 'Сообщения по группам' },
  { href: '/events', emoji: '🎉', title: 'Мероприятия', desc: 'Соревнования, семинары' },
]

export default function Home() {
  const [expiring, setExpiring] = useState<any[]>([])
  const [noSessions, setNoSessions] = useState<any[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [notifying, setNotifying] = useState(false)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

      const [{ data: exp }, { data: noSess }, { data: students }] = await Promise.all([
        supabase.from('subscriptions').select('id, students(name)').gte('end_date', today).lte('end_date', in7days),
        supabase.from('subscriptions').select('id, students(name)').eq('sessions_left', 0),
        supabase.from('students').select('id').eq('status', 'active'),
      ])
      setExpiring(exp || [])
      setNoSessions(noSess || [])
      setTotalStudents(students?.length || 0)
    }
    load()
  }, [])

  async function sendReport() {
    setNotifying(true)
    await fetch('/api/notify-expiring', { method: 'POST' })
    setNotifying(false)
    alert('Отчёт отправлен в Telegram!')
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="text-center py-6">
        <h1 className="text-2xl font-bold text-gray-800">⚔️ Школа Самурая</h1>
        <p className="text-gray-500 mt-1">Центр физического развития и самозащиты</p>
      </div>

      {noSessions.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3">
          <div className="font-semibold text-red-700 mb-2">❗ Закончились занятия ({noSessions.length})</div>
          <div className="space-y-1">
            {noSessions.slice(0, 5).map((s: any) => (
              <div key={s.id} className="text-sm text-red-600">{s.students?.name}</div>
            ))}
            {noSessions.length > 5 && <div className="text-sm text-red-400">и ещё {noSessions.length - 5}...</div>}
          </div>
        </div>
      )}

      {expiring.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-3">
          <div className="font-semibold text-yellow-700 mb-2">⚠️ Абонемент истекает через 7 дней ({expiring.length})</div>
          <div className="space-y-1">
            {expiring.slice(0, 5).map((s: any) => (
              <div key={s.id} className="text-sm text-yellow-700">{s.students?.name}</div>
            ))}
            {expiring.length > 5 && <div className="text-sm text-yellow-500">и ещё {expiring.length - 5}...</div>}
          </div>
        </div>
      )}

      {noSessions.length === 0 && expiring.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-3 mb-3 text-center text-sm text-green-700">
          ✅ Всё в порядке — у всех учеников есть занятия
        </div>
      )}

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 flex justify-around text-center">
        <div>
          <div className="text-2xl font-bold text-gray-800">{totalStudents}</div>
          <div className="text-xs text-gray-400">учеников</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-500">{noSessions.length}</div>
          <div className="text-xs text-gray-400">без занятий</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-yellow-500">{expiring.length}</div>
          <div className="text-xs text-gray-400">истекает</div>
        </div>
      </div>

      <button onClick={sendReport} disabled={notifying}
        className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm mb-4 disabled:opacity-50">
        {notifying ? 'Отправка...' : '📨 Отправить отчёт в Telegram'}
      </button>

      <div className="grid grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-95">
            <div className="text-4xl mb-2">{s.emoji}</div>
            <div className="font-semibold text-gray-800">{s.title}</div>
            <div className="text-sm text-gray-500 mt-1">{s.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  )
}
