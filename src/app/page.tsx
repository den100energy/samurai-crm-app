'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { SECTIONS, hasAccess } from '@/lib/auth'
import { useTheme } from '@/components/ThemeProvider'
import { FujiScene } from '@/components/FujiScene'
import { OnboardingHint } from '@/components/OnboardingHint'
import { resetAllHints } from '@/lib/onboarding'

export default function Home() {
  const { role, userName, trainerId, permissions } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const router = useRouter()
  const [expiring, setExpiring] = useState<{ id: string; name: string }[]>([])
  const [noSessions, setNoSessions] = useState<{ id: string; name: string }[]>([])
  const [churn, setChurn] = useState<{ id: string; name: string; daysSince: number | null }[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [activeStudents, setActiveStudents] = useState<{ id: string; name: string }[]>([])
  const [notifying, setNotifying] = useState(false)
  const [pendingReady, setPendingReady] = useState<{ id: string; name: string }[]>([])
  const [modal, setModal] = useState<'noSessions' | 'expiring' | 'churn' | 'pendingReady' | 'activeStudents' | null>(null)
  const [loaded, setLoaded] = useState(false)
  type SurveyStage = 'needSurvey' | 'notified' | 'trainerDone' | 'filled'
  const [surveyFunnel, setSurveyFunnel] = useState<Record<SurveyStage, { id: string; name: string }[]> | null>(null)
  const [surveyFunnelModal, setSurveyFunnelModal] = useState<SurveyStage | null>(null)
  type CrmStatus = 'onboarding' | 'active' | 'at_risk' | 'established' | 'lapsed'
  const [crmFunnel, setCrmFunnel] = useState<Record<CrmStatus, { id: string; name: string }[]> | null>(null)
  const [crmModal, setCrmModal] = useState<CrmStatus | null>(null)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      const ago30days = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

      const [{ data: students }, { data: allSubs }, { data: recentAtt }, { data: allSurveys }] = await Promise.all([
        supabase.from('students').select('id, name, crm_status').eq('status', 'active'),
        supabase.from('subscriptions').select('student_id, sessions_left, end_date, is_pending').order('created_at', { ascending: false }),
        supabase.from('attendance').select('student_id, date').eq('present', true).gte('date', ago30days).order('date', { ascending: false }),
        supabase.from('progress_surveys').select('student_id, filled_at, parent_sent_at, trainer_filled_at, created_at').order('created_at', { ascending: false }),
      ])

      if (!students) return

      // Для каждого студента: первый НЕ-pending абонемент (последний по created_at)
      const subMap = new Map<string, { sessions_left: number | null; end_date: string | null; is_pending: boolean }>()
      // Также собираем pending абонементы
      const pendingMap = new Map<string, boolean>()
      for (const s of (allSubs || [])) {
        if (!s.is_pending && !subMap.has(s.student_id)) subMap.set(s.student_id, s)
        if (s.is_pending) pendingMap.set(s.student_id, true)
      }

      const lastDateMap = new Map<string, string>()
      for (const a of (recentAtt || [])) {
        if (!lastDateMap.has(a.student_id)) lastDateMap.set(a.student_id, a.date)
      }

      const noSessArr: any[] = []
      const expiringArr: any[] = []
      const churnArr: { id: string; name: string; daysSince: number | null }[] = []
      const pendingReadyArr: { id: string; name: string }[] = []

      for (const student of students) {
        const sub = subMap.get(student.id)
        const hasPending = pendingMap.has(student.id)
        const subExpired = sub && sub.end_date && sub.end_date < today
        if (!sub || sub.sessions_left === 0 || subExpired) noSessArr.push({ id: student.id, name: student.name })
        // Если нет активного абонемента, но есть pending — добавляем в "ожидают активации"
        const hasActiveSub2 = sub && (sub.sessions_left === null || sub.sessions_left > 0) && (!sub.end_date || sub.end_date >= today)
        if (!hasActiveSub2 && hasPending) pendingReadyArr.push({ id: student.id, name: student.name })
        if (sub?.end_date && sub.end_date >= today && sub.end_date <= in7days && (sub.sessions_left === null || sub.sessions_left > 0)) expiringArr.push({ id: student.id, name: student.name })
        const hasActiveSub = sub && (sub.sessions_left ?? 0) > 0 && (!sub.end_date || sub.end_date >= today)
        if (hasActiveSub) {
          const lastDate = lastDateMap.get(student.id)
          const daysSince = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : null
          if (daysSince === null || daysSince >= 7) churnArr.push({ id: student.id, name: student.name, daysSince })
        }
      }

      churnArr.sort((a, b) => (b.daysSince ?? 999) - (a.daysSince ?? 999))

      const activeStudentsArr: { id: string; name: string }[] = []
      for (const student of students) {
        const sub = subMap.get(student.id)
        const hasActiveSub = sub && (sub.sessions_left === null || sub.sessions_left > 0) && (!sub.end_date || sub.end_date >= today)
        if (hasActiveSub) activeStudentsArr.push({ id: student.id, name: student.name })
      }

      setTotalStudents(students.length)
      setActiveStudents(activeStudentsArr)
      setNoSessions(noSessArr)
      setExpiring(expiringArr)
      setChurn(churnArr)
      setPendingReady(pendingReadyArr)

      // Воронка срезов
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      // Последний срез на каждого студента
      const latestSurveyMap = new Map<string, { filled_at: string | null; parent_sent_at: string | null; trainer_filled_at: string | null; created_at: string }>()
      for (const s of (allSurveys || [])) {
        if (!latestSurveyMap.has(s.student_id)) latestSurveyMap.set(s.student_id, s)
      }
      const needSurveyArr: { id: string; name: string }[] = []
      const notifiedArr: { id: string; name: string }[] = []
      const trainerDoneArr: { id: string; name: string }[] = []
      const filledArr: { id: string; name: string }[] = []
      for (const student of students) {
        const latest = latestSurveyMap.get(student.id)
        if (!latest || (latest.filled_at && new Date(latest.filled_at) < threeMonthsAgo)) {
          needSurveyArr.push(student)
        } else if (latest && !latest.filled_at && latest.parent_sent_at) {
          notifiedArr.push(student)
        } else if (latest && latest.trainer_filled_at && !latest.filled_at && !latest.parent_sent_at) {
          trainerDoneArr.push(student)
        }
        if (latest?.filled_at && new Date(latest.filled_at) >= threeMonthsAgo) {
          filledArr.push(student)
        }
      }
      setSurveyFunnel({ needSurvey: needSurveyArr, notified: notifiedArr, trainerDone: trainerDoneArr, filled: filledArr })

      // CRM-воронка по статусам
      const crmBuckets: Record<string, { id: string; name: string }[]> = {
        onboarding: [], active: [], at_risk: [], established: [], lapsed: [],
      }
      for (const s of students) {
        const status = (s as any).crm_status ?? 'active'
        if (status in crmBuckets) crmBuckets[status].push({ id: s.id, name: s.name })
        else crmBuckets['active'].push({ id: s.id, name: s.name })
      }
      setCrmFunnel(crmBuckets as any)

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
      sub: 'всего в школе',
      glow: '',
      border: theme === 'dark' ? 'border-[#3A3A3C]' : 'border-[#E5E4E0]',
      numColor: theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]',
      onClick: (() => router.push('/students')) as (() => void) | null,
    },
    {
      value: activeStudents.length,
      label: 'С абонементом',
      kanji: '活',
      sub: 'активный абонемент',
      glow: activeStudents.length > 0 ? 'glow-green' : '',
      border: activeStudents.length > 0 ? 'border-green-500/40' : theme === 'dark' ? 'border-[#3A3A3C]' : 'border-[#E5E4E0]',
      numColor: activeStudents.length > 0 ? 'text-green-500' : theme === 'dark' ? 'text-[#48484A]' : 'text-[#C0BFBB]',
      onClick: activeStudents.length > 0 ? () => setModal('activeStudents') : null,
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
      value: pendingReady.length,
      label: 'Ждут активации',
      kanji: '待',
      sub: 'отложенный абонемент',
      glow: pendingReady.length > 0 ? 'glow-amber' : '',
      border: pendingReady.length > 0 ? 'border-amber-500/40' : theme === 'dark' ? 'border-[#3A3A3C]' : 'border-[#E5E4E0]',
      numColor: pendingReady.length > 0 ? 'text-amber-500' : theme === 'dark' ? 'text-[#48484A]' : 'text-[#C0BFBB]',
      onClick: pendingReady.length > 0 ? () => setModal('pendingReady') : null,
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
              {role === 'founder' && (
                <button
                  onClick={() => { resetAllHints(); window.location.reload() }}
                  title="Показать подсказки заново"
                  className="text-xs text-white/70 border border-white/20 bg-black/25 backdrop-blur-sm
                    px-2.5 py-1.5 rounded-lg hover:border-amber-400/60 hover:text-amber-300
                    transition-all duration-200">
                  💡
                </button>
              )}
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

      {/* Онбординг-хинт для новых пользователей */}
      {loaded && totalStudents === 0 && (
        <OnboardingHint id="dashboard_welcome" className="mx-4 mb-4" />
      )}

      {/* Воронка срезов прогресса */}
      {surveyFunnel && (
        <div className="mx-4 mb-5 rounded-2xl overflow-hidden border"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>📊 Срезы прогресса</span>
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>за 3 мес.</span>
          </div>
          <div className="grid grid-cols-4 divide-x" style={{ borderColor: 'var(--border)' }}>
            {([
              { label: 'Пора', count: surveyFunnel.needSurvey.length, stage: 'needSurvey' as const, color: 'text-amber-500' },
              { label: 'Отправлено', count: surveyFunnel.notified.length, stage: 'notified' as const, color: 'text-blue-400' },
              { label: 'Тренер ✓', count: surveyFunnel.trainerDone.length, stage: 'trainerDone' as const, color: 'text-purple-400' },
              { label: 'Заполнили', count: surveyFunnel.filled.length, stage: 'filled' as const, color: 'text-green-500' },
            ]).map(item => (
              <button key={item.stage}
                onClick={() => item.count > 0 ? setSurveyFunnelModal(item.stage) : undefined}
                disabled={item.count === 0}
                className="py-3 px-1 text-center transition-opacity disabled:opacity-40">
                <div className={`text-2xl font-bold leading-none ${item.count > 0 ? item.color : ''}`}
                  style={{ color: item.count === 0 ? 'var(--text-2)' : undefined }}>
                  {item.count}
                </div>
                <div className="text-[10px] mt-1 leading-tight" style={{ color: 'var(--text-2)' }}>{item.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CRM-воронка учеников */}
      {crmFunnel && (
        <div className="mx-4 mb-5 rounded-2xl overflow-hidden border"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>🎯 Статус учеников</span>
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>CRM-воронка</span>
          </div>
          <div className="grid grid-cols-5 divide-x" style={{ borderColor: 'var(--border)' }}>
            {([
              { key: 'onboarding' as CrmStatus, label: 'Старт',    color: 'text-blue-400'   },
              { key: 'active'     as CrmStatus, label: 'Активны',  color: 'text-green-500'  },
              { key: 'at_risk'    as CrmStatus, label: 'Риск',     color: 'text-[#E8121E]'  },
              { key: 'established'as CrmStatus, label: 'Лояльны',  color: 'text-purple-400' },
              { key: 'lapsed'     as CrmStatus, label: 'Спящие',   color: 'text-amber-500'  },
            ]).map(item => {
              const count = crmFunnel[item.key]?.length ?? 0
              return (
                <button key={item.key}
                  onClick={() => count > 0 ? setCrmModal(item.key) : undefined}
                  disabled={count === 0}
                  className="py-3 px-1 text-center transition-opacity disabled:opacity-40">
                  <div className={`text-2xl font-bold leading-none ${count > 0 ? item.color : ''}`}
                    style={{ color: count === 0 ? 'var(--text-2)' : undefined }}>
                    {count}
                  </div>
                  <div className="text-[10px] mt-1 leading-tight" style={{ color: 'var(--text-2)' }}>
                    {item.label}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

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
                {modal === 'noSessions'      && `Без занятий · ${noSessions.length} чел.`}
                {modal === 'expiring'        && `Истекает абонемент · ${expiring.length} чел.`}
                {modal === 'churn'           && `Не приходили 7+ дней · ${churn.length} чел.`}
                {modal === 'pendingReady'    && `Ждут активации · ${pendingReady.length} чел.`}
                {modal === 'activeStudents'  && `С активным абонементом · ${activeStudents.length} чел.`}
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
              {modal === 'pendingReady' && pendingReady.map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setModal(null)}
                  className="flex items-center justify-between py-3 border-b border-[#2C2C2E] hover:text-amber-500 transition-colors">
                  <span className="text-sm text-[#E5E5E7]">{s.name}</span>
                  <span className="text-amber-500 text-xs font-medium">⏳ активировать</span>
                </Link>
              ))}
              {modal === 'activeStudents' && activeStudents.map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setModal(null)}
                  className="flex items-center justify-between py-3 border-b border-[#2C2C2E] hover:text-green-500 transition-colors">
                  <span className="text-sm text-[#E5E5E7]">{s.name}</span>
                  <span className="text-[#48484A] text-sm">›</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Модал воронки срезов */}
      {surveyFunnelModal && surveyFunnel && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setSurveyFunnelModal(null)}>
          <div className="w-full rounded-t-3xl flex flex-col max-h-[70vh]"
            style={{ backgroundColor: 'var(--bg-card)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-[#48484A] rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                {surveyFunnelModal === 'needSurvey'   && `Пора пройти срез · ${surveyFunnel.needSurvey.length} чел.`}
                {surveyFunnelModal === 'notified'     && `Анкета отправлена · ${surveyFunnel.notified.length} чел.`}
                {surveyFunnelModal === 'trainerDone'  && `Тренер оценил · ${surveyFunnel.trainerDone.length} чел.`}
                {surveyFunnelModal === 'filled'       && `Заполнили анкету · ${surveyFunnel.filled.length} чел.`}
              </div>
              <button onClick={() => setSurveyFunnelModal(null)}
                className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] text-lg border border-[#3A3A3C]">
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-3">
              {surveyFunnel[surveyFunnelModal].map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setSurveyFunnelModal(null)}
                  className="flex items-center justify-between py-3 border-b border-[#2C2C2E] hover:text-[#E8121E] transition-colors">
                  <span className="text-sm" style={{ color: 'var(--text-1)' }}>{s.name}</span>
                  <span className="text-[#48484A] text-sm">›</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Модал CRM-воронки */}
      {crmModal && crmFunnel && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setCrmModal(null)}>
          <div className="w-full rounded-t-3xl flex flex-col max-h-[70vh]"
            style={{ backgroundColor: 'var(--bg-card)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-[#48484A] rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                {crmModal === 'onboarding'  && `Старт (первые 30 дней) · ${crmFunnel.onboarding.length} чел.`}
                {crmModal === 'active'      && `Активные ученики · ${crmFunnel.active.length} чел.`}
                {crmModal === 'at_risk'     && `⚠️ Зона риска · ${crmFunnel.at_risk.length} чел.`}
                {crmModal === 'established' && `Лояльные (6+ мес.) · ${crmFunnel.established.length} чел.`}
                {crmModal === 'lapsed'      && `Спящие · ${crmFunnel.lapsed.length} чел.`}
              </div>
              <button onClick={() => setCrmModal(null)}
                className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] text-lg border border-[#3A3A3C]">
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-3">
              {crmFunnel[crmModal].map(s => (
                <Link key={s.id} href={`/students/${s.id}`} onClick={() => setCrmModal(null)}
                  className="flex items-center justify-between py-3 border-b border-[#2C2C2E] hover:text-[#E8121E] transition-colors">
                  <span className="text-sm" style={{ color: 'var(--text-1)' }}>{s.name}</span>
                  <span className="text-[#48484A] text-sm">›</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
