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
  attendance_type: string | null
  students: { name: string; group_name: string | null } | null
}

type Student = { id: string; name: string; group_name: string | null }

type SubInfo = {
  id: string
  bonuses: Record<string, number> | null
  bonuses_used: Record<string, number> | null
  sessions_left: number | null
}

type Event = {
  id: string
  name: string
  date: string
  price: number | null
  description: string | null
  bonus_type: string | null
  group_restriction: string | null
}

const ATTENDANCE_LABELS: Record<string, { label: string; color: string }> = {
  bonus:   { label: 'Бонус',   color: 'bg-purple-100 text-purple-700' },
  session: { label: 'Занятие', color: 'bg-gray-100 text-gray-600' },
  paid:    { label: 'Платный', color: 'bg-green-100 text-green-700' },
  regular: { label: 'Участник', color: 'bg-gray-100 text-gray-500' },
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [subMap, setSubMap] = useState<Record<string, SubInfo>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  async function load() {
    const [{ data: ev }, { data: parts }, { data: students }, { data: subs }] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('event_participants').select('*, students(name, group_name)').eq('event_id', id),
      supabase.from('students').select('id, name, group_name').eq('status', 'active').order('name'),
      supabase.from('subscriptions').select('id, student_id, bonuses, bonuses_used, sessions_left').order('created_at', { ascending: false }),
    ])

    setEvent(ev)
    setParticipants(parts || [])

    // Build latest subscription map per student
    const map: Record<string, SubInfo> = {}
    for (const sub of (subs || [])) {
      if (!map[sub.student_id]) map[sub.student_id] = sub
    }
    setSubMap(map)

    // Filter students by group if restricted
    const filtered = ev?.group_restriction
      ? (students || []).filter(s => s.group_name === ev.group_restriction)
      : (students || [])
    setAllStudents(filtered)
  }

  useEffect(() => { load() }, [id])

  function getBonusStatus(studentId: string): { hasBonusAvailable: boolean; bonusLeft: number } {
    if (!event?.bonus_type) return { hasBonusAvailable: false, bonusLeft: 0 }
    const sub = subMap[studentId]
    if (!sub?.bonuses) return { hasBonusAvailable: false, bonusLeft: 0 }
    const total = sub.bonuses[event.bonus_type] || 0
    const used = sub.bonuses_used?.[event.bonus_type] || 0
    return { hasBonusAvailable: total > used, bonusLeft: total - used }
  }

  async function addParticipant(attendanceType: string) {
    if (!selectedId) return
    const sub = subMap[selectedId]

    await supabase.from('event_participants').insert({
      event_id: id,
      student_id: selectedId,
      paid: attendanceType === 'paid',
      amount: attendanceType === 'paid' ? (event?.price || null) : null,
      attendance_type: attendanceType,
    })

    // Deduct from subscription if applicable
    if (sub && attendanceType === 'bonus' && event?.bonus_type) {
      const currentUsed = sub.bonuses_used || {}
      const newUsed = { ...currentUsed, [event.bonus_type]: (currentUsed[event.bonus_type] || 0) + 1 }
      await supabase.from('subscriptions').update({ bonuses_used: newUsed }).eq('id', sub.id)
    }
    if (sub && attendanceType === 'session' && sub.sessions_left != null) {
      await supabase.from('subscriptions').update({ sessions_left: Math.max(0, sub.sessions_left - 1) }).eq('id', sub.id)
    }

    setShowAdd(false)
    setSelectedId('')
    load()
  }

  async function removeParticipant(partId: string) {
    await supabase.from('event_participants').delete().eq('id', partId)
    setParticipants(prev => prev.filter(p => p.id !== partId))
  }

  if (!event) return <div className="text-center text-gray-400 py-12">Загрузка...</div>

  const alreadyAdded = new Set(participants.map(p => p.student_id))
  const available = allStudents.filter(s => !alreadyAdded.has(s.id))
  const selectedSub = selectedId ? subMap[selectedId] : null
  const { hasBonusAvailable, bonusLeft } = selectedId ? getBonusStatus(selectedId) : { hasBonusAvailable: false, bonusLeft: 0 }
  const isBonusEvent = !!event.bonus_type
  const isMasterClass = event.bonus_type === 'мастер-класс'

  const bonusCnt = participants.filter(p => p.attendance_type === 'bonus').length
  const sessionCnt = participants.filter(p => p.attendance_type === 'session').length
  const paidCnt = participants.filter(p => p.attendance_type === 'paid').length
  const totalCollected = participants.filter(p => p.paid).reduce((sum, p) => sum + (p.amount || event.price || 0), 0)

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/events" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <div>
          <h1 className="text-xl font-bold text-gray-800">{event.name}</h1>
          {event.bonus_type && (
            <div className="flex gap-2 mt-0.5">
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{event.bonus_type}</span>
              {event.group_restriction && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{event.group_restriction}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event info */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Дата</span><span>{event.date}</span></div>
          {event.price && <div className="flex justify-between"><span className="text-gray-400">Стоимость</span><span>{event.price.toLocaleString()} ₽</span></div>}
          {event.description && <div className="flex justify-between"><span className="text-gray-400">Описание</span><span>{event.description}</span></div>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-xl font-bold text-gray-800">{participants.length}</div>
          <div className="text-xs text-gray-400">всего</div>
        </div>
        {isBonusEvent && (
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <div className="text-xl font-bold text-purple-600">{bonusCnt}</div>
            <div className="text-xs text-gray-400">бонус</div>
          </div>
        )}
        {!isMasterClass && (
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <div className="text-xl font-bold text-gray-600">{sessionCnt}</div>
            <div className="text-xs text-gray-400">занятие</div>
          </div>
        )}
        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-xl font-bold text-green-600">{paidCnt}</div>
          <div className="text-xs text-gray-400">платных</div>
        </div>
        {totalCollected > 0 && (
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <div className="text-sm font-bold text-gray-800">{totalCollected.toLocaleString()} ₽</div>
            <div className="text-xs text-gray-400">собрано</div>
          </div>
        )}
      </div>

      {/* Add participant */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-gray-800">Участники</div>
        <button onClick={() => { setShowAdd(!showAdd); setSelectedId('') }}
          className="text-sm border border-gray-200 px-3 py-1.5 rounded-xl text-gray-600">
          + Добавить
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 space-y-3">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
            <option value="">Выберите ученика</option>
            {available.map(s => <option key={s.id} value={s.id}>{s.name}{s.group_name ? ` (${s.group_name})` : ''}</option>)}
          </select>

          {selectedId && (
            <div>
              {isBonusEvent && (
                <div className={`text-xs mb-3 px-3 py-2 rounded-xl ${hasBonusAvailable ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-500'}`}>
                  {hasBonusAvailable
                    ? `✅ Есть бонус «${event.bonus_type}» — осталось ${bonusLeft}`
                    : `❌ Бонуса «${event.bonus_type}» нет`}
                  {selectedSub?.sessions_left != null && ` · Занятий: ${selectedSub.sessions_left}`}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {isBonusEvent && hasBonusAvailable && (
                  <button onClick={() => addParticipant('bonus')}
                    className="flex-1 bg-purple-500 text-white py-2 rounded-xl text-sm font-medium">
                    🎁 Бонус
                  </button>
                )}
                {!isMasterClass && (
                  <button onClick={() => addParticipant('session')}
                    className="flex-1 bg-gray-700 text-white py-2 rounded-xl text-sm font-medium">
                    ✅ Занятие
                  </button>
                )}
                <button onClick={() => addParticipant('paid')}
                  className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-medium">
                  💰 Платный
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {participants.length === 0 ? (
        <div className="text-center text-gray-400 py-8">Нет участников</div>
      ) : (
        <div className="space-y-2">
          {participants.map(p => {
            const typeInfo = ATTENDANCE_LABELS[p.attendance_type || 'regular']
            return (
              <div key={p.id} className="flex items-center bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 text-sm">{p.students?.name}</div>
                  {p.students?.group_name && <div className="text-xs text-gray-400">{p.students.group_name}</div>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${typeInfo.color}`}>
                  {typeInfo.label}
                </span>
                {p.amount && <div className="text-xs text-gray-500 shrink-0">{p.amount} ₽</div>}
                <button onClick={() => removeParticipant(p.id)} className="text-gray-300 hover:text-red-400 text-lg shrink-0">×</button>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
