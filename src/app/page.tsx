'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { SECTIONS, hasAccess } from '@/lib/auth'
import { useTheme } from '@/components/ThemeProvider'
import { FujiScene } from '@/components/FujiScene'

export default function Home() {
  const { role, userName, trainerId, permissions } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const router = useRouter()
  const [expiring, setExpiring] = useState<{ id: string; name: string }[]>([])
  const [noSessions, setNoSessions] = useState<{ id: string; name: string }[]>([])
  const [churn, setChurn] = useState<{ id: string; name: string; daysSince: number | null }[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [notifying, setNotifying] = useState(false)
  const [modal, setModal] = useState<'noSessions' | 'expiring' | 'churn' | null>(null)
  const [loaded, setLoaded] = useState(false)

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
      setLoaded(true)
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
      sub: 'активных',
      glow: '',
      border: theme === 'dark' ? 'border-[#3A3A3C]' : 'border-[#E5E4E0]',
      numColor: theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]',
      onClick: null as (() => void) | null,
    },
    {
      value: noSessions.length,
      label: 'Без занятий',
      kanji: '空',
      sub: 'нет абонемента',
      glow: noSessions.length > 0 ? 'glow-red' : '',
      border: noSessions.length > 0 ? 'border-[#E8121E]/40' : theme === 'dark' ? 'border-[#3A3A3C]' : 'border-[#E5E4E0]',
      numColor: noSessions.length > 0 ? 'text-[#E8121E]' : theme === 'dark' ? 'text-[#48484A]' : 'text-[#C0BFBB]',
      onClick: noSessions.length > 0 ? () => setModal('noSessions') : null,
    },
    {
      value: expiring.length,
      label: 'Истекает',
      kanji: '期',
      sub: 'абонемент в 7 дней',
      glow: expiring.length > 0 ? 'glow-amber' : '',
      border: expiring.length > 0 ? 'border-amber-500/40' : theme === 'dark' ? 'border-[#3A3A3C]' : 'border-[#E5E4E0]',
      numColor: expiring.length > 0 ? 'text-amber-500' : theme === 'dark' ? 'text-[#48484A]' : 'text-[#C0BFBB]',
      onClick: expiring.length > 0 ? () => setModal('expiring') : null,
    },
    {
      value: churn.length,
      label: 'Не приходят',
      kanji: '眠',
      sub: '7+ дней без визита',
      glow: churn.length > 0 ? 'glow-orange' : '',
      border: churn.length > 0 ? 'border-orange-500/40' : theme === 'dark' ? 'border-[#3A3A3C]' : 'border-[#E5E4E0]',
      numColor: churn.length > 0 ? 'text-orange-500' : theme === 'dark' ? 'text-[#48484A]' : 'text-[#C0BFBB]',
      onClick: churn.length > 0 ? () => setModal('churn') : null,
    },
  ]

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: 'var(--bg)' }}>

      {/* Hero: FujiScene background with header overlaid */}
      <div className="relative overflow-hidden">
        <FujiScene dark={theme === 'dark'} bgColor={theme === 'dark' ? '#1C1C1E' : '#F5F4F0'} />

        {/* Header overlay */}
        <div className="absolute inset-x-0 top-0 px-5 pt-8 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white text-xl font-bold leading-tight tracking-wide drop-shadow-lg">
                Школа Самурая
              </h1>
              <p className="text-white/60 text-[10px] tracking-[0.2em] uppercase mt-0.5">
                武道 · Путь воина
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative group">
                <button onClick={sendReport} disabled={notifying}
                  className="flex items-center gap-1.5 text-xs text-white/70 border border-white/20
                    bg-black/25 backdrop-blur-sm px-3 py-1.5 rounded-lg
                    hover:border-[#E8121E]/60 hover:text-[#E8121E]
                    disabled:opacity-40 transition-all duration-200">
                  <span>📨</span>
                  <span>{notifying ? 'Отправка...' : 'Отчёт'}</span>
                </button>
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#2C2C2E] border border-[#3A3A3C]
                  rounded-xl px-3 py-2 text-xs text-[#8E8E93] leading-relaxed
                  opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
                  Отправить сводку (без занятий, истекающие абонементы) в Telegram
                </div>
              </div>
              <button onClick={toggleTheme}
                title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                className="text-xs text-white/70 border border-white/20 bg-black/25 backdrop-blur-sm
                  px-2.5 py-1.5 rounded-lg hover:border-[#E8121E]/60 hover:text-[#E8121E]
                  transition-all duration-200">
                {theme === 'dark' ? '☀' : '🌙'}
              </button>
              {userName && (
                <button onClick={signOut}
                  className="text-xs text-white/70 border border-white/20 bg-black/25 backdrop-blur-sm
                    px-3 py-1.5 rounded-lg hover:text-white transition-all duration-200">
                  Выйти
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Переключатель в кабинет тренера — только для основателя-тренера */}
      {role === 'founder' && trainerId && (
        <Link href="/trainer"
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🥋</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Кабинет тренера</span>
          </div>
          <span style={{ color: 'var(--text-2)' }}>›</span>
        </Link>
      )}

      {/* Метрики */}
      <div className="px-4 pt-4 grid grid-cols-2 gap-3 mb-5">
        {metrics.map((m, i) => (
          <button
            key={i}
            onClick={m.onClick ?? undefined}
            disabled={!m.onClick}
            className={`
              relative border ${m.border} ${m.glow}
              rounded-2xl p-4 text-left overflow-hidden
              transition-all duration-300
              ${m.onClick ? 'active:scale-95 cursor-pointer' : 'cursor-default'}
            `}
            style={{ backgroundColor: 'var(--bg-card)' }}
          >
            {/* Иероглиф-фон */}
            <span className="absolute right-2 top-0 text-[52px] font-bold select-none leading-none"
              style={{ color: 'rgba(255,255,255,0.04)' }}>
              {m.kanji}
            </span>
            {/* Число */}
            <div className={`text-4xl font-bold mb-1 leading-none ${m.numColor} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}>
              {m.value}
            </div>
            <div className="text-white text-sm font-medium">{m.label}</div>
            <div className="text-[#8E8E93] text-xs mt-0.5">{m.sub}</div>
            {m.onClick && (
              <div className="absolute bottom-3 right-3 text-[#E8121E] text-sm opacity-70">›</div>
            )}
          </button>
        ))}
      </div>

      {/* Разделитель */}
      <div className="mx-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#3A3A3C]" />
          <span className="text-[#48484A] text-xs tracking-widest">道</span>
          <div className="flex-1 h-px bg-[#3A3A3C]" />
        </div>
      </div>

      {/* Навигация */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-8">
        {sections.map((s) => (
          <Link key={s.route} href={s.route}
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
            className="group relative border rounded-2xl p-4
              active:scale-95 transition-all duration-200 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#E8121E] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-t-2xl" />
            <div className="text-3xl mb-2">{s.emoji}</div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{s.label}</div>
          </Link>
        ))}
        {role === 'founder' && (
          <Link href="/admin-users"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
            className="group relative border rounded-2xl p-4
              active:scale-95 transition-all duration-200 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#E8121E] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-t-2xl" />
            <div className="text-3xl mb-2">👤</div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Сотрудники</div>
          </Link>
        )}
      </div>

      {/* Нижний декор */}
      <div className="pb-8 text-center">
        <span className="text-[#3A3A3C] text-xs tracking-[0.3em]">一期一会</span>
      </div>

      {/* Модальное окно */}
      {modal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setModal(null)}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div className="relative rounded-t-3xl max-h-[75vh] flex flex-col border-t"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            onClick={e => e.stopPropagation()}>
            {/* Ручка */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-[#48484A] rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                {modal === 'noSessions' && `Без занятий · ${noSessions.length} чел.`}
                {modal === 'expiring'   && `Истекает абонемент · ${expiring.length} чел.`}
                {modal === 'churn'      && `Не приходили 7+ дней · ${churn.length} чел.`}
              </div>
              <button onClick={() => setModal(null)}
                className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] text-lg border border-[#3A3A3C]">
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-0">
              {modal === 'noSessions' && noSessions.map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setModal(null)}
                  className="flex items-center justify-between py-3 border-b border-[#2C2C2E] hover:text-[#E8121E] transition-colors">
                  <span className="text-sm text-[#E5E5E7]">{s.name}</span>
                  <span className="text-[#48484A] text-sm">›</span>
                </Link>
              ))}
              {modal === 'expiring' && expiring.map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setModal(null)}
                  className="flex items-center justify-between py-3 border-b border-[#2C2C2E] hover:text-[#E8121E] transition-colors">
                  <span className="text-sm text-[#E5E5E7]">{s.name}</span>
                  <span className="text-[#48484A] text-sm">›</span>
                </Link>
              ))}
              {modal === 'churn' && churn.map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setModal(null)}
                  className="flex items-center justify-between py-3 border-b border-[#2C2C2E] hover:text-[#E8121E] transition-colors">
                  <span className="text-sm text-[#E5E5E7]">{s.name}</span>
                  <span className="text-orange-500 text-xs font-medium">{s.daysSince !== null ? `${s.daysSince} дн.` : '—'}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
