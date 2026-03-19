'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  name: string
  group_name: string | null
  sessions_left: number | null
  sub_id: string | null
}

const GROUPS = ['Дети 4-9', 'Подростки (нач)', 'Подростки (оп)', 'Цигун', 'Индивидуальные']

async function loadWithSub(students: { id: string; name: string; group_name: string | null }[]): Promise<Student[]> {
  return Promise.all(students.map(async s => {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, sessions_left')
      .eq('student_id', s.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return { ...s, sessions_left: sub?.sessions_left ?? null, sub_id: sub?.id ?? null }
  }))
}

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([])
  const [guests, setGuests] = useState<Student[]>([])
  const [group, setGroup] = useState(GROUPS[0])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [present, setPresent] = useState<Set<string>>(new Set())
  const [showGuests, setShowGuests] = useState(false)
  const [guestsLoaded, setGuestsLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('students')
        .select('id, name, group_name')
        .eq('group_name', group)
        .eq('status', 'active')
        .order('name')

      const withSubs = await loadWithSub(data || [])
      setStudents(withSubs)
      setPresent(new Set(withSubs.map(s => s.id)))
      // Reset guests when group changes
      setGuests([])
      setGuestsLoaded(false)
      setShowGuests(false)
    }
    load()
  }, [group])

  async function loadGuests() {
    if (guestsLoaded) return
    const { data } = await supabase
      .from('students')
      .select('id, name, group_name')
      .neq('group_name', group)
      .eq('status', 'active')
      .order('group_name')
      .order('name')

    const withSubs = await loadWithSub(data || [])
    setGuests(withSubs)
    setGuestsLoaded(true)
  }

  function toggleGuests() {
    const next = !showGuests
    setShowGuests(next)
    if (next) loadGuests()
  }

  function toggle(id: string) {
    setPresent(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)

    const allStudents = [...students, ...guests.filter(g => present.has(g.id))]

    // Save attendance records
    const mainRows = students.map(s => ({
      student_id: s.id,
      date,
      group_name: group,
      present: present.has(s.id),
    }))
    const guestRows = guests.filter(g => present.has(g.id)).map(g => ({
      student_id: g.id,
      date,
      group_name: group,
      present: true,
    }))
    await supabase.from('attendance').upsert([...mainRows, ...guestRows], { onConflict: 'student_id,date' })

    // Deduct sessions for everyone who attended
    for (const s of allStudents) {
      if (present.has(s.id) && s.sub_id && s.sessions_left !== null && s.sessions_left > 0) {
        await supabase
          .from('subscriptions')
          .update({ sessions_left: s.sessions_left - 1 })
          .eq('id', s.sub_id)
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)

    setStudents(prev => prev.map(s =>
      present.has(s.id) && s.sessions_left !== null && s.sessions_left > 0
        ? { ...s, sessions_left: s.sessions_left - 1 }
        : s
    ))
    setGuests(prev => prev.map(g =>
      present.has(g.id) && g.sessions_left !== null && g.sessions_left > 0
        ? { ...g, sessions_left: g.sessions_left - 1 }
        : g
    ))
  }

  function sessionsColor(s: Student) {
    if (s.sessions_left === null) return ''
    if (s.sessions_left === 0) return 'text-red-500 font-bold'
    if (s.sessions_left <= 2) return 'text-orange-500 font-medium'
    return 'text-gray-400'
  }

  const guestsPresentCount = guests.filter(g => present.has(g.id)).length

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Посещаемость</h1>
      </div>

      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-3 outline-none focus:border-gray-400" />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {GROUPS.map(g => (
          <button key={g} onClick={() => setGroup(g)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${group === g ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {g}
          </button>
        ))}
      </div>

      {students.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Нет учеников в этой группе</div>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {students.map(s => (
              <button key={s.id} onClick={() => toggle(s.id)}
                className={`w-full flex items-center px-4 py-3 rounded-xl border transition-colors
                  ${present.has(s.id) ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <span className="text-xl mr-3">{present.has(s.id) ? '✅' : '⬜'}</span>
                <span className="font-medium text-gray-800 flex-1 text-left">{s.name}</span>
                {s.sessions_left !== null && (
                  <span className={`text-sm ml-2 ${sessionsColor(s)}`}>
                    {s.sessions_left === 0 ? '❗ 0 занятий' : `${s.sessions_left} зан.`}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Guests section */}
          <button onClick={toggleGuests}
            className="w-full border border-dashed border-gray-300 text-gray-500 py-2.5 rounded-xl text-sm mb-4 hover:border-gray-400 hover:text-gray-700 transition-colors">
            {showGuests
              ? `▲ Скрыть гостей${guestsPresentCount > 0 ? ` (отмечено: ${guestsPresentCount})` : ''}`
              : `+ Гости из других групп${guestsPresentCount > 0 ? ` (${guestsPresentCount})` : ''}`}
          </button>

          {showGuests && (
            <div className="mb-4">
              {!guestsLoaded ? (
                <div className="text-center text-gray-400 py-4 text-sm">Загрузка...</div>
              ) : guests.length === 0 ? (
                <div className="text-center text-gray-400 py-4 text-sm">Нет других учеников</div>
              ) : (
                <div className="space-y-2">
                  {guests.map(g => (
                    <button key={g.id} onClick={() => toggle(g.id)}
                      className={`w-full flex items-center px-4 py-3 rounded-xl border transition-colors
                        ${present.has(g.id) ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                      <span className="text-xl mr-3">{present.has(g.id) ? '✅' : '⬜'}</span>
                      <span className="font-medium text-gray-800 flex-1 text-left">{g.name}</span>
                      {g.group_name && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mr-2">
                          {g.group_name}
                        </span>
                      )}
                      {g.sessions_left !== null && (
                        <span className={`text-sm ${sessionsColor(g)}`}>
                          {g.sessions_left === 0 ? '❗ 0' : `${g.sessions_left} зан.`}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="text-sm text-gray-500 text-center mb-3">
            Присутствует: {present.size - guestsPresentCount} из {students.length}
            {guestsPresentCount > 0 && ` + ${guestsPresentCount} гост.`}
          </div>
          <button onClick={save} disabled={saving}
            className="w-full bg-black text-white py-3 rounded-xl font-medium disabled:opacity-50">
            {saved ? '✓ Сохранено!' : saving ? 'Сохранение...' : 'Сохранить посещаемость'}
          </button>
        </>
      )}
    </main>
  )
}
