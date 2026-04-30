'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type SubStats = { active: number; expiring7: number; revenueMonth: number; loading: boolean }
type ChurnStats = { total: number; riskZone: number; safe: number; loading: boolean }
type CabinetStats = { studentsLinked: number; parentsLinked: number; notLinked: number; loading: boolean }

function MiniStat({
  value,
  label,
  color = 'text-gray-800',
}: {
  value: number | string
  label: string
  color?: string
}) {
  return (
    <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center min-w-0">
      <div className={`text-xl font-bold ${color} leading-tight`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5 leading-tight">{label}</div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [subStats, setSubStats] = useState<SubStats>({ active: 0, expiring7: 0, revenueMonth: 0, loading: true })
  const [churnStats, setChurnStats] = useState<ChurnStats>({ total: 0, riskZone: 0, safe: 0, loading: true })
  const [cabinetStats, setCabinetStats] = useState<CabinetStats>({ studentsLinked: 0, parentsLinked: 0, notLinked: 0, loading: true })

  useEffect(() => {
    loadSubStats()
    loadChurnStats()
    loadCabinetStats()
  }, [])

  async function loadSubStats() {
    const today = new Date().toISOString().split('T')[0]
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    const monthStart = today.substring(0, 7) + '-01'

    const { data } = await supabase
      .from('subscriptions')
      .select('sessions_left, end_date, amount, start_date, is_pending')

    if (!data) { setSubStats(s => ({ ...s, loading: false })); return }

    const active = data.filter(s =>
      !s.is_pending &&
      (s.sessions_left === null || s.sessions_left > 0) &&
      (!s.end_date || s.end_date >= today)
    )
    const expiring7 = active.filter(s => s.end_date && s.end_date <= in7).length
    const revenueMonth = data
      .filter(s => s.start_date && s.start_date >= monthStart)
      .reduce((sum, s) => sum + (s.amount || 0), 0)

    setSubStats({ active: active.length, expiring7, revenueMonth, loading: false })
  }

  async function loadChurnStats() {
    const d10 = new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0]

    const [studentsRes, attendanceRes] = await Promise.all([
      supabase.from('students').select('id').eq('status', 'active'),
      supabase.from('attendance').select('student_id').gte('date', d10).eq('present', true),
    ])

    const students = studentsRes.data || []
    const recentIds = new Set((attendanceRes.data || []).map(a => a.student_id))
    const total = students.length
    const riskZone = students.filter(s => !recentIds.has(s.id)).length
    const safe = total - riskZone

    setChurnStats({ total, riskZone, safe, loading: false })
  }

  async function loadCabinetStats() {
    const [studentsRes, contactsRes] = await Promise.all([
      supabase.from('students').select('id, telegram_chat_id').eq('status', 'active'),
      supabase.from('student_contacts').select('id, telegram_chat_id'),
    ])

    const students = studentsRes.data || []
    const contacts = contactsRes.data || []

    const allIds = [...students.map(s => s.id), ...contacts.map(c => c.id)]
    let channelMap: Record<string, string[]> = {}
    if (allIds.length > 0) {
      const res = await fetch(`/api/user-channels?user_ids=${allIds.join(',')}`)
      if (res.ok) channelMap = await res.json()
    }

    const studentsLinked = students.filter(s => s.telegram_chat_id != null || (channelMap[s.id]?.length ?? 0) > 0).length
    const notLinked = students.length - studentsLinked
    const parentsLinked = contacts.filter(c => c.telegram_chat_id != null || (channelMap[c.id]?.length ?? 0) > 0).length

    setCabinetStats({ studentsLinked, parentsLinked, notLinked, loading: false })
  }

  function formatRevenue(n: number) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}м`
    if (n >= 1000) return `${Math.round(n / 1000)}к`
    return String(n)
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Аналитика</h1>
      </div>

      <div className="space-y-4">

        {/* ── Абонементы ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <Link href="/analytics/subscriptions"
            className="flex items-center justify-between px-4 pt-4 pb-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <div>
                <div className="font-semibold text-gray-800 text-sm">Абонементы</div>
                <div className="text-xs text-gray-400">Тренды, топ-3, рейтинг по видам</div>
              </div>
            </div>
            <span className="text-gray-300 text-xl">›</span>
          </Link>
          <div className="flex gap-2 px-4 pb-4">
            {subStats.loading ? (
              <div className="text-xs text-gray-400 py-2 pl-1">Загрузка...</div>
            ) : (
              <>
                <MiniStat value={subStats.active} label="активных" color="text-blue-600" />
                <MiniStat
                  value={subStats.expiring7}
                  label="истекают в 7 дн."
                  color={subStats.expiring7 > 0 ? 'text-orange-500' : 'text-gray-800'}
                />
                <MiniStat
                  value={formatRevenue(subStats.revenueMonth)}
                  label="выручка мес."
                  color="text-green-600"
                />
              </>
            )}
          </div>
        </div>

        {/* ── Зона риска ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <Link href="/analytics/churn"
            className="flex items-center justify-between px-4 pt-4 pb-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <div>
                <div className="font-semibold text-gray-800 text-sm">Ученики — посещаемость</div>
                <div className="text-xs text-gray-400">Зона риска, отток, активность</div>
              </div>
            </div>
            <span className="text-gray-300 text-xl">›</span>
          </Link>
          <div className="flex gap-2 px-4 pb-4">
            {churnStats.loading ? (
              <div className="text-xs text-gray-400 py-2 pl-1">Загрузка...</div>
            ) : (
              <>
                <MiniStat value={churnStats.total} label="активных уч." />
                <MiniStat
                  value={churnStats.riskZone}
                  label="зона риска"
                  color={churnStats.riskZone > 0 ? 'text-red-500' : 'text-gray-800'}
                />
                <MiniStat value={churnStats.safe} label="посещают" color="text-green-600" />
              </>
            )}
          </div>
        </div>

        {/* ── Кабинеты / Telegram ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <Link href="/analytics/cabinets"
            className="flex items-center justify-between px-4 pt-4 pb-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <div>
                <div className="font-semibold text-gray-800 text-sm">Кабинеты / Мессенджеры</div>
                <div className="text-xs text-gray-400">Подключение учеников и родителей</div>
              </div>
            </div>
            <span className="text-gray-300 text-xl">›</span>
          </Link>
          <div className="flex gap-2 px-4 pb-4">
            {cabinetStats.loading ? (
              <div className="text-xs text-gray-400 py-2 pl-1">Загрузка...</div>
            ) : (
              <>
                <MiniStat value={cabinetStats.studentsLinked} label="учеников" color="text-green-600" />
                <MiniStat value={cabinetStats.parentsLinked} label="родителей" color="text-blue-600" />
                <MiniStat
                  value={cabinetStats.notLinked}
                  label="без мессенджеров"
                  color={cabinetStats.notLinked > 0 ? 'text-orange-500' : 'text-gray-800'}
                />
              </>
            )}
          </div>
        </div>

      </div>
    </main>
  )
}
