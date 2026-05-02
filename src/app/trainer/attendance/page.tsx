'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTheme } from '@/components/ThemeProvider'
import { localDateStr } from '@/lib/dates'
import { TrainingLogSheet } from '@/components/TrainingLogSheet'
import { TrainingLogData } from '@/lib/training-checklists'

type Sub = { id: string; type: string | null; sessions_left: number | null; end_date: string | null }
type Student = {
  id: string
  name: string
  group_name: string | null
  subs: Sub[]
  sub_id: string | null
  sessions_left: number | null
  photo_url: string | null
  has_pending: boolean
}

function subLabel(sub: Sub): string {
  const name = sub.type?.includes('|') ? sub.type.split('|')[1] : (sub.type || 'Абонемент')
  return `${name} — ${sub.sessions_left ?? '∞'} зан.`
}

async function loadWithSub(students: { id: string; name: string; group_name: string | null; photo_url: string | null }[]): Promise<Student[]> {
  const today = new Date().toISOString().split('T')[0]
  return Promise.all(students.map(async s => {
    const { data } = await supabase
      .from('subscriptions')
      .select('id, type, sessions_left, end_date, is_pending')
      .eq('student_id', s.id)
      .order('created_at', { ascending: false })
    const activeSubs: Sub[] = (data || []).filter(sub =>
      !sub.is_pending &&
      (sub.sessions_left === null || sub.sessions_left > 0) &&
      (!sub.end_date || sub.end_date >= today)
    )
    const hasPending = (data || []).some(sub => sub.is_pending)
    const first = activeSubs[0] ?? null
    return { ...s, subs: activeSubs, sub_id: first?.id ?? null, sessions_left: first?.sessions_left ?? null, has_pending: hasPending }
  }))
}

function sessionsColor(n: number | null) {
  if (n === null) return ''
  if (n === 0) return 'text-red-500 font-bold'
  if (n <= 2) return 'text-orange-500 font-medium'
  return 'text-gray-400'
}

function AttendanceContent() {
  const { userName, role, assignedGroups, loading } = useAuth()
  const isAssistant = role === 'assistant'

  // Помощнику тренера доступны только последние 2 дня
  const minDate = (() => {
    const d = new Date(); d.setDate(d.getDate() - 2); return d.toISOString().split('T')[0]
  })()
  const maxDate = localDateStr()
  const { theme } = useTheme()
  const searchParams = useSearchParams()

  const dark = theme === 'dark'
  const bg = dark ? 'bg-[#1C1C1E]' : 'bg-white'
  const card = dark ? 'bg-[#2C2C2E] border-[#3A3A3C]' : 'bg-white border-gray-100'
  const textPrimary = dark ? 'text-[#E5E5E7]' : 'text-gray-800'
  const textSecondary = dark ? 'text-[#8E8E93]' : 'text-gray-400'
  const inputCls = dark
    ? 'bg-[#2C2C2E] border-[#3A3A3C] text-[#E5E5E7]'
    : 'border-gray-200'
  const divider = dark ? 'border-[#3A3A3C]' : 'border-gray-50'
  const [myGroups, setMyGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [date, setDate] = useState(localDateStr())
  const [students, setStudents] = useState<Student[]>([])
  const [guests, setGuests] = useState<Student[]>([])
  const [present, setPresent] = useState<Set<string>>(new Set())
  const [showGuests, setShowGuests] = useState(false)
  const [guestsLoaded, setGuestsLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [originalPresent, setOriginalPresent] = useState<Set<string>>(new Set())
  const [selectedSubs, setSelectedSubs] = useState<Record<string, string>>({})

  // Training log state
  const [showLogSheet, setShowLogSheet] = useState(false)
  const [existingLog, setExistingLog] = useState<{ id: string; data: TrainingLogData } | null>(null)
  const [logDates, setLogDates] = useState<Set<string>>(new Set())

  // Режим только-чтение для помощника (посещаемость уже внесена)
  const [attendanceLocked, setAttendanceLocked] = useState(false)

  // Training photo state
  type TrainingPhoto = { id: string; photo_url: string; sort_order: number; telegram_published_at: string | null }
  const [sessionPhotos, setSessionPhotos] = useState<TrainingPhoto[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoPublishing, setPhotoPublishing] = useState(false)
  const [photoPublished, setPhotoPublished] = useState(false)

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
      if (isAssistant) {
        // Помощник видит только назначенные ему группы
        setMyGroups(assignedGroups)
        if (!searchParams.get('group') && assignedGroups.length === 1) setSelectedGroup(assignedGroups[0])
        return
      }
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
  }, [loading, userName, isAssistant, assignedGroups])

  // Load students when group or date changes
  useEffect(() => {
    if (!selectedGroup) return
    loadStudents()
  }, [selectedGroup, date])

  // Load log dates separately — depends on userName being available
  useEffect(() => {
    if (!selectedGroup) return
    loadLogDates()
  }, [selectedGroup, date, userName])

  // Load session photos when group or date changes
  useEffect(() => {
    if (!selectedGroup) return
    loadSessionPhotos()
  }, [selectedGroup, date])

  async function loadSessionPhotos() {
    const { data } = await supabase
      .from('training_photos')
      .select('id, photo_url, sort_order, telegram_published_at')
      .eq('group_name', selectedGroup)
      .eq('session_date', date)
      .order('sort_order')
    setSessionPhotos(data || [])
    setPhotoPublished(!!(data && data.length > 0 && data[0].telegram_published_at))
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('group_name', selectedGroup)
      fd.append('session_date', date)
      fd.append('trainer_name', userName || '')
      fd.append('student_count', String(mainPresentCount + guestsPresentCount))
      fd.append('sort_order', String(sessionPhotos.length))
      const res = await fetch('/api/upload-training-photo', { method: 'POST', body: fd })
      if (!res.ok) { alert('Ошибка загрузки фото'); return }
      await loadSessionPhotos()
    } catch {
      alert('Ошибка загрузки фото')
    } finally {
      setPhotoUploading(false)
      e.target.value = ''
    }
  }

  async function handlePhotoDelete(id: string) {
    await fetch(`/api/upload-training-photo?id=${id}`, { method: 'DELETE' })
    await loadSessionPhotos()
  }

  async function handlePublishToTelegram() {
    setPhotoPublishing(true)
    try {
      const res = await fetch('/api/telegram/publish-training-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: selectedGroup, session_date: date }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(`Ошибка публикации: ${err.error || 'неизвестная ошибка'}`)
        return
      }
      setPhotoPublished(true)
    } catch {
      alert('Ошибка публикации в Telegram')
    } finally {
      setPhotoPublishing(false)
    }
  }

  async function loadLogDates() {
    const { data } = await supabase
      .from('training_logs')
      .select('id, date')
      .eq('group_name', selectedGroup)
      .eq('trainer_name', userName || '')
      .order('date', { ascending: false })
    
    const dateSet = new Set<string>()
    if (data) {
      for (const log of data) dateSet.add(log.date)
    }
    setLogDates(dateSet)
  }

  async function loadStudents() {
    const { data } = await supabase
      .from('students')
      .select('id, name, group_name, photo_url')
      .eq('group_name', selectedGroup)
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

    // Для помощника: если есть хоть одна запись — блокируем редактирование
    if (isAssistant) {
      setAttendanceLocked(attData != null && attData.length > 0)
    } else {
      setAttendanceLocked(false)
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

  function getChosenSub(s: Student): Sub | null {
    const chosenId = selectedSubs[s.id] || s.sub_id
    return s.subs.find(sub => sub.id === chosenId) || s.subs[0] || null
  }

  async function save() {
    setSaving(true)

    const allStudents = [...students, ...guests]

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

    const noSubPresent = allStudents.filter(s => present.has(s.id) && !originalPresent.has(s.id) && s.subs.length === 0 && !s.has_pending)
    if (noSubPresent.length > 0) {
      alert(`⚠️ Не забудь внести абонемент!\n\nПрисутствовали без абонемента:\n${noSubPresent.map(s => `• ${s.name}`).join('\n')}`)
    }
  }

  async function openLogSheet() {
    // Check if log already exists for this date/group/trainer
    const { data } = await supabase
      .from('training_logs')
      .select('id, warmup_items, fitness_items, basic_techniques, applied_techniques, taolu_items, qigong_items, aikido_ukemi, aikido_techniques, aikido_weapons, aikido_etiquette, aikido_movement, notes')
      .eq('group_name', selectedGroup)
      .eq('trainer_name', userName || '')
      .eq('date', date)
      .maybeSingle()

    if (data) {
      setExistingLog({
        id: data.id,
        data: {
          warmup_items: data.warmup_items || [],
          fitness_items: data.fitness_items || [],
          basic_techniques: data.basic_techniques || [],
          applied_techniques: data.applied_techniques || [],
          taolu_items: data.taolu_items || [],
          qigong_items: data.qigong_items || [],
          aikido_ukemi: data.aikido_ukemi || [],
          aikido_techniques: data.aikido_techniques || [],
          aikido_weapons: data.aikido_weapons || [],
          aikido_etiquette: data.aikido_etiquette || false,
          aikido_movement: data.aikido_movement || [],
          notes: data.notes || '',
        },
      })
    } else {
      setExistingLog(null)
    }
    setShowLogSheet(true)
  }

  function handleLogSheetClose() {
    setShowLogSheet(false)
    loadLogDates() // refresh
  }

  const guestsPresentCount = guests.filter(g => present.has(g.id)).length
  const mainPresentCount = students.filter(s => present.has(s.id)).length

  if (!selectedGroup) {
    return (
      <main className="max-w-lg mx-auto p-4" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <div className="flex items-center gap-3 mb-4">
          <Link href="/trainer" className={`text-xl font-bold leading-none hover:opacity-70 ${textSecondary}`}>←</Link>
          <h1 className={`text-xl font-bold ${textPrimary}`}>Посещаемость</h1>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className={`w-full border rounded-xl px-4 py-2.5 mb-3 outline-none ${inputCls}`} />
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {myGroups.map(g => (
            <button key={g} onClick={() => setSelectedGroup(g)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                ${dark ? 'border-[#3A3A3C] bg-[#2C2C2E] text-[#8E8E93]' : 'border-gray-200 bg-white text-gray-600'}`}>
              {g}
            </button>
          ))}
        </div>
        {myGroups.length === 0 && (
          <div className={`text-center py-12 ${textSecondary}`}>Загрузка групп...</div>
        )}
      </main>
    )
  }

  return (
    <main className="max-w-lg mx-auto p-4" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/trainer" className={`text-xl font-bold leading-none hover:opacity-70 ${textSecondary}`}>←</Link>
        <h1 className={`text-xl font-bold ${textPrimary}`}>Посещаемость</h1>
      </div>

      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        min={isAssistant ? minDate : undefined}
        max={isAssistant ? maxDate : undefined}
        className={`w-full border rounded-xl px-4 py-2.5 mb-3 outline-none ${inputCls}`} />

      {/* Group tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {myGroups.map(g => (
          <button key={g} onClick={() => setSelectedGroup(g)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${selectedGroup === g ? 'bg-black text-white' : dark ? 'bg-[#2C2C2E] text-[#8E8E93] border border-[#3A3A3C]' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {g}
          </button>
        ))}
      </div>

      {students.length === 0 ? (
        <div className={`text-center py-12 ${textSecondary}`}>Нет учеников в этой группе</div>
      ) : (
        <>
          {attendanceLocked && (
            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="text-sm font-medium text-amber-800">⚠️ Посещаемость уже внесена</div>
              <div className="text-xs text-amber-600 mt-0.5">Если нужно исправить — обратитесь к тренеру</div>
            </div>
          )}

          <div className="space-y-2 mb-4">
            {students.map(s => {
              const chosenSub = getChosenSub(s)
              return (
                <div key={s.id} className={`rounded-xl border transition-colors ${present.has(s.id) ? 'bg-green-50 border-green-200' : dark ? 'bg-[#2C2C2E] border-[#3A3A3C]' : 'bg-gray-50 border-gray-200'}`}>
                  <button onClick={() => attendanceLocked ? undefined : toggle(s.id)} disabled={attendanceLocked} className="w-full flex items-center px-4 py-3">
                    <span className="text-xl mr-3">{present.has(s.id) ? '✅' : '⬜'}</span>
                    {s.photo_url && (
                      <img src={s.photo_url} alt={s.name} className="w-8 h-8 rounded-full object-cover mr-2 shrink-0" />
                    )}
                    <span className={`font-medium flex-1 text-left ${textPrimary}`}>{s.name}</span>
                    {s.subs.length === 0 ? (
                      s.has_pending ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-2">⏳ Ожидает</span>
                      ) : (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full ml-2">Нет абон.</span>
                      )
                    ) : chosenSub && (
                      <span className={`text-sm ml-2 ${sessionsColor(chosenSub.sessions_left)}`}>
                        {chosenSub.sessions_left === 0 ? '❗ 0 зан.' : `${chosenSub.sessions_left} зан.`}
                      </span>
                    )}
                  </button>
                  {present.has(s.id) && s.subs.length > 1 && (
                    <div className="px-4 pb-3">
                      <select
                        value={selectedSubs[s.id] || s.sub_id || ''}
                        onChange={e => setSelectedSubs(prev => ({ ...prev, [s.id]: e.target.value }))}
                        onClick={e => e.stopPropagation()}
                        className={`w-full text-xs border border-green-300 rounded-lg px-2 py-1.5 outline-none ${dark ? 'bg-[#2C2C2E] text-[#E5E5E7]' : 'bg-white'}`}>
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

          {/* Guests */}
          <button onClick={toggleGuests}
            className={`w-full border border-dashed py-2.5 rounded-xl text-sm mb-4 transition-colors
              ${dark ? 'border-[#3A3A3C] text-[#8E8E93] hover:border-[#636366]' : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'}`}>
            {showGuests
              ? `▲ Скрыть гостей${guestsPresentCount > 0 ? ` (отмечено: ${guestsPresentCount})` : ''}`
              : `+ Гости из других групп${guestsPresentCount > 0 ? ` (${guestsPresentCount})` : ''}`}
          </button>

          {showGuests && (
            <div className="mb-4">
              {!guestsLoaded ? (
                <div className={`text-center py-4 text-sm ${textSecondary}`}>Загрузка...</div>
              ) : guests.length === 0 ? (
                <div className={`text-center py-4 text-sm ${textSecondary}`}>Нет других учеников</div>
              ) : (
                <div className="space-y-2">
                  {guests.map(g => (
                    <button key={g.id} onClick={() => toggle(g.id)}
                      className={`w-full flex items-center px-4 py-3 rounded-xl border transition-colors
                        ${present.has(g.id)
                          ? 'bg-blue-50 border-blue-200'
                          : dark ? 'bg-[#2C2C2E] border-[#3A3A3C]' : 'bg-gray-50 border-gray-200'}`}>
                      <span className="text-xl mr-3">{present.has(g.id) ? '✅' : '⬜'}</span>
                      {g.photo_url && (
                        <img src={g.photo_url} alt={g.name} className="w-8 h-8 rounded-full object-cover mr-2 shrink-0" />
                      )}
                      <span className={`font-medium flex-1 text-left ${textPrimary}`}>{g.name}</span>
                      {g.group_name && (
                        <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${dark ? 'bg-[#3A3A3C] text-[#8E8E93]' : 'bg-gray-100 text-gray-500'}`}>
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

          <div className={`text-sm text-center mb-3 ${textSecondary}`}>
            Присутствует: {mainPresentCount} из {students.length}
            {guestsPresentCount > 0 && ` + ${guestsPresentCount} гост.`}
          </div>

          {!attendanceLocked && (
            <button onClick={save} disabled={saving}
              className="w-full bg-black text-white py-3 rounded-xl font-medium disabled:opacity-50 transition-colors">
              {saved ? '✓ Сохранено!' : saving ? 'Сохранение...' : 'Сохранить посещаемость'}
            </button>
          )}

          {/* Training Log Button */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={openLogSheet}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors
                ${logDates.has(date)
                  ? dark
                    ? 'bg-[#2C2C2E] border-[#3A3A3C] text-[#E5E5E7]'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
                  : dark
                    ? 'bg-[#2C2C2E] border-[#3A3A3C] text-[#8E8E93] hover:border-[#636366]'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
              {logDates.has(date) ? '📝 Редактировать журнал' : '📝 Добавить журнал тренировки'}
            </button>
          </div>

          {/* Training Photo Block */}
          <div className={`mt-4 rounded-xl border p-4 ${dark ? 'bg-[#2C2C2E] border-[#3A3A3C]' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-medium ${textPrimary}`}>📸 Фото тренировки</span>
              {sessionPhotos.length > 0 && (
                photoPublished
                  ? <span className="text-xs text-green-500 font-medium">✅ Опубликовано</span>
                  : <span className={`text-xs ${textSecondary}`}>{sessionPhotos.length} фото</span>
              )}
            </div>

            {/* Photo previews */}
            {sessionPhotos.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {sessionPhotos.map(photo => (
                  <div key={photo.id} className="relative">
                    <img
                      src={photo.photo_url}
                      alt="Фото тренировки"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => handlePhotoDelete(photo.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add photo buttons */}
            <div className="flex gap-2">
              <label className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border border-dashed cursor-pointer transition-colors
                ${photoUploading
                  ? 'opacity-50 cursor-not-allowed'
                  : dark
                    ? 'border-[#636366] text-[#8E8E93] hover:border-orange-500 hover:text-orange-400'
                    : 'border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-500'
                }`}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={photoUploading}
                  onChange={handlePhotoUpload}
                />
                📷 Камера
              </label>
              <label className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border border-dashed cursor-pointer transition-colors
                ${photoUploading
                  ? 'opacity-50 cursor-not-allowed'
                  : dark
                    ? 'border-[#636366] text-[#8E8E93] hover:border-orange-500 hover:text-orange-400'
                    : 'border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-500'
                }`}>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={photoUploading}
                  onChange={handlePhotoUpload}
                />
                🖼 Галерея
              </label>
            </div>

            {/* Publish button */}
            {sessionPhotos.length > 0 && !photoPublished && (
              <button
                onClick={handlePublishToTelegram}
                disabled={photoPublishing}
                className="mt-2 w-full py-2.5 rounded-xl text-sm font-medium bg-[#229ED9] text-white disabled:opacity-50 transition-opacity"
              >
                {photoPublishing ? 'Публикую...' : '✈️ Опубликовать в Telegram'}
              </button>
            )}
          </div>
        </>
      )}

      <TrainingLogSheet
        isOpen={showLogSheet}
        onClose={handleLogSheetClose}
        groupName={selectedGroup}
        trainerName={userName || ''}
        date={date}
        existingLog={existingLog}
      />
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
