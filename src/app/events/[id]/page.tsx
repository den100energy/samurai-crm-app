'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Participant = {
  id: string
  student_id: string
  paid: boolean
  amount: number | null
  students: { name: string } | null
}

type Student = { id: string; name: string }
type Event = { id: string; name: string; date: string; price: number | null; description: string | null }

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  async function load() {
    const [{ data: ev }, { data: parts }, { data: students }] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('event_participants').select('*, students(name)').eq('event_id', id),
      supabase.from('students').select('id, name').eq('status', 'active').order('name'),
    ])
    setEvent(ev)
    setParticipants(parts || [])
    setAllStudents(students || [])
  }

  useEffect(() => { load() }, [id])

  async function addParticipant() {
    if (!selectedId) return
    await supabase.from('event_participants').insert({
      event_id: id,
      student_id: selectedId,
      paid: false,
      amount: event?.price || null,
    })
    setShowAdd(false)
    setSelectedId('')
    load()
  }

  async function togglePaid(partId: string, paid: boolean) {
    await supabase.from('event_participants').update({ paid: !paid }).eq('id', partId)
    setParticipants(prev => prev.map(p => p.id === partId ? { ...p, paid: !paid } : p))
  }

  async function removeParticipant(partId: string) {
    await supabase.from('event_participants').delete().eq('id', partId)
    setParticipants(prev => prev.filter(p => p.id !== partId))
  }

  if (!event) return <div className="text-center text-gray-400 py-12">Загрузка...</div>

  const totalCollected = participants.filter(p => p.paid).reduce((sum, p) => sum + (p.amount || event.price || 0), 0)
  const alreadyAdded = new Set(participants.map(p => p.student_id))
  const available = allStudents.filter(s => !alreadyAdded.has(s.id))

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/events" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-xl font-bold text-gray-800">{event.name}</h1>
      </div>

      {/* Инфо о мероприятии */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Дата</span><span>{event.date}</span></div>
          {event.price && <div className="flex justify-between"><span className="text-gray-400">Стоимость</span><span>{event.price} ₽</span></div>}
          {event.description && <div className="flex justify-between"><span className="text-gray-400">Описание</span><span>{event.description}</span></div>}
        </div>
      </div>

      {/* Итоги */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-2xl font-bold text-gray-800">{participants.length}</div>
          <div className="text-xs text-gray-400">участников</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-2xl font-bold text-green-600">{participants.filter(p => p.paid).length}</div>
          <div className="text-xs text-gray-400">оплатили</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-lg font-bold text-gray-800">{totalCollected} ₽</div>
          <div className="text-xs text-gray-400">собрано</div>
        </div>
      </div>

      {/* Участники */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-gray-800">Участники</div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="text-sm border border-gray-200 px-3 py-1.5 rounded-xl text-gray-600">
          + Добавить
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm mb-3 flex gap-2">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
            <option value="">Выберите ученика</option>
            {available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={addParticipant} disabled={!selectedId}
            className="bg-black text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50">
            Добавить
          </button>
        </div>
      )}

      {participants.length === 0 ? (
        <div className="text-center text-gray-400 py-8">Нет участников</div>
      ) : (
        <div className="space-y-2">
          {participants.map(p => (
            <div key={p.id} className="flex items-center bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm gap-3">
              <div className="flex-1">
                <div className="font-medium text-gray-800">{p.students?.name}</div>
                {p.amount && <div className="text-xs text-gray-400">{p.amount} ₽</div>}
              </div>
              <button onClick={() => togglePaid(p.id, p.paid)}
                className={`text-xs px-3 py-1.5 rounded-full ${p.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {p.paid ? '✓ Оплачено' : 'Не оплачено'}
              </button>
              <button onClick={() => removeParticipant(p.id)} className="text-gray-300 hover:text-red-400 text-lg">×</button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
