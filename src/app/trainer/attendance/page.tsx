'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Student = {
  id: string
  name: string
  group_name: string | null
  sessions_left: number | null
  sub_id: string | null
  photo_url: string | null
}

async function loadWithSub(students: { id: string; name: string; group_name: string | null; photo_url: string | null }[]): Promise<Student[]> {
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

function sessionsColor(s: Student) {
  if (s.sessions_left === null) return ''
  if (s.sessions_left === 0) return 'text-red-500 font-bold'
  if (s.sessions_left <= 2) return 'text-orange-500 font-medium'
  return 'text-gray-400'
}

function AttendanceContent() {
  const { userName, loading } = useAuth()
  const searchParams = useSearchParams()
  const [myGroups, setMyGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<Student[]>([])
  const [guests, setGuests] = useState<Student[]>([])
  const [present, setPresent] = useState<Set<string>>(new Set())
  const [showGuests, setShowGuests] = useState(false)
  const [guestsLoaded, setGuestsLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Pre-fill from URL params (?date=&group=)
  useEffect(() => {
    const urlDate = searchParams.get('date')
    const urlGroup = searchParams.get('group')
    if (urlDate) setDate(urlDate)
    if (urlGroup) setSelectedGroup(urlGroup)
  }, [searchParams])

  // Load trainer's groups
  useEffect(() => {
    if (!loading && userName) {
      supabase.from('schedule').select('group_name').eq('trainer_name', userName)
        .then(async ({ data }) => {
          const groups = [...new Set((data || []).map(s => s.group_name).filter(Boolean))] as string[]
          if (groups.length > 0) {
            setMyGroups(groups)
            if (!searchParams.get('group') && groups.length === 1) setSelectedGroup(groups[0])
          } else {
            const { data: studs } = await supabase.from('students').select('group_name').eq('status', 'active')
            const allGroups = [...new Set((studs || []).map(s => s.group_name).filter(Boolean))] as string[]
            setMyGroups(allGroups)
            if (!searchParams.get('group') && allGroups.length === 1) setSelectedGroup(allGroups[0])
          }
        })
    }
  }, [loading, userName])

  // Load students when group or date changes
  useEffect(() => {
    if (!selectedGroup) return
    loadStudents()
  }, [selectedGroup, date])

  async function loadStudents() {
    const { data } = await supabase
      .from('students')
      .select('id, name, group_name, photo_url')
      .eq('group_name', selectedGroup)
      .eq('status', 'active')
      .order('name')

    const withSubs = await loadWithSub(data || [])
    setStudents(withSubs)
    setPresent(new Set(withSubs.map(s => s.id)))
    setGuests([])
    setGuestsLoaded(false)
    setShowGuests(false)

    // Load existing attendance for this date
    if (withSubs.length > 0) {
      const { data: attData } = await supabase
        .from('attendance')
        .select('student_id, present')
        .eq('date', date)
        .in('student_id', withSubs.map(s => s.id))

      if (attData && attData.length > 0) {
        const attMap = new Set<string>()
        attData.forEach(a => { if (a.present) attMap.add(a.student_id) })
        setPresent(attMap)
      }
    }
  }

  async function loadGuests() {
    if (guestsLoaded) return
    const { data } = await supabase
      .from('students')
      .select('id, name, group_name, photo_url')
      .neq('group_name', selectedGroup)
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

    const mainRows = students.map(s => ({
      student_id: s.id,
      date,
      group_name: selectedGroup,
      present: present.has(s.id),
    }))
    const guestRows = guests.filter(g => present.has(g.id)).map(g => ({
      student_id: g.id,
      date,
      group_name: selectedGroup,
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
        ? { ...s, sessions_left: s.sessions_left - 1 } : s
    ))
    setGuests(prev => prev.map(g =>
      present.has(g.id) && g.sessions_left !== null && g.sessions_left > 0
        ? { ...g, sessions_left: g.sessions_left - 1 } : g
    ))

    const noSubPresent = [...students, ...guests].filter(s => present.has(s.id) && s.sub_id === null)
    if (noSubPresent.length > 0) {
      alert(`⚠️ Не забудь внести абонемент!\n\nПрисутствовали без абонемента:\n${noSubPresent.map(s => `• ${s.name}`).join('\n')}`)
    }
  }

  const guestsPresentCount = guests.filter(g => present.has(g.id)).length
  const mainPresentCount = students.filter(s => present.has(s.id)).length

  if (!selectedGroup) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/trainer" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
          <h1 className="text-xl font-bold text-gray-800">Посещаемость</h1>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-3 outline-none focus:border-gray-400" />
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {myGroups.map(g => (
            <button key={g} onClick={() => setSelectedGroup(g)}
              className="whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:border-gray-400">
              {g}
            </button>
          ))}
        </div>
        {myGroups.length === 0 && (
          <div className="text-center text-gray-400 py-12">Загрузка групп...</div>
        )}
      </main>
    )
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/trainer" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Посещаемость</h1>
      </div>

      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-3 outline-none focus:border-gray-400" />

      {/* Group tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {myGroups.map(g => (
          <button key={g} onClick={() => setSelectedGroup(g)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${selectedGroup === g ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
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
                {s.photo_url && (
                  <img src={s.photo_url} alt={s.name} className="w-8 h-8 rounded-full object-cover mr-2 shrink-0" />
                )}
                <span className="font-medium text-gray-800 flex-1 text-left">{s.name}</span>
                {s.sub_id === null ? (
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full ml-2">Нет абон.</span>
                ) : s.sessions_left !== null && (
                  <span className={`text-sm ml-2 ${sessionsColor(s)}`}>
                    {s.sessions_left === 0 ? '❗ 0 зан.' : `${s.sessions_left} зан.`}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Guests */}
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
                      {g.photo_url && (
                        <img src={g.photo_url} alt={g.name} className="w-8 h-8 rounded-full object-cover mr-2 shrink-0" />
                      )}
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
            Присутствует: {mainPresentCount} из {students.length}
            {guestsPresentCount > 0 && ` + ${guestsPresentCount} гост.`}
          </div>

          <button onClick={save} disabled={saving}
            className="w-full bg-black text-white py-3 rounded-xl font-medium disabled:opacity-50 transition-colors">
            {saved ? '✓ Сохранено!' : saving ? 'Сохранение...' : 'Сохранить посещаемость'}
          </button>
        </>
      )}
    </main>
  )
}

export default function TrainerAttendancePage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400 py-12">Загрузка...</div>}>
      <AttendanceContent />
    </Suspense>
  )
}
