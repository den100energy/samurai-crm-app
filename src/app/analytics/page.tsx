'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type StudentStat = {
  id: string
  name: string
  group_name: string | null
  last_visit: string | null
  visits_30: number
  days_absent: number
}

const GROUPS = ['Все', 'Старт', 'Основная (нач.)', 'Основная (оп.)', 'Цигун', 'Индивидуальные']

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StudentStat[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Все')
  const [tab, setTab] = useState<'churn' | 'all'>('churn')

  useEffect(() => {
    async function load() {
      const today = new Date()
      const d30 = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0]

      const { data: students } = await supabase
        .from('students')
        .select('id, name, group_name')
        .eq('status', 'active')
        .order('name')

      if (!students) return

      const result: StudentStat[] = await Promise.all(students.map(async s => {
        const { data: visits } = await supabase
          .from('attendance')
          .select('date')
          .eq('student_id', s.id)
          .eq('present', true)
          .gte('date', d30)
          .order('date', { ascending: false })

        const lastVisit = visits?.[0]?.date || null
        const daysAbsent = lastVisit
          ? Math.floor((today.getTime() - new Date(lastVisit).getTime()) / 86400000)
          : 999

        return {
          id: s.id,
          name: s.name,
          group_name: s.group_name,
          last_visit: lastVisit,
          visits_30: visits?.length || 0,
          days_absent: daysAbsent,
        }
      }))

      setStats(result)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = stats.filter(s =>
    filter === 'Все' || s.group_name === filter
  )

  const churnRisk = filtered.filter(s => s.days_absent >= 10).sort((a, b) => b.days_absent - a.days_absent)
  const allSorted = [...filtered].sort((a, b) => b.visits_30 - a.visits_30)

  const displayed = tab === 'churn' ? churnRisk : allSorted

  function absentColor(days: number) {
    if (days >= 21) return 'text-red-600 font-bold'
    if (days >= 10) return 'text-orange-500 font-medium'
    return 'text-green-600'
  }

  function absentLabel(days: number) {
    if (days === 999) return 'Не был ни разу'
    if (days === 0) return 'Сегодня'
    return `${days} дн. назад`
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Аналитика</h1>
      </div>

      {/* Итоги */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <div className="text-2xl font-bold text-gray-800">{filtered.length}</div>
            <div className="text-xs text-gray-400">учеников</div>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <div className="text-2xl font-bold text-red-500">{churnRisk.length}</div>
            <div className="text-xs text-gray-400">зона риска</div>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <div className="text-2xl font-bold text-green-600">
              {filtered.filter(s => s.days_absent < 10).length}
            </div>
            <div className="text-xs text-gray-400">активных</div>
          </div>
        </div>
      )}

      {/* Фильтр групп */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {GROUPS.map(g => (
          <button key={g} onClick={() => setFilter(g)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filter === g ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {g}
          </button>
        ))}
      </div>

      {/* Табы */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('churn')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
            ${tab === 'churn' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
          🚨 Зона риска ({churnRisk.length})
        </button>
        <button onClick={() => setTab('all')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
            ${tab === 'all' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
          📊 Все ученики
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : displayed.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          {tab === 'churn' ? '✅ Нет учеников в зоне риска!' : 'Нет данных'}
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(s => (
            <Link key={s.id} href={`/students/${s.id}`}
              className="flex items-center bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 mr-3">
                {s.name[0]}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{s.name}</div>
                <div className="text-xs text-gray-400">{s.group_name || '—'}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm ${absentColor(s.days_absent)}`}>
                  {absentLabel(s.days_absent)}
                </div>
                <div className="text-xs text-gray-400">{s.visits_30} посещ. за 30 дн.</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
