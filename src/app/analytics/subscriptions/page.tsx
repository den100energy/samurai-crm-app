'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type SubRow = {
  id: string
  type: string
  start_date: string | null
  amount: number | null
  sessions_left: number | null
  end_date: string | null
  is_pending: boolean
  student_id: string
  students: { name: string } | { name: string }[] | null
}

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

function cleanType(type: string) {
  return type.includes('|') ? type.split('|')[1] : type
}

function studentName(s: SubRow): string {
  if (!s.students) return '—'
  if (Array.isArray(s.students)) return s.students[0]?.name || '—'
  return s.students.name
}

function monthKey(date: string) {
  return date.substring(0, 7)
}

function prevMonths(year: number, month: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(year, month - (count - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

function trendOf(vals: number[]): { label: string; color: string; emoji: string } {
  if (vals.length < 2) return { label: '—', color: 'text-gray-400', emoji: '➡️' }
  const n = vals.length
  const xMean = (n - 1) / 2
  const yMean = vals.reduce((a, b) => a + b, 0) / n
  const denom = vals.reduce((s, _, x) => s + (x - xMean) ** 2, 0)
  if (denom === 0) return { label: 'Стабильно', color: 'text-gray-500', emoji: '➡️' }
  const slope = vals.reduce((s, y, x) => s + (x - xMean) * (y - yMean), 0) / denom
  if (slope > 0.5) return { label: 'Рост', color: 'text-green-600', emoji: '📈' }
  if (slope < -0.5) return { label: 'Спад', color: 'text-red-500', emoji: '📉' }
  return { label: 'Стабильно', color: 'text-gray-500', emoji: '➡️' }
}

type DrillState = { type: string | null; monthKey: string | null; label: string }

export default function SubAnalyticsPage() {
  const [subs, setSubs] = useState<SubRow[]>([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth())
  const [drill, setDrill] = useState<DrillState | null>(null)

  useEffect(() => {
    supabase
      .from('subscriptions')
      .select('id, type, start_date, amount, sessions_left, end_date, is_pending, student_id, students(name)')
      .order('start_date', { ascending: false })
      .then(({ data }) => {
        setSubs((data || []) as SubRow[])
        setLoading(false)
      })
  }, [])

  const today = now.toISOString().split('T')[0]
  const curKey = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`
  const last3 = prevMonths(selYear, selMonth, 3)
  const last6 = prevMonths(selYear, selMonth, 6)

  const paid = subs.filter(s => !s.is_pending && s.start_date)

  function subsInMonth(mk: string) {
    return paid.filter(s => monthKey(s.start_date!) === mk)
  }

  function isActive(s: SubRow) {
    return !s.is_pending &&
      (s.sessions_left === null || s.sessions_left > 0) &&
      (s.end_date === null || s.end_date >= today)
  }

  const activeSubs = subs.filter(isActive)
  const curMonthSubs = subsInMonth(curKey)
  const curRevenue = curMonthSubs.reduce((sum, s) => sum + (s.amount || 0), 0)

  // All unique types
  const allTypes = Array.from(new Set(paid.map(s => cleanType(s.type)))).sort()

  // Top-3 this month
  const typeCountCur: Record<string, { count: number; revenue: number }> = {}
  curMonthSubs.forEach(s => {
    const t = cleanType(s.type)
    if (!typeCountCur[t]) typeCountCur[t] = { count: 0, revenue: 0 }
    typeCountCur[t].count++
    typeCountCur[t].revenue += s.amount || 0
  })
  const top3 = Object.entries(typeCountCur)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)

  // Total by month (last 6 for chart, last 3 for trend)
  const totalLast6 = last6.map(mk => subsInMonth(mk).length)
  const totalLast3 = last3.map(mk => subsInMonth(mk).length)
  const totalRevLast3 = last3.map(mk => subsInMonth(mk).reduce((s, r) => s + (r.amount || 0), 0))
  const totalTrend = trendOf(totalLast3)
  const revTrend = trendOf(totalRevLast3)

  // Per-type rows
  const typeRows = allTypes.map(type => {
    const counts3 = last3.map(mk => subsInMonth(mk).filter(s => cleanType(s.type) === type).length)
    const totalSold = paid.filter(s => cleanType(s.type) === type).length
    const activeNow = activeSubs.filter(s => cleanType(s.type) === type).length
    const totalRev = paid.filter(s => cleanType(s.type) === type).reduce((s, r) => s + (r.amount || 0), 0)
    return { type, counts3, trend: trendOf(counts3), totalSold, activeNow, totalRev }
  }).sort((a, b) => b.totalSold - a.totalSold)

  // Drill students
  const drillStudents = drill
    ? (drill.monthKey
        ? subsInMonth(drill.monthKey).filter(s => !drill.type || cleanType(s.type) === drill.type)
        : activeSubs.filter(s => !drill.type || cleanType(s.type) === drill.type))
    : []

  function navMonth(dir: -1 | 1) {
    const d = new Date(selYear, selMonth + dir, 1)
    setSelYear(d.getFullYear())
    setSelMonth(d.getMonth())
  }

  function openDrill(type: string | null, mk: string | null, label: string) {
    setDrill(d => d?.type === type && d?.monthKey === mk ? null : { type, monthKey: mk, label })
  }

  if (loading) return <main className="max-w-lg mx-auto p-4"><div className="text-center py-20 text-gray-400">Загрузка...</div></main>

  const podiumOrder = [1, 0, 2] // silver, gold, bronze visual order

  return (
    <main className="max-w-lg mx-auto p-4 pb-10">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/analytics" className="text-gray-500 hover:text-black text-xl font-bold">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Аналитика абонементов</h1>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between mb-5 bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm">
        <button onClick={() => navMonth(-1)} className="text-gray-400 hover:text-black text-lg px-2">‹</button>
        <div className="text-center">
          <div className="font-semibold text-gray-800">{MONTHS_RU[selMonth]} {selYear}</div>
          <div className="text-xs text-gray-400">выбранный период</div>
        </div>
        <button onClick={() => navMonth(1)} disabled={curKey >= monthKey(today)}
          className="text-gray-400 hover:text-black text-lg px-2 disabled:opacity-30">›</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: 'Активных', value: activeSubs.length, sub: 'сейчас', onClick: () => openDrill(null, null, 'Все активные') },
          { label: 'Продано', value: curMonthSubs.length, sub: MONTHS_RU[selMonth], onClick: () => openDrill(null, curKey, `Продажи ${MONTHS_RU[selMonth]}`) },
          { label: 'Выручка', value: curRevenue.toLocaleString('ru-RU') + ' ₽', sub: MONTHS_RU[selMonth], onClick: undefined },
        ].map(c => (
          <button key={c.label} onClick={c.onClick}
            className={`bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center ${c.onClick ? 'hover:border-gray-300 active:bg-gray-50' : ''}`}>
            <div className="text-xl font-bold text-gray-800">{c.value}</div>
            <div className="text-xs font-medium text-gray-500">{c.label}</div>
            <div className="text-xs text-gray-400">{c.sub}</div>
          </button>
        ))}
      </div>

      {/* Drill panel */}
      {drill && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm mb-5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="font-semibold text-sm text-gray-800">{drill.label}</div>
            <button onClick={() => setDrill(null)} className="text-gray-400 hover:text-black text-sm">✕</button>
          </div>
          {drillStudents.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-4">Нет данных</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {drillStudents.map(s => (
                <Link key={s.id} href={`/students/${s.student_id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{studentName(s)}</div>
                    <div className="text-xs text-gray-400">{cleanType(s.type)}{s.start_date ? ` · с ${s.start_date}` : ''}</div>
                  </div>
                  {s.amount && <div className="text-sm text-gray-500">{s.amount.toLocaleString()} ₽</div>}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top-3 */}
      {top3.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-5">
          <div className="font-semibold text-gray-800 text-sm mb-3">
            Топ-3 за {MONTHS_RU[selMonth]}
          </div>
          <div className="flex items-end justify-center gap-2">
            {podiumOrder.map(pos => {
              if (!top3[pos]) return <div key={pos} className="flex-1" />
              const [type, data] = top3[pos]
              const heights = ['h-16', 'h-24', 'h-12']
              const medals = ['🥈', '🥇', '🥉']
              const colors = ['bg-gray-100', 'bg-yellow-50 border border-yellow-200', 'bg-orange-50']
              return (
                <button key={type}
                  onClick={() => openDrill(type, curKey, `${type} — ${MONTHS_RU[selMonth]}`)}
                  className={`flex-1 ${heights[pos]} ${colors[pos]} rounded-xl flex flex-col items-center justify-end pb-2 px-1 hover:opacity-80`}>
                  <div className="text-base leading-none">{medals[pos]}</div>
                  <div className="text-xs font-bold text-gray-700 mt-1 text-center leading-tight">{type}</div>
                  <div className="text-xs text-gray-500">{data.count} шт.</div>
                  {data.revenue > 0 && <div className="text-xs text-gray-400">{data.revenue.toLocaleString()} ₽</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Total per month + trend */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800 text-sm">Всего продано по месяцам</div>
          <span className={`text-xs font-medium ${totalTrend.color}`}>{totalTrend.emoji} {totalTrend.label}</span>
        </div>
        {/* Bar chart */}
        <div className="flex items-end gap-1.5 h-20 mb-1">
          {last6.map((mk, i) => {
            const count = totalLast6[i]
            const maxVal = Math.max(...totalLast6, 1)
            const pct = Math.max((count / maxVal) * 100, count > 0 ? 8 : 0)
            const isCurrentMonth = mk === curKey
            return (
              <button key={mk}
                onClick={() => count > 0 && openDrill(null, mk, `Все продажи ${mk}`)}
                className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full">
                <span className="text-xs text-gray-500 font-medium">{count > 0 ? count : ''}</span>
                <div
                  style={{ height: `${pct}%` }}
                  className={`w-full rounded-t-md transition-all ${isCurrentMonth ? 'bg-black' : 'bg-gray-200 hover:bg-gray-300'}`} />
              </button>
            )
          })}
        </div>
        <div className="flex gap-1.5">
          {last6.map(mk => {
            const [y, m] = mk.split('-')
            return (
              <div key={mk} className="flex-1 text-center text-xs text-gray-400">
                {MONTHS_RU[parseInt(m) - 1].slice(0, 3)}
              </div>
            )
          })}
        </div>
        {/* Revenue trend line */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-500">Тренд выручки (3 мес.)</div>
          <span className={`text-xs font-medium ${revTrend.color}`}>{revTrend.emoji} {revTrend.label}</span>
        </div>
        <div className="flex gap-2 mt-1">
          {last3.map((mk, i) => {
            const rev = totalRevLast3[i]
            const [, m] = mk.split('-')
            return (
              <div key={mk} className="flex-1 text-center">
                <div className="text-xs text-gray-400">{MONTHS_RU[parseInt(m) - 1].slice(0, 3)}</div>
                <div className="text-xs font-medium text-gray-700">{rev > 0 ? rev.toLocaleString() + ' ₽' : '—'}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Trends by type */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="font-semibold text-gray-800 text-sm">Тренды по видам абонементов</div>
          <div className="text-xs text-gray-400 mt-0.5">последние 3 месяца · нажми для детализации</div>
        </div>
        {/* Header */}
        <div className="flex items-center px-4 py-1.5 border-b border-gray-50 bg-gray-50">
          <div className="flex-1 text-xs text-gray-400">Тип</div>
          {last3.map(mk => {
            const [, m] = mk.split('-')
            return <div key={mk} className="w-8 text-center text-xs text-gray-400">{MONTHS_RU[parseInt(m) - 1].slice(0, 3)}</div>
          })}
          <div className="w-10 text-center text-xs text-gray-400">Тренд</div>
          <div className="w-12 text-right text-xs text-gray-400">Актив.</div>
        </div>
        {typeRows.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">Нет данных</div>
        ) : (
          typeRows.map(row => (
            <div key={row.type} className="border-b border-gray-50 last:border-0">
              <button
                onClick={() => openDrill(row.type, curKey, `${row.type} — ${MONTHS_RU[selMonth]}`)}
                className="w-full flex items-center px-4 py-2.5 hover:bg-gray-50 text-left">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{row.type}</div>
                  <div className="text-xs text-gray-400">Всего: {row.totalSold} · {row.totalRev > 0 ? row.totalRev.toLocaleString() + ' ₽' : 'без суммы'}</div>
                </div>
                {row.counts3.map((c, i) => (
                  <div key={i} className={`w-8 text-center text-sm ${c > 0 ? 'font-medium text-gray-700' : 'text-gray-300'}`}>{c || '—'}</div>
                ))}
                <div className={`w-10 text-center text-xs font-medium ${row.trend.color}`}>{row.trend.emoji}</div>
                <div className="w-12 text-right">
                  <button
                    onClick={e => { e.stopPropagation(); openDrill(row.type, null, `Активные: ${row.type}`) }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {row.activeNow}
                  </button>
                </div>
              </button>
            </div>
          ))
        )}
      </div>

      {/* All-time ranking */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="font-semibold text-gray-800 text-sm">Рейтинг за всё время</div>
        </div>
        {typeRows.map((row, i) => (
          <div key={row.type}
            className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0">
            <div className={`w-6 text-sm font-bold mr-3 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
              #{i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{row.type}</div>
              <div className="text-xs text-gray-400">
                {row.totalSold} продано · {row.activeNow} активных
                {row.totalRev > 0 ? ` · ${row.totalRev.toLocaleString()} ₽` : ''}
              </div>
            </div>
            <span className={`text-xs ${row.trend.color}`}>{row.trend.emoji}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
