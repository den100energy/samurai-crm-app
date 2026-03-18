'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Ticket = {
  id: string
  student_id: string
  type: string
  description: string | null
  status: string
  created_at: string
  students: { name: string } | null
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  'болезнь':  { label: 'Болезнь',  color: 'bg-red-100 text-red-700' },
  'перенос':  { label: 'Перенос',  color: 'bg-yellow-100 text-yellow-700' },
  'жалоба':   { label: 'Жалоба',   color: 'bg-orange-100 text-orange-700' },
  'вопрос':   { label: 'Вопрос',   color: 'bg-blue-100 text-blue-700' },
}

const STATUS_NEXT: Record<string, string> = {
  pending:   'in_review',
  in_review: 'resolved',
  resolved:  'resolved',
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'Новое',
  in_review: 'В работе',
  resolved:  'Решено',
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  resolved:  'bg-green-100 text-green-700',
}

const STATUS_BTN: Record<string, string> = {
  pending:   'Взять в работу',
  in_review: 'Отметить решённым',
  resolved:  '',
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_review' | 'resolved'>('all')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('tickets')
      .select('*, students(name)')
      .order('created_at', { ascending: false })
    setTickets(data || [])
  }

  async function advance(ticket: Ticket) {
    if (ticket.status === 'resolved') return
    const next = STATUS_NEXT[ticket.status]
    await supabase.from('tickets').update({ status: next }).eq('id', ticket.id)
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: next } : t))
  }

  async function remove(id: string) {
    if (!confirm('Удалить обращение?')) return
    await supabase.from('tickets').delete().eq('id', id)
    setTickets(prev => prev.filter(t => t.id !== id))
  }

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)
  const counts = {
    pending:   tickets.filter(t => t.status === 'pending').length,
    in_review: tickets.filter(t => t.status === 'in_review').length,
    resolved:  tickets.filter(t => t.status === 'resolved').length,
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Обращения</h1>
        <span className="ml-auto text-sm text-gray-400">{tickets.length} всего</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {([['all', 'Все', tickets.length], ['pending', 'Новые', counts.pending], ['in_review', 'В работе', counts.in_review], ['resolved', 'Решено', counts.resolved]] as const).map(([val, label, count]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${filter === val ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200'}`}>
            {label} {count > 0 && <span className="ml-1 text-xs opacity-70">{count}</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-16">Обращений нет</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const typeInfo = TYPE_LABELS[t.type] || { label: t.type, color: 'bg-gray-100 text-gray-600' }
            return (
              <div key={t.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <Link href={`/students/${t.student_id}`}
                      className="font-semibold text-gray-800 text-sm hover:underline">
                      {t.students?.name || 'Неизвестный'}
                    </Link>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(t.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </div>
                </div>

                {t.description && (
                  <div className="text-sm text-gray-600 mb-3 bg-gray-50 rounded-xl p-2">{t.description}</div>
                )}

                <div className="flex items-center gap-2">
                  {t.status !== 'resolved' && (
                    <button onClick={() => advance(t)}
                      className="flex-1 text-sm bg-black text-white py-1.5 rounded-xl font-medium">
                      {STATUS_BTN[t.status]}
                    </button>
                  )}
                  {t.status === 'resolved' && (
                    <div className="flex-1 text-center text-sm text-green-600 font-medium">✓ Решено</div>
                  )}
                  <button onClick={() => remove(t.id)}
                    className="text-xs text-red-400 border border-red-100 px-3 py-1.5 rounded-xl">
                    Удалить
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
