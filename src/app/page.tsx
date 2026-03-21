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
  const [expiring, setExpiring] = useState<{ id: string; name: string }[]>([])
  const [noSessions, setNoSessions] = useState<{ id: string; name: string }[]>([])
  const [churn, setChurn] = useState<{ id: string; name: string; daysSince: number | null }[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [notifying, setNotifying] = useState(false)
  const [modal, setModal] = useState<'noSessions' | 'expiring' | 'churn' | null>(null)

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
          noSessArr.push({ id: student.id, name: student.name })
        }
        if (sub?.end_date && sub.end_date >= today && sub.end_date <= in7days) {
          expiringArr.push({ id: student.id, name: student.name })
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

      {/* Компактные алерты */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
        {noSessions.length > 0 ? (
          <button onClick={() => setModal('noSessions')}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition-colors border-b border-gray-50">
            <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-base shrink-0">❗</span>
            <span className="flex-1 text-left text-sm font-medium text-gray-700">Закончились занятия</span>
            <span className="text-red-500 font-bold text-sm">{noSessions.length}</span>
            <span className="text-gray-300 text-sm">›</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
            <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-base shrink-0">✅</span>
            <span className="flex-1 text-sm text-gray-400">Занятия есть у всех</span>
          </div>
        )}

        {expiring.length > 0 ? (
          <button onClick={() => setModal('expiring')}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-yellow-50 transition-colors border-b border-gray-50">
            <span className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-base shrink-0">⚠️</span>
            <span className="flex-1 text-left text-sm font-medium text-gray-700">Абонемент истекает</span>
            <span className="text-yellow-500 font-bold text-sm">{expiring.length}</span>
            <span className="text-gray-300 text-sm">›</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
            <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-base shrink-0">✅</span>
            <span className="flex-1 text-sm text-gray-400">Абонементы не истекают</span>
          </div>
        )}

        {churn.length > 0 ? (
          <button onClick={() => setModal('churn')}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-orange-50 transition-colors">
            <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-base shrink-0">⏰</span>
            <span className="flex-1 text-left text-sm font-medium text-gray-700">Не приходили 7+ дней</span>
            <span className="text-orange-500 font-bold text-sm">{churn.length}</span>
            <span className="text-gray-300 text-sm">›</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-base shrink-0">✅</span>
            <span className="flex-1 text-sm text-gray-400">Все ходят регулярно</span>
          </div>
        )}
      </div>

      {/* Модальное окно */}
      {modal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setModal(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-3xl max-h-[75vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Шапка модалки */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="font-semibold text-gray-800">
                {modal === 'noSessions' && `❗ Закончились занятия (${noSessions.length})`}
                {modal === 'expiring'   && `⚠️ Абонемент истекает (${expiring.length})`}
                {modal === 'churn'      && `⏰ Не приходили 7+ дней (${churn.length})`}
              </div>
              <button onClick={() => setModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-lg">×</button>
            </div>
            {/* Список */}
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-1">
              {modal === 'noSessions' && noSessions.map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setModal(null)}
                  className="flex items-center justify-between py-2.5 border-b border-gray-50 hover:text-black">
                  <span className="text-sm text-gray-700">{s.name}</span>
                  <span className="text-gray-300 text-sm">›</span>
                </Link>
              ))}
              {modal === 'expiring' && expiring.map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setModal(null)}
                  className="flex items-center justify-between py-2.5 border-b border-gray-50 hover:text-black">
                  <span className="text-sm text-gray-700">{s.name}</span>
                  <span className="text-gray-300 text-sm">›</span>
                </Link>
              ))}
              {modal === 'churn' && churn.map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setModal(null)}
                  className="flex items-center justify-between py-2.5 border-b border-gray-50 hover:text-black">
                  <span className="text-sm text-gray-700">{s.name}</span>
                  <span className="text-orange-400 text-xs">{s.daysSince !== null ? `${s.daysSince} дн.` : 'нет данных'}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 flex justify-around text-center">
        <div>
          <div className="text-2xl font-bold text-gray-800">{totalStudents}</div>
          <div className="text-xs text-gray-400">учеников</div>
        </div>
        <button onClick={() => noSessions.length > 0 && setModal('noSessions')}
          className={noSessions.length > 0 ? 'cursor-pointer active:scale-95 transition-transform' : ''}>
          <div className="text-2xl font-bold text-red-500">{noSessions.length}</div>
          <div className="text-xs text-gray-400">без занятий</div>
        </button>
        <button onClick={() => expiring.length > 0 && setModal('expiring')}
          className={expiring.length > 0 ? 'cursor-pointer active:scale-95 transition-transform' : ''}>
          <div className="text-2xl font-bold text-yellow-500">{expiring.length}</div>
          <div className="text-xs text-gray-400">истекает</div>
        </button>
        <button onClick={() => churn.length > 0 && setModal('churn')}
          className={churn.length > 0 ? 'cursor-pointer active:scale-95 transition-transform' : ''}>
          <div className="text-2xl font-bold text-orange-500">{churn.length}</div>
          <div className="text-xs text-gray-400">не приходят</div>
        </button>
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
