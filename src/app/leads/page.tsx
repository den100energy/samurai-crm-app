'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Lead = { id: string; name: string; phone: string | null; source: string | null; status: string; notes: string | null; created_at: string }

const STATUS_LABELS: Record<string, string> = {
  new: '🆕 Новый',
  contacted: '📞 Связались',
  trial: '🥋 Пробное',
  converted: '✅ Ученик',
  lost: '❌ Отказ',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', source: '', notes: '' })

  async function load() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addLead(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('leads').insert({ name: form.name, phone: form.phone || null, source: form.source || null, notes: form.notes || null })
    setForm({ name: '', phone: '', source: '', notes: '' })
    setShowForm(false)
    load()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

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
      ) : leads.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Лидов пока нет</div>
      ) : (
        <div className="space-y-3">
          {leads.map(l => (
            <div key={l.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-800">{l.name}</div>
                  {l.phone && <div className="text-sm text-gray-400">{l.phone}</div>}
                  {l.source && <div className="text-xs text-gray-400 mt-0.5">📍 {l.source}</div>}
                  {l.notes && <div className="text-sm text-gray-500 mt-1">{l.notes}</div>}
                </div>
              </div>
              <div className="flex gap-1 mt-3 flex-wrap">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => updateStatus(l.id, key)}
                    className={`text-xs px-2 py-1 rounded-full transition-colors
                      ${l.status === key ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
