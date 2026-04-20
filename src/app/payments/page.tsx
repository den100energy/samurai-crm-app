'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/dates'

type Sub = {
  id: string
  student_id: string
  type: string
  sessions_total: number | null
  sessions_left: number | null
  end_date: string | null
  paid: boolean
  amount: number | null
  students: { name: string } | null
}

export default function PaymentsPage() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('subscriptions')
        .select('*, students(name)')
        .order('end_date', { ascending: true })
      setSubs(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const expiringSoon = subs.filter(s => {
    if (!s.end_date) return false
    const days = Math.ceil((new Date(s.end_date).getTime() - Date.now()) / 86400000)
    return days <= 7 && days >= 0
  })

  const unpaid = subs.filter(s => !s.paid)

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Платежи и абонементы</h1>
      </div>

      {expiringSoon.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
          <div className="font-medium text-yellow-800 mb-2">⚠️ Истекают через 7 дней</div>
          {expiringSoon.map(s => (
            <div key={s.id} className="text-sm text-yellow-700">
              {s.students?.name} — до {formatDate(s.end_date!)}
            </div>
          ))}
        </div>
      )}

      {unpaid.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <div className="font-medium text-red-800 mb-2">💸 Не оплачено</div>
          {unpaid.map(s => (
            <div key={s.id} className="text-sm text-red-700 flex justify-between">
              <span>{s.students?.name} ({s.type})</span>
              <span>{s.amount ? `${s.amount} ₽` : '—'}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-gray-500 mb-2">Все абонементы ({subs.length})</div>
          {subs.map(s => (
            <div key={s.id} className="bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-800">{s.students?.name}</div>
                  <div className="text-sm text-gray-400">{s.type}</div>
                </div>
                <div className="text-right">
                  <div className={`text-xs px-2 py-0.5 rounded-full ${s.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {s.paid ? 'Оплачен' : 'Не оплачен'}
                  </div>
                  {s.sessions_left != null && (
                    <div className="text-sm text-gray-500 mt-1">{s.sessions_left}/{s.sessions_total} занятий</div>
                  )}
                  {s.end_date && <div className="text-xs text-gray-400">до {formatDate(s.end_date)}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
