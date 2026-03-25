'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Ticket = {
  id: string
  student_id: string
  type: string
  description: string | null
  status: string
  created_at: string
  taken_by: string | null
  taken_at: string | null
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
  students: { name: string } | null
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  'болезнь':   { label: '🤒 Болезнь',    color: 'bg-red-100 text-red-700' },
  'перенос':   { label: '🔄 Перенос',    color: 'bg-yellow-100 text-yellow-700' },
  'жалоба':    { label: '⚠️ Жалоба',    color: 'bg-orange-100 text-orange-700' },
  'вопрос':    { label: '❓ Вопрос',     color: 'bg-blue-100 text-blue-700' },
  'crm_задача':{ label: '🎯 CRM-задача', color: 'bg-purple-100 text-purple-700' },
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

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function TicketsPage() {
  const { userName } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_review' | 'resolved'>('all')
  const [advancing, setAdvancing] = useState<string | null>(null)
  // id тикета, для которого открыта форма решения
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('tickets')
      .select('*, students(name)')
      .order('created_at', { ascending: false })
    setTickets((data as Ticket[]) || [])
  }

  async function advanceTake(ticket: Ticket) {
    setAdvancing(ticket.id)
    const res = await fetch('/api/ticket-advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticket.id, actor: userName || 'Неизвестный' }),
    })
    const json = await res.json()
    if (json.ok && json.ticket) {
      setTickets(prev => prev.map(t =>
        t.id === ticket.id ? { ...t, ...json.ticket, students: t.students } : t
      ))
    }
    setAdvancing(null)
  }

  async function submitResolve(ticket: Ticket) {
    if (!resolutionNote.trim()) return
    setAdvancing(ticket.id)
    const res = await fetch('/api/ticket-advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: ticket.id,
        actor: userName || 'Неизвестный',
        resolution_note: resolutionNote.trim(),
      }),
    })
    const json = await res.json()
    if (json.ok && json.ticket) {
      setTickets(prev => prev.map(t =>
        t.id === ticket.id ? { ...t, ...json.ticket, students: t.students } : t
      ))
    }
    setResolvingId(null)
    setResolutionNote('')
    setAdvancing(null)
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
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
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
            const isResolving = resolvingId === t.id
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

                {/* Лог воронки */}
                {(t.taken_by || t.resolved_by) && (
                  <div className="mb-3 space-y-1 border-l-2 border-gray-100 pl-3">
                    {t.taken_by && (
                      <div className="text-xs text-gray-400">
                        🔄 Взял в работу: <span className="font-medium text-gray-600">{t.taken_by}</span>
                        {t.taken_at && <span className="ml-1 text-gray-300">· {fmtDate(t.taken_at)}</span>}
                      </div>
                    )}
                    {t.resolved_by && (
                      <div className="text-xs text-gray-400">
                        ✅ Решил: <span className="font-medium text-gray-600">{t.resolved_by}</span>
                        {t.resolved_at && <span className="ml-1 text-gray-300">· {fmtDate(t.resolved_at)}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Итог решения */}
                {t.resolution_note && (
                  <div className="mb-3 bg-green-50 border border-green-100 rounded-xl p-3">
                    <div className="text-xs text-green-600 font-medium mb-1">✅ Как решили:</div>
                    <div className="text-sm text-green-800">{t.resolution_note}</div>
                  </div>
                )}

                {/* Форма решения */}
                {isResolving ? (
                  <div className="mb-2 space-y-2">
                    <div className="text-xs text-gray-500 font-medium">Опиши что сделано и как решили *</div>
                    <textarea
                      value={resolutionNote}
                      onChange={e => setResolutionNote(e.target.value)}
                      placeholder="Например: позвонили родителю, перенесли на среду..."
                      rows={3}
                      autoFocus
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-black"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitResolve(t)}
                        disabled={!resolutionNote.trim() || advancing === t.id}
                        className="flex-1 text-sm bg-green-600 text-white py-1.5 rounded-xl font-medium disabled:opacity-40">
                        {advancing === t.id ? '...' : 'Сохранить и закрыть'}
                      </button>
                      <button
                        onClick={() => { setResolvingId(null); setResolutionNote('') }}
                        className="text-sm border border-gray-200 text-gray-500 px-3 py-1.5 rounded-xl">
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {t.status === 'pending' && (
                      <button onClick={() => advanceTake(t)} disabled={advancing === t.id}
                        className="flex-1 text-sm bg-black text-white py-1.5 rounded-xl font-medium disabled:opacity-50">
                        {advancing === t.id ? '...' : 'Взять в работу'}
                      </button>
                    )}
                    {t.status === 'in_review' && (
                      <button onClick={() => { setResolvingId(t.id); setResolutionNote('') }}
                        className="flex-1 text-sm bg-black text-white py-1.5 rounded-xl font-medium">
                        Отметить решённым
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
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
