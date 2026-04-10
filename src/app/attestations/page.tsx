'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type PreattGroup = {
  label: string
  grades: string[]
  preatt1_date: string
  preatt2_date: string
}

type AttestationEvent = {
  id: string
  title: string
  discipline: string
  applications_open_at: string | null
  event_date: string
  status: string
  preatt_groups: PreattGroup[] | null
  app_count: number
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  draft:       { label: 'Черновик',     color: 'bg-gray-100 text-gray-600' },
  open:        { label: 'Приём заявок', color: 'bg-green-100 text-green-700' },
  in_progress: { label: 'Идёт',        color: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Завершена',   color: 'bg-purple-100 text-purple-600' },
}

const DISC_LABEL: Record<string, string> = {
  aikido: 'Айкидо',
  wushu:  'Ушу',
  both:   'Айкидо + Ушу',
}

const DEFAULT_GROUPS: Record<string, PreattGroup[]> = {
  aikido: [
    { label: '11–9 кю', grades: ['11 кю', '10 кю', '9 кю'], preatt1_date: '', preatt2_date: '' },
    { label: '8–6 кю',  grades: ['8 кю', '7 кю', '6 кю'],   preatt1_date: '', preatt2_date: '' },
    { label: '5–4 кю',  grades: ['5 кю', '4 кю'],            preatt1_date: '', preatt2_date: '' },
    { label: '3–1 кю',  grades: ['3 кю', '2 кю', '1 кю', '1 дан', '2 дан', '3 дан', '4 дан'], preatt1_date: '', preatt2_date: '' },
  ],
  wushu: [
    { label: '10–7 туди',      grades: ['10 туди', '9 туди', '8 туди', '7 туди'], preatt1_date: '', preatt2_date: '' },
    { label: '6 туди и выше',  grades: ['6 туди', '5 туди', '4 туди', '3 туди', '2 туди', '1 степень', '2 степень', '3 степень', '4 степень'], preatt1_date: '', preatt2_date: '' },
  ],
  both: [
    { label: '11–9 кю (айкидо)', grades: ['11 кю', '10 кю', '9 кю'], preatt1_date: '', preatt2_date: '' },
    { label: '8–6 кю (айкидо)',  grades: ['8 кю', '7 кю', '6 кю'],   preatt1_date: '', preatt2_date: '' },
    { label: '5–4 кю (айкидо)',  grades: ['5 кю', '4 кю'],            preatt1_date: '', preatt2_date: '' },
    { label: '3–1 кю (айкидо)',  grades: ['3 кю', '2 кю', '1 кю', '1 дан', '2 дан', '3 дан', '4 дан'], preatt1_date: '', preatt2_date: '' },
    { label: '10–7 туди (ушу)',      grades: ['10 туди', '9 туди', '8 туди', '7 туди'], preatt1_date: '', preatt2_date: '' },
    { label: '6 туди и выше (ушу)',  grades: ['6 туди', '5 туди', '4 туди', '3 туди', '2 туди', '1 степень', '2 степень', '3 степень', '4 степень'], preatt1_date: '', preatt2_date: '' },
  ],
}

export default function AttestationsPage() {
  const [events, setEvents] = useState<AttestationEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', discipline: 'aikido', applications_open_at: '', event_date: '', notes: '' })
  const [groups, setGroups] = useState<PreattGroup[]>(DEFAULT_GROUPS.aikido)

  async function load() {
    const { data } = await supabase
      .from('attestation_events')
      .select('*, attestation_applications(id)')
      .order('event_date', { ascending: false })
    setEvents(((data as any[]) || []).map(e => ({ ...e, app_count: e.attestation_applications?.length || 0 })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function setDiscipline(disc: string) {
    setForm(p => ({ ...p, discipline: disc }))
    setGroups(DEFAULT_GROUPS[disc] || DEFAULT_GROUPS.aikido)
  }

  function updateGroup(idx: number, field: 'preatt1_date' | 'preatt2_date', value: string) {
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g))
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('attestation_events').insert({
      title: form.title,
      discipline: form.discipline,
      applications_open_at: form.applications_open_at || null,
      event_date: form.event_date,
      notes: form.notes || null,
      preatt_groups: groups,
    })
    setShowForm(false)
    setForm({ title: '', discipline: 'aikido', applications_open_at: '', event_date: '', notes: '' })
    setGroups(DEFAULT_GROUPS.aikido)
    setSaving(false)
    load()
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Аттестации</h1>
        <button onClick={() => setShowForm(v => !v)} className="ml-auto bg-black text-white px-4 py-2 rounded-xl text-sm font-medium">
          + Создать
        </button>
      </div>

      {showForm && (
        <form onSubmit={createEvent} className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 space-y-4">
          <h2 className="font-semibold text-gray-800">Новое мероприятие</h2>

          <input
            required value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Название, напр. «Аттестация весна 2026»"
            className="w-full border rounded-xl px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Дисциплина</label>
              <select value={form.discipline} onChange={e => setDiscipline(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm">
                <option value="aikido">Айкидо</option>
                <option value="wushu">Ушу</option>
                <option value="both">Айкидо + Ушу</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Открытие заявок</label>
              <input type="date" value={form.applications_open_at} onChange={e => setForm(p => ({ ...p, applications_open_at: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Дата аттестации *</label>
            <input required type="date" value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm" />
          </div>

          {/* Group schedule */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">Расписание предаттестаций по группам</p>
            {groups.map((g, idx) => (
              <div key={g.label} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium text-gray-800">{g.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Предатт. 1</label>
                    <input type="date" value={g.preatt1_date} onChange={e => updateGroup(idx, 'preatt1_date', e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Предатт. 2</label>
                    <input type="date" value={g.preatt2_date} onChange={e => updateGroup(idx, 'preatt2_date', e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Заметки (необязательно)" rows={2} className="w-full border rounded-xl px-3 py-2 text-sm resize-none" />

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60">
              {saving ? 'Сохранение...' : 'Создать'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-xl text-sm">Отмена</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-12">Загрузка...</p>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">🥋</p>
          <p className="text-gray-400">Аттестаций пока нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => {
            const si = STATUS_INFO[ev.status] || STATUS_INFO.draft
            const groupCount = ev.preatt_groups?.length || 0
            return (
              <Link key={ev.id} href={`/attestations/${ev.id}`} className="block bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-400 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{ev.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{DISC_LABEL[ev.discipline] || ev.discipline}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${si.color}`}>{si.label}</span>
                </div>
                <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                  <span>📅 {ev.event_date}</span>
                  {groupCount > 0 && <span>{groupCount} групп</span>}
                  <span>{ev.app_count} заявок</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
