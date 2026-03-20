'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'

const ALL_SECTIONS = [
  { href: '/students', emoji: '🥋', title: 'Ученики', desc: 'Список, группы, абонементы' },
  { href: '/attendance', emoji: '✅', title: 'Посещаемость', desc: 'Отметить занятие' },
  { href: '/finance', emoji: '💰', title: 'Финансы', desc: 'Платежи за месяц' },
  { href: '/salary', emoji: '💵', title: 'Зарплата', desc: 'Расчёт для тренеров' },
  { href: '/leads', emoji: '📋', title: 'Лиды', desc: 'Новые заявки' },
  { href: '/analytics', emoji: '📊', title: 'Аналитика', desc: 'Посещаемость, зона риска' },
  { href: '/broadcast', emoji: '📣', title: 'Рассылка', desc: 'Сообщения по группам' },
  { href: '/events', emoji: '🎉', title: 'Мероприятия', desc: 'Соревнования, семинары' },
  { href: '/tickets', emoji: '📝', title: 'Обращения', desc: 'Болезни, переносы, вопросы' },
  { href: '/schedule', emoji: '🗓', title: 'Расписание', desc: 'Группы и тренеры по дням' },
  { href: '/settings', emoji: '⚙️', title: 'Настройки', desc: 'Типы абонементов', roles: ['founder'] },
  { href: '/admin-users', emoji: '👤', title: 'Сотрудники', desc: 'Управление доступом', roles: ['founder'] },
]

// Маршруты скрытые от admin
const ADMIN_HIDDEN = ['/finance', '/salary', '/analytics', '/settings', '/import', '/admin-users']

export default function Home() {
  const { role, userName } = useAuth()
  const router = useRouter()
  const [expiring, setExpiring] = useState<any[]>([])
  const [noSessions, setNoSessions] = useState<any[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [notifying, setNotifying] = useState(false)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

      const [{ data: students }, { data: allSubs }] = await Promise.all([
        supabase.from('students').select('id, name').eq('status', 'active'),
        supabase.from('subscriptions').select('student_id, sessions_left, end_date').order('created_at', { ascending: false }),
      ])

      if (!students) return

      // Build map: student_id -> latest subscription
      const subMap = new Map<string, { sessions_left: number | null; end_date: string | null }>()
      for (const s of (allSubs || [])) {
        if (!subMap.has(s.student_id)) subMap.set(s.student_id, s)
      }

      const noSessArr: any[] = []
      const expiringArr: any[] = []

      for (const student of students) {
        const sub = subMap.get(student.id)
        // No subscription at all, or sessions ran out
        if (!sub || sub.sessions_left === 0) {
          noSessArr.push({ id: student.id, students: { name: student.name } })
        }
        // Subscription expires within 7 days
        if (sub?.end_date && sub.end_date >= today && sub.end_date <= in7days) {
          expiringArr.push({ id: student.id, students: { name: student.name } })
        }
      }

      setTotalStudents(students.length)
      setNoSessions(noSessArr)
      setExpiring(expiringArr)
    }
    load()
  }, [])

  async function sendReport() {
    setNotifying(true)
    await fetch('/api/notify-expiring', { method: 'POST' })
    setNotifying(false)
    alert('Отчёт отправлен в Telegram!')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sections = ALL_SECTIONS.filter(s => {
    if (role === 'admin') return !ADMIN_HIDDEN.includes(s.href)
    return true
  })

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between pt-4 pb-2 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">⚔️ Школа Самурая</h1>
          <p className="text-gray-500 text-sm mt-0.5">Центр физического развития и самозащиты</p>
        </div>
        {userName && (
          <button onClick={signOut}
            className="text-xs text-gray-400 border border-gray-200 px-3 py-1.5 rounded-xl shrink-0 ml-3">
            Выйти
          </button>
        )}
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
        {role === 'founder' && (
          <Link href="/admin-users"
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-95">
            <div className="text-4xl mb-2">👤</div>
            <div className="font-semibold text-gray-800">Сотрудники</div>
            <div className="text-sm text-gray-500 mt-1">Управление доступом</div>
          </Link>
        )}
      </div>
    </main>
  )
}
