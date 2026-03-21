'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { SECTIONS, hasAccess } from '@/lib/auth'

export default function Home() {
  const { role, userName, permissions } = useAuth()
  const router = useRouter()
  const [expiring, setExpiring] = useState<any[]>([])
  const [noSessions, setNoSessions] = useState<any[]>([])
  const [churn, setChurn] = useState<{ id: string; name: string; daysSince: number | null }[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [notifying, setNotifying] = useState(false)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      const ago30days = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

      const [{ data: students }, { data: allSubs }, { data: recentAtt }] = await Promise.all([
        supabase.from('students').select('id, name').eq('status', 'active'),
        supabase.from('subscriptions').select('student_id, sessions_left, end_date').order('created_at', { ascending: false }),
        supabase.from('attendance').select('student_id, date').eq('present', true).gte('date', ago30days).order('date', { ascending: false }),
      ])

      if (!students) return

      // student_id -> latest subscription
      const subMap = new Map<string, { sessions_left: number | null; end_date: string | null }>()
      for (const s of (allSubs || [])) {
        if (!subMap.has(s.student_id)) subMap.set(s.student_id, s)
      }

      // student_id -> last attendance date (within 30 days)
      const lastDateMap = new Map<string, string>()
      for (const a of (recentAtt || [])) {
        if (!lastDateMap.has(a.student_id)) lastDateMap.set(a.student_id, a.date)
      }

      const noSessArr: any[] = []
      const expiringArr: any[] = []
      const churnArr: { id: string; name: string; daysSince: number | null }[] = []

      for (const student of students) {
        const sub = subMap.get(student.id)
        if (!sub || sub.sessions_left === 0) {
          noSessArr.push({ id: student.id, students: { name: student.name } })
        }
        if (sub?.end_date && sub.end_date >= today && sub.end_date <= in7days) {
          expiringArr.push({ id: student.id, students: { name: student.name } })
        }
        // Churn: active subscription but not attended in 7+ days
        const hasActiveSub = sub && (sub.sessions_left ?? 0) > 0 && (!sub.end_date || sub.end_date >= today)
        if (hasActiveSub) {
          const lastDate = lastDateMap.get(student.id)
          const daysSince = lastDate
            ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
            : null
          if (daysSince === null || daysSince >= 7) {
            churnArr.push({ id: student.id, name: student.name, daysSince })
          }
        }
      }

      churnArr.sort((a, b) => (b.daysSince ?? 999) - (a.daysSince ?? 999))

      setTotalStudents(students.length)
      setNoSessions(noSessArr)
      setExpiring(expiringArr)
      setChurn(churnArr)
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

  const sections = role
    ? SECTIONS.filter(s => hasAccess(role, permissions, s.key))
    : []

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

      {churn.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-3">
          <div className="font-semibold text-orange-700 mb-2">⏰ Не приходили 7+ дней ({churn.length})</div>
          <div className="space-y-1">
            {churn.slice(0, 5).map(s => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="text-orange-700">{s.name}</span>
                <span className="text-orange-400">{s.daysSince !== null ? `${s.daysSince} дн.` : 'нет данных'}</span>
              </div>
            ))}
            {churn.length > 5 && <div className="text-sm text-orange-400">и ещё {churn.length - 5}...</div>}
          </div>
        </div>
      )}

      {noSessions.length === 0 && expiring.length === 0 && churn.length === 0 && (
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
          <Link key={s.route} href={s.route}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-95">
            <div className="text-4xl mb-2">{s.emoji}</div>
            <div className="font-semibold text-gray-800">{s.label}</div>
          </Link>
        ))}
        {role === 'founder' && (
          <Link href="/admin-users"
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-95">
            <div className="text-4xl mb-2">👤</div>
            <div className="font-semibold text-gray-800">Сотрудники</div>
          </Link>
        )}
      </div>
    </main>
  )
}
