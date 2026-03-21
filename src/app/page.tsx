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

      const subMap = new Map<string, { sessions_left: number | null; end_date: string | null }>()
      for (const s of (allSubs || [])) {
        if (!subMap.has(s.student_id)) subMap.set(s.student_id, s)
      }

      const lastDateMap = new Map<string, string>()
      for (const a of (recentAtt || [])) {
        if (!lastDateMap.has(a.student_id)) lastDateMap.set(a.student_id, a.date)
      }

      const noSessArr: any[] = []
      const expiringArr: any[] = []
      const churnArr: { id: string; name: string; daysSince: number | null }[] = []

      for (const student of students) {
        const sub = subMap.get(student.id)
        if (!sub || sub.sessions_left === 0) noSessArr.push({ id: student.id, name: student.name })
        if (sub?.end_date && sub.end_date >= today && sub.end_date <= in7days) expiringArr.push({ id: student.id, name: student.name })
        const hasActiveSub = sub && (sub.sessions_left ?? 0) > 0 && (!sub.end_date || sub.end_date >= today)
        if (hasActiveSub) {
          const lastDate = lastDateMap.get(student.id)
          const daysSince = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : null
          if (daysSince === null || daysSince >= 7) churnArr.push({ id: student.id, name: student.name, daysSince })
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

  const sections = role ? SECTIONS.filter(s => hasAccess(role, permissions, s.key)) : []

  const metrics = [
    {
      value: totalStudents,
      label: 'Учеников',
      kanji: '侍',
      sub: 'всего активных',
      color: 'from-zinc-800 to-zinc-900',
      ring: 'ring-zinc-600',
      text: 'text-white',
      accent: 'text-amber-400',
      onClick: null,
    },
    {
      value: noSessions.length,
      label: 'Без занятий',
      kanji: '空',
      sub: 'нет абонемента',
      color: noSessions.length > 0 ? 'from-red-950 to-zinc-900' : 'from-zinc-800 to-zinc-900',
      ring: noSessions.length > 0 ? 'ring-red-700' : 'ring-zinc-600',
      text: noSessions.length > 0 ? 'text-red-400' : 'text-zinc-500',
      accent: noSessions.length > 0 ? 'text-red-300' : 'text-zinc-600',
      onClick: noSessions.length > 0 ? () => setModal('noSessions') : null,
    },
    {
      value: expiring.length,
      label: 'Истекает',
      kanji: '期',
      sub: 'абонемент в 7 дней',
      color: expiring.length > 0 ? 'from-amber-950 to-zinc-900' : 'from-zinc-800 to-zinc-900',
      ring: expiring.length > 0 ? 'ring-amber-600' : 'ring-zinc-600',
      text: expiring.length > 0 ? 'text-amber-400' : 'text-zinc-500',
      accent: expiring.length > 0 ? 'text-amber-300' : 'text-zinc-600',
      onClick: expiring.length > 0 ? () => setModal('expiring') : null,
    },
    {
      value: churn.length,
      label: 'Не приходят',
      kanji: '眠',
      sub: '7+ дней без визита',
      color: churn.length > 0 ? 'from-orange-950 to-zinc-900' : 'from-zinc-800 to-zinc-900',
      ring: churn.length > 0 ? 'ring-orange-700' : 'ring-zinc-600',
      text: churn.length > 0 ? 'text-orange-400' : 'text-zinc-500',
      accent: churn.length > 0 ? 'text-orange-300' : 'text-zinc-600',
      onClick: churn.length > 0 ? () => setModal('churn') : null,
    },
  ]

  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="px-5 pt-8 pb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-400 text-2xl">⚔</span>
            <h1 className="text-white text-xl font-bold tracking-wide">Школа Самурая</h1>
          </div>
          <p className="text-zinc-500 text-xs tracking-widest uppercase">武道 · Путь воина</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {userName && (
            <button onClick={signOut}
              className="text-xs text-zinc-500 border border-zinc-800 px-3 py-1.5 rounded-lg hover:border-zinc-600 transition-colors">
              Выйти
            </button>
          )}
          <div className="relative group">
            <button onClick={sendReport} disabled={notifying}
              className="text-xs text-zinc-400 border border-zinc-700 px-3 py-1.5 rounded-lg
                hover:border-amber-700 hover:text-amber-400 disabled:opacity-40 transition-colors flex items-center gap-1.5">
              <span>📨</span>
              <span>{notifying ? 'Отправка...' : 'Отчёт'}</span>
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2
              text-xs text-zinc-300 leading-relaxed
              opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
              Отправить сводку по ученикам (без занятий, истекающие абонементы) в Telegram
            </div>
          </div>
        </div>
      </div>

      {/* Разделитель */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-amber-900/50 to-transparent mb-6" />

      {/* Метрики — приборная панель */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-6">
        {metrics.map((m, i) => (
          <button
            key={i}
            onClick={m.onClick ?? undefined}
            disabled={!m.onClick}
            className={`
              relative bg-gradient-to-br ${m.color}
              ring-1 ${m.ring}
              rounded-2xl p-4 text-left
              transition-all duration-200
              ${m.onClick ? 'active:scale-95 hover:ring-2' : 'cursor-default'}
              overflow-hidden
            `}
          >
            {/* Иероглиф-фон */}
            <span className={`absolute right-3 top-1 text-5xl font-bold opacity-10 select-none ${m.accent}`}>
              {m.kanji}
            </span>
            {/* Значение */}
            <div className={`text-3xl font-bold mb-0.5 ${m.text}`}>{m.value}</div>
            <div className="text-white text-sm font-medium">{m.label}</div>
            <div className="text-zinc-500 text-xs mt-0.5">{m.sub}</div>
            {/* Стрелка если кликабельно */}
            {m.onClick && (
              <div className={`absolute bottom-3 right-3 text-xs ${m.accent} opacity-60`}>›</div>
            )}
          </button>
        ))}
      </div>

      {/* Разделитель */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent mb-5" />

      {/* Навигация */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-6">
        {sections.map((s) => (
          <Link key={s.route} href={s.route}
            className="group bg-zinc-900 ring-1 ring-zinc-800 rounded-2xl p-4
              hover:ring-amber-900 hover:bg-zinc-800
              active:scale-95 transition-all duration-200">
            <div className="text-3xl mb-2">{s.emoji}</div>
            <div className="text-white text-sm font-medium">{s.label}</div>
          </Link>
        ))}
        {role === 'founder' && (
          <Link href="/admin-users"
            className="group bg-zinc-900 ring-1 ring-zinc-800 rounded-2xl p-4
              hover:ring-amber-900 hover:bg-zinc-800
              active:scale-95 transition-all duration-200">
            <div className="text-3xl mb-2">👤</div>
            <div className="text-white text-sm font-medium">Сотрудники</div>
          </Link>
        )}
      </div>

      {/* Нижний декор */}
      <div className="px-5 pb-8 text-center">
        <span className="text-zinc-800 text-xs tracking-widest">一期一会</span>
      </div>

      {/* Модальное окно */}
      {modal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setModal(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-zinc-900 rounded-t-3xl max-h-[75vh] flex flex-col ring-1 ring-zinc-800"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800">
              <div className="font-semibold text-white text-sm">
                {modal === 'noSessions' && `Без занятий · ${noSessions.length}`}
                {modal === 'expiring'   && `Истекает абонемент · ${expiring.length}`}
                {modal === 'churn'      && `Не приходили 7+ дней · ${churn.length}`}
              </div>
              <button onClick={() => setModal(null)}
                className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-lg">×</button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-1">
              {modal === 'noSessions' && noSessions.map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setModal(null)}
                  className="flex items-center justify-between py-2.5 border-b border-zinc-800 hover:text-amber-400 transition-colors">
                  <span className="text-sm text-zinc-300">{s.name}</span>
                  <span className="text-zinc-600 text-sm">›</span>
                </Link>
              ))}
              {modal === 'expiring' && expiring.map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setModal(null)}
                  className="flex items-center justify-between py-2.5 border-b border-zinc-800 hover:text-amber-400 transition-colors">
                  <span className="text-sm text-zinc-300">{s.name}</span>
                  <span className="text-zinc-600 text-sm">›</span>
                </Link>
              ))}
              {modal === 'churn' && churn.map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setModal(null)}
                  className="flex items-center justify-between py-2.5 border-b border-zinc-800 hover:text-amber-400 transition-colors">
                  <span className="text-sm text-zinc-300">{s.name}</span>
                  <span className="text-orange-500 text-xs">{s.daysSince !== null ? `${s.daysSince} дн.` : '—'}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
