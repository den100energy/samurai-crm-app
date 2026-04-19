'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type ErrorLog = {
  id: string
  created_at: string
  message: string
  stack: string | null
  source: string
  url: string | null
  user_email: string | null
  context: Record<string, unknown> | null
  resolved: boolean
}

export default function AdminErrorsPage() {
  const { role, loading: authLoading } = useAuth()
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    let q = supabase.from('error_logs').select('*').order('created_at', { ascending: false }).limit(200)
    if (filter === 'unresolved') q = q.eq('resolved', false)
    const { data } = await q
    setErrors((data as ErrorLog[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  async function toggleResolved(id: string, resolved: boolean) {
    await supabase.from('error_logs').update({ resolved }).eq('id', id)
    setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved } : e))
  }

  async function deleteOne(id: string) {
    await supabase.from('error_logs').delete().eq('id', id)
    setErrors(prev => prev.filter(e => e.id !== id))
  }

  async function deleteResolved() {
    if (!confirm('Удалить все исправленные ошибки?')) return
    await supabase.from('error_logs').delete().eq('resolved', true)
    load()
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (authLoading) return <div className="p-8 text-center text-gray-400">Загрузка...</div>
  if (role !== 'admin') return <div className="p-8 text-center text-gray-400">Доступ только для администратора</div>

  const unresolvedCount = errors.filter(e => !e.resolved).length

  return (
    <main className="max-w-3xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/settings" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800 flex-1">🐛 Лог ошибок</h1>
        {unresolvedCount > 0 && (
          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
            {unresolvedCount}
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter('unresolved')}
          className={`text-sm px-3 py-1.5 rounded-xl ${filter === 'unresolved' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
          Не исправлено
        </button>
        <button onClick={() => setFilter('all')}
          className={`text-sm px-3 py-1.5 rounded-xl ${filter === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
          Все
        </button>
        <button onClick={load}
          className="text-sm px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200">
          ↻ Обновить
        </button>
        <button onClick={deleteResolved}
          className="ml-auto text-sm text-red-500 hover:text-red-600">
          Очистить исправленные
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Загрузка...</div>
      ) : errors.length === 0 ? (
        <div className="text-center text-gray-400 py-12">🎉 Ошибок нет</div>
      ) : (
        <div className="space-y-2">
          {errors.map(e => {
            const isExpanded = expanded.has(e.id)
            return (
              <div key={e.id} className={`bg-white rounded-xl p-3 border ${e.resolved ? 'border-green-100 opacity-60' : 'border-gray-100'}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 break-words">{e.message}</div>
                    <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-2">
                      <span>📅 {new Date(e.created_at).toLocaleString('ru')}</span>
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded">{e.source}</span>
                      {e.user_email && <span>👤 {e.user_email}</span>}
                    </div>
                    {e.url && (
                      <div className="text-xs text-gray-400 mt-0.5 truncate">🔗 {e.url}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => toggleResolved(e.id, !e.resolved)}
                      className={`text-xs px-2 py-1 rounded-lg ${e.resolved ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                      {e.resolved ? '✓ Исправлено' : 'Отметить'}
                    </button>
                    <button onClick={() => deleteOne(e.id)}
                      className="text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      🗑
                    </button>
                  </div>
                </div>
                {(e.stack || e.context) && (
                  <button onClick={() => toggleExpand(e.id)}
                    className="text-xs text-blue-500 hover:text-blue-700 mt-2">
                    {isExpanded ? '▲ Скрыть детали' : '▼ Показать детали'}
                  </button>
                )}
                {isExpanded && (
                  <div className="mt-2 space-y-2">
                    {e.context && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Контекст:</div>
                        <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(e.context, null, 2)}
                        </pre>
                      </div>
                    )}
                    {e.stack && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Стек:</div>
                        <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto text-gray-600 whitespace-pre-wrap">
                          {e.stack}
                        </pre>
                      </div>
                    )}
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
