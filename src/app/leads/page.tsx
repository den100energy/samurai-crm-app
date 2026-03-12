'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Lead = {
  id: string
  name: string
  phone: string | null
  source: string | null
  status: string
  notes: string | null
  created_at: string
}

const STAGES = [
  { key: 'new', label: '🆕 Новый', color: 'bg-blue-50 border-blue-200' },
  { key: 'contacted', label: '📞 Связались', color: 'bg-yellow-50 border-yellow-200' },
  { key: 'trial', label: '🥋 Пробное', color: 'bg-purple-50 border-purple-200' },
  { key: 'converted', label: '✅ Стал учеником', color: 'bg-green-50 border-green-200' },
  { key: 'lost', label: '❌ Отказ', color: 'bg-red-50 border-red-200' },
]

const ACTIVE_STAGES = STAGES.filter(s => s.key !== 'converted' && s.key !== 'lost')

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [view, setView] = useState<'funnel' | 'list'>('funnel')
  const [form, setForm] = useState({ name: '', phone: '', source: '', notes: '' })
  const [expandedLead, setExpandedLead] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addLead(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('leads').insert({
      name: form.name, phone: form.phone || null,
      source: form.source || null, notes: form.notes || null
    })
    setForm({ name: '', phone: '', source: '', notes: '' })
    setShowForm(false)
    load()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  async function deleteLead(id: string) {
    if (!confirm('Удалить лид?')) return
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
  }

  // Просроченные — новые лиды без контакта более 24 часов
  const overdue = leads.filter(l => {
    if (l.status !== 'new') return false
    const hours = (Date.now() - new Date(l.created_at).getTime()) / 3600000
    return hours > 24
  })

  const activeLeads = leads.filter(l => l.status !== 'converted' && l.status !== 'lost')
  const converted = leads.filter(l => l.status === 'converted').length
  const conversionRate = leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Лиды</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="ml-auto bg-black text-white px-4 py-2 rounded-xl text-sm font-medium">
          + Добавить
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-xl font-bold text-gray-800">{leads.length}</div>
          <div className="text-xs text-gray-400">всего</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-xl font-bold text-blue-500">{activeLeads.length}</div>
          <div className="text-xs text-gray-400">активных</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-xl font-bold text-green-600">{converted}</div>
          <div className="text-xs text-gray-400">учеников</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-xl font-bold text-gray-800">{conversionRate}%</div>
          <div className="text-xs text-gray-400">конверсия</div>
        </div>
      </div>

      {/* Просроченные */}
      {overdue.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4">
          <div className="font-semibold text-orange-700 mb-1">⏰ Не связались 24+ часа ({overdue.length})</div>
          {overdue.map(l => (
            <div key={l.id} className="text-sm text-orange-600">• {l.name}{l.phone ? ` — ${l.phone}` : ''}</div>
          ))}
        </div>
      )}

      {/* Переключение вида */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('funnel')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
            ${view === 'funnel' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
          🔽 Воронка
        </button>
        <button onClick={() => setView('list')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
            ${view === 'list' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
          📋 Список
        </button>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <form onSubmit={addLead} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 space-y-3">
          <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            placeholder="Имя *" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none text-sm" />
          <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
            placeholder="Телефон" type="tel" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none text-sm" />
          <input value={form.source} onChange={e => setForm({...form, source: e.target.value})}
            placeholder="Источник (Instagram, сарафан...)" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none text-sm" />
          <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
            placeholder="Заметки" rows={2} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none text-sm resize-none" />
          <button type="submit" className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium">Сохранить</button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : view === 'funnel' ? (
        // ВОРОНКА
        <div className="space-y-3">
          {ACTIVE_STAGES.map((stage, idx) => {
            const stageLeads = leads.filter(l => l.status === stage.key)
            const prevCount = idx === 0 ? leads.filter(l => l.status !== 'lost').length : leads.filter(l => l.status === ACTIVE_STAGES[idx-1].key).length
            const pct = prevCount > 0 && idx > 0 ? Math.round((stageLeads.length / prevCount) * 100) : null
            return (
              <div key={stage.key} className={`rounded-2xl border p-3 ${stage.color}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-800">{stage.label}</div>
                  <div className="flex items-center gap-2">
                    {pct !== null && <span className="text-xs text-gray-500">{pct}%</span>}
                    <span className="bg-white rounded-full px-2 py-0.5 text-sm font-bold text-gray-700">{stageLeads.length}</span>
                  </div>
                </div>
                {stageLeads.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-1">Нет лидов</div>
                ) : (
                  <div className="space-y-2">
                    {stageLeads.map(l => (
                      <LeadCard key={l.id} lead={l} expanded={expandedLead === l.id}
                        onToggle={() => setExpandedLead(expandedLead === l.id ? null : l.id)}
                        onStatusChange={updateStatus} onDelete={deleteLead} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {/* Итог */}
          <div className="grid grid-cols-2 gap-2">
            {STAGES.filter(s => s.key === 'converted' || s.key === 'lost').map(stage => {
              const stageLeads = leads.filter(l => l.status === stage.key)
              return (
                <div key={stage.key} className={`rounded-2xl border p-3 ${stage.color}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-700">{stage.label}</div>
                    <span className="bg-white rounded-full px-2 py-0.5 text-sm font-bold text-gray-700">{stageLeads.length}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        // СПИСОК
        <div className="space-y-2">
          {leads.length === 0 ? (
            <div className="text-center text-gray-400 py-12">Лидов пока нет</div>
          ) : leads.map(l => (
            <LeadCard key={l.id} lead={l} expanded={expandedLead === l.id}
              onToggle={() => setExpandedLead(expandedLead === l.id ? null : l.id)}
              onStatusChange={updateStatus} onDelete={deleteLead} />
          ))}
        </div>
      )}
    </main>
  )
}

function LeadCard({ lead, expanded, onToggle, onStatusChange, onDelete }: {
  lead: Lead
  expanded: boolean
  onToggle: () => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const stage = STAGES.find(s => s.key === lead.status)
  const hoursAgo = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 3600000)
  const timeLabel = hoursAgo < 24 ? `${hoursAgo}ч назад` : `${Math.floor(hoursAgo/24)}д назад`

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center px-3 py-2.5 text-left">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-800">{lead.name}</div>
          <div className="text-xs text-gray-400">{lead.phone || '—'} · {timeLabel}</div>
        </div>
        <div className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600 ml-2 shrink-0">
          {stage?.label}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-50">
          {lead.source && <div className="text-xs text-gray-500 mt-2">📍 {lead.source}</div>}
          {lead.notes && <div className="text-sm text-gray-600 mt-1">{lead.notes}</div>}
          <div className="flex gap-1 mt-3 flex-wrap">
            {STAGES.map(s => (
              <button key={s.key} onClick={() => onStatusChange(lead.id, s.key)}
                className={`text-xs px-2 py-1 rounded-full transition-colors
                  ${lead.status === s.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
                {s.label}
              </button>
            ))}
          </div>
          <button onClick={() => onDelete(lead.id)} className="text-xs text-red-400 mt-2">Удалить</button>
        </div>
      )}
    </div>
  )
}
