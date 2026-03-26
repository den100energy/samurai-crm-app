'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { localDateStr } from '@/lib/dates'
import { OnboardingHint } from '@/components/OnboardingHint'

type Sub = { id: string; type: string | null; sessions_left: number | null; end_date: string | null }
type Student = {
  id: string
  name: string
  group_name: string | null
  subs: Sub[]
  sub_id: string | null
  sessions_left: number | null
}

const GROUPS = ['Дети 4-9', 'Подростки (нач)', 'Подростки (оп)', 'Цигун', 'Индивидуальные']

function subLabel(sub: Sub): string {
  const name = sub.type?.includes('|') ? sub.type.split('|')[1] : (sub.type || 'Абонемент')
  return `${name} — ${sub.sessions_left ?? '∞'} зан.`
}

async function loadWithSub(students: { id: string; name: string; group_name: string | null }[]): Promise<Student[]> {
  const today = localDateStr()
  return Promise.all(students.map(async s => {
    const { data } = await supabase
      .from('subscriptions')
      .select('id, type, sessions_left, end_date')
      .eq('student_id', s.id)
      .order('created_at', { ascending: false })
    const activeSubs: Sub[] = (data || []).filter(sub =>
      (sub.sessions_left === null || sub.sessions_left > 0) &&
      (!sub.end_date || sub.end_date >= today)
    )
    const first = activeSubs[0] ?? null
    return { ...s, subs: activeSubs, sub_id: first?.id ?? null, sessions_left: first?.sessions_left ?? null }
  }))
}

export default function AttendancePage() {
  const { role, permissions } = useAuth()
  const canEdit = role !== 'trainer' || permissions.includes('attendance.edit')
  const [students, setStudents] = useState<Student[]>([])
  const [guests, setGuests] = useState<Student[]>([])
  const [group, setGroup] = useState(GROUPS[0])
  const [date, setDate] = useState(localDateStr())
  const [present, setPresent] = useState<Set<string>>(new Set())
  const [showGuests, setShowGuests] = useState(false)
  const [guestsLoaded, setGuestsLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [originalPresent, setOriginalPresent] = useState<Set<string>>(new Set())
  const [selectedSubs, setSelectedSubs] = useState<Record<string, string>>({}) // studentId → subId

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
      setGuests([])
      setGuestsLoaded(false)
      setShowGuests(false)

      // Загрузить уже сохранённые отметки за эту дату (если есть)
      let savedPresent = new Set<string>()
      if (withSubs.length > 0) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('student_id, present')
          .eq('date', date)
          .in('student_id', withSubs.map(s => s.id))

        if (attData && attData.length > 0) {
          attData.forEach(a => { if (a.present) savedPresent.add(a.student_id) })
        }
      }
      setPresent(new Set(savedPresent))
      setOriginalPresent(new Set(savedPresent))
    }
    load()
  }, [group, date])

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

  function getChosenSub(s: Student): Sub | null {
    const chosenId = selectedSubs[s.id] || s.sub_id
    return s.subs.find(sub => sub.id === chosenId) || s.subs[0] || null
  }

  async function save() {
    setSaving(true)

    const allStudents = [...students, ...guests]

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

    // Adjust sessions only for the diff, using the chosen sub
    for (const s of allStudents) {
      const wasPresent = originalPresent.has(s.id)
      const isPresent = present.has(s.id)
      const sub = getChosenSub(s)
      if (!wasPresent && isPresent && sub && sub.sessions_left !== null && sub.sessions_left > 0) {
        await supabase.from('subscriptions').update({ sessions_left: sub.sessions_left - 1 }).eq('id', sub.id)
      } else if (wasPresent && !isPresent && sub && sub.sessions_left !== null) {
        await supabase.from('subscriptions').update({ sessions_left: sub.sessions_left + 1 }).eq('id', sub.id)
      }
    }

    // Update local subs to reflect changes
    const adjust = (list: Student[]) => list.map(s => {
      const wasPresent = originalPresent.has(s.id)
      const isPresent = present.has(s.id)
      const sub = getChosenSub(s)
      if (!sub) return s
      if (!wasPresent && isPresent && sub.sessions_left !== null && sub.sessions_left > 0) {
        const updatedSubs = s.subs.map(sb => sb.id === sub.id ? { ...sb, sessions_left: sb.sessions_left! - 1 } : sb)
        const newFirst = updatedSubs.find(sb => sb.id === (selectedSubs[s.id] || s.sub_id)) || updatedSubs[0]
        return { ...s, subs: updatedSubs, sessions_left: newFirst?.sessions_left ?? null }
      }
      if (wasPresent && !isPresent && sub.sessions_left !== null) {
        const updatedSubs = s.subs.map(sb => sb.id === sub.id ? { ...sb, sessions_left: sb.sessions_left! + 1 } : sb)
        const newFirst = updatedSubs.find(sb => sb.id === (selectedSubs[s.id] || s.sub_id)) || updatedSubs[0]
        return { ...s, subs: updatedSubs, sessions_left: newFirst?.sessions_left ?? null }
      }
      return s
    })
    setStudents(prev => adjust(prev))
    setGuests(prev => adjust(prev))
    setOriginalPresent(new Set(present))

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)

    const noSubPresent = allStudents.filter(s => present.has(s.id) && !originalPresent.has(s.id) && s.subs.length === 0)
    if (noSubPresent.length > 0) {
      alert(`⚠️ Не забудь внести абонемент!\n\nПрисутствовали без абонемента:\n${noSubPresent.map(s => `• ${s.name}`).join('\n')}`)
    }
  }

  function sessionsColor(n: number | null) {
    if (n === null) return ''
    if (n === 0) return 'text-red-500 font-bold'
    if (n <= 2) return 'text-orange-500 font-medium'
    return 'text-gray-400'
  }

  const guestsPresentCount = guests.filter(g => present.has(g.id)).length

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Посещаемость</h1>
      </div>

      <OnboardingHint id="attendance" className="mb-4" />

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
            {students.map(s => {
              const chosenSub = getChosenSub(s)
              return (
                <div key={s.id} className={`rounded-xl border transition-colors ${present.has(s.id) ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <button onClick={() => toggle(s.id)} className="w-full flex items-center px-4 py-3">
                    <span className="text-xl mr-3">{present.has(s.id) ? '✅' : '⬜'}</span>
                    <span className="font-medium text-gray-800 flex-1 text-left">{s.name}</span>
                    {s.subs.length === 0 ? (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full ml-2">Нет абонемента</span>
                    ) : chosenSub && (
                      <span className={`text-sm ml-2 ${sessionsColor(chosenSub.sessions_left)}`}>
                        {chosenSub.sessions_left === 0 ? '❗ 0 занятий' : `${chosenSub.sessions_left} зан.`}
                      </span>
                    )}
                  </button>
                  {present.has(s.id) && s.subs.length > 1 && (
                    <div className="px-4 pb-3">
                      <select
                        value={selectedSubs[s.id] || s.sub_id || ''}
                        onChange={e => setSelectedSubs(prev => ({ ...prev, [s.id]: e.target.value }))}
                        onClick={e => e.stopPropagation()}
                        className="w-full text-xs border border-green-300 rounded-lg px-2 py-1.5 bg-white outline-none">
                        {s.subs.map(sub => (
                          <option key={sub.id} value={sub.id}>{subLabel(sub)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
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
                        <span className={`text-sm ${sessionsColor(g.sessions_left)}`}>
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
          {canEdit && (
            <button onClick={save} disabled={saving}
              className="w-full bg-black text-white py-3 rounded-xl font-medium disabled:opacity-50">
              {saved ? '✓ Сохранено!' : saving ? 'Сохранение...' : 'Сохранить посещаемость'}
            </button>
          )}
        </>
      )}
    </main>
  )
}
