'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { localDateStr } from '@/lib/dates'
import { OnboardingHint } from '@/components/OnboardingHint'
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
  has_pending: boolean
}

const GROUPS = ['Старт', 'Основная (нач.)', 'Основная (оп.)', 'Цигун', 'Индивидуальные']

function subLabel(sub: Sub): string {
  const name = sub.type?.includes('|') ? sub.type.split('|')[1] : (sub.type || 'Абонемент')
  return `${name} — ${sub.sessions_left ?? '∞'} зан.`
}

async function loadWithSub(students: { id: string; name: string; group_name: string | null }[]): Promise<Student[]> {
  const today = localDateStr()
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

type MissingDay = { date: string; group_name: string; trainer_name: string | null }

export default function AttendancePage() {
  const { role, permissions, userName } = useAuth()
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
  const [missingDays, setMissingDays] = useState<MissingDay[]>([])
  const [showAllMissing, setShowAllMissing] = useState(false)
  const [missingLogs, setMissingLogs] = useState<MissingDay[]>([])

  // Training log state
  const [showLogSheet, setShowLogSheet] = useState(false)
  const [existingLog, setExistingLog] = useState<{ id: string; data: TrainingLogData } | null>(null)
  const [logDates, setLogDates] = useState<Set<string>>(new Set())

  // Training photo state
  type TrainingPhoto = { id: string; photo_url: string; sort_order: number; telegram_published_at: string | null }
  const [sessionPhotos, setSessionPhotos] = useState<TrainingPhoto[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoPublishing, setPhotoPublishing] = useState(false)
  const [photoPublished, setPhotoPublished] = useState(false)
  const [savedGuestCount, setSavedGuestCount] = useState(0)

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

      // Загрузить уже сохранённые отметки за эту дату (все: свои + гости)
      let savedPresent = new Set<string>()
      const mainIds = new Set(withSubs.map(s => s.id))

      const { data: allAttData } = await supabase
        .from('attendance')
        .select('student_id, present')
        .eq('date', date)
        .eq('group_name', group)

      if (allAttData && allAttData.length > 0) {
        allAttData.forEach(a => { if (a.present) savedPresent.add(a.student_id) })
        setSavedGuestCount(allAttData.filter(a => a.present && !mainIds.has(a.student_id)).length)
      } else {
        setSavedGuestCount(0)
      }
      setPresent(new Set(savedPresent))
      setOriginalPresent(new Set(savedPresent))
      loadLogDates()
    }
    load()
  }, [group, date])

  async function loadLogDates() {
    const { data } = await supabase
      .from('training_logs')
      .select('date')
      .eq('group_name', group)
      .order('date', { ascending: false })

    const dateSet = new Set<string>()
    if (data) {
      for (const log of data) dateSet.add(log.date)
    }
    setLogDates(dateSet)
  }

  useEffect(() => {
    loadSessionPhotos()
  }, [group, date])

  async function loadSessionPhotos() {
    const { data } = await supabase
      .from('training_photos')
      .select('id, photo_url, sort_order, telegram_published_at')
      .eq('group_name', group)
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
      fd.append('group_name', group)
      fd.append('session_date', date)
      fd.append('trainer_name', userName || '')
      fd.append('student_count', String(mainPresentCount + effectiveGuestCount))
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
        body: JSON.stringify({ group_name: group, session_date: date }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(`Ошибка публикации: ${err.error || 'неизвестная ошибка'}`)
        return
      }
      await loadSessionPhotos()
    } catch {
      alert('Ошибка публикации в Telegram')
    } finally {
      setPhotoPublishing(false)
    }
  }

  async function handleResendToTelegram() {
    await supabase
      .from('training_photos')
      .update({ student_count: mainPresentCount + effectiveGuestCount })
      .eq('group_name', group)
      .eq('session_date', date)
    await handlePublishToTelegram()
  }

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

    // Восстанавливаем уже сохранённые отметки гостей за эту дату
    if (withSubs.length > 0) {
      const { data: guestAtt } = await supabase
        .from('attendance')
        .select('student_id, present')
        .eq('date', date)
        .eq('group_name', group)
        .in('student_id', withSubs.map(g => g.id))
      if (guestAtt && guestAtt.length > 0) {
        setPresent(prev => {
          const next = new Set(prev)
          guestAtt.forEach(a => { if (a.present) next.add(a.student_id) })
          return next
        })
        setOriginalPresent(prev => {
          const next = new Set(prev)
          guestAtt.forEach(a => { if (a.present) next.add(a.student_id) })
          return next
        })
      }
    }
  }

  function toggleGuests() {
    const next = !showGuests
    setShowGuests(next)
    if (next) loadGuests()
  }

  useEffect(() => {
    async function loadMissingDays() {
      const today = localDateStr()

      // Последние 14 дней (не включая сегодня)
      const days: string[] = []
      for (let i = 1; i <= 14; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push(localDateStr(d))
      }

      // Расписание и отмены за этот период
      const [{ data: schedules }, { data: overrides }] = await Promise.all([
        supabase.from('schedule').select('group_name, day_of_week, trainer_name'),
        supabase.from('schedule_overrides').select('date, group_name, cancelled, trainer_name').gte('date', days[days.length - 1]).lte('date', today),
      ])

      // Строим set отменённых и map переопределённых тренеров: "date|group"
      const cancelledSet = new Set<string>()
      const overrideTrainers = new Map<string, string | null>()
      for (const ov of overrides || []) {
        if (ov.cancelled) {
          cancelledSet.add(`${ov.date}|${ov.group_name}`)
        } else if (ov.trainer_name) {
          overrideTrainers.set(`${ov.date}|${ov.group_name}`, ov.trainer_name)
        }
      }

      // Вычисляем все ожидаемые тренировки
      const expected: MissingDay[] = []
      for (const dayStr of days) {
        // day_of_week: 1=Пн … 7=Вс (как в нашей таблице)
        const jsDay = new Date(dayStr + 'T00:00:00').getDay() // 0=Вс
        const dayOfWeek = jsDay === 0 ? 7 : jsDay
        for (const s of schedules || []) {
          if (s.day_of_week === dayOfWeek && !cancelledSet.has(`${dayStr}|${s.group_name}`)) {
            const key = `${dayStr}|${s.group_name}`
            const trainer = overrideTrainers.has(key) ? overrideTrainers.get(key)! : (s.trainer_name ?? null)
            expected.push({ date: dayStr, group_name: s.group_name, trainer_name: trainer })
          }
        }
      }

      if (expected.length === 0) { setMissingDays([]); return }

      // Проверяем, какие из них есть в attendance
      // date хранится как TIMESTAMP — используем диапазон вместо .in()
      const minDate = days[days.length - 1]
      const { data: attData, error: attError } = await supabase
        .from('attendance')
        .select('date, group_name')
        .gte('date', minDate)
        .lt('date', today)


      const markedSet = new Set<string>(
        (attData || []).map(a => `${String(a.date).slice(0, 10)}|${a.group_name}`)
      )

      const missing = expected.filter(e => !markedSet.has(`${e.date}|${e.group_name}`))
      missing.sort((a, b) => b.date.localeCompare(a.date))
      setMissingDays(missing)

      // Незаполненные журналы тренировок (с 16.04.2026)
      const LOG_START = '2026-04-16'
      const expectedLogs = expected.filter(e => e.date >= LOG_START)
      if (expectedLogs.length > 0) {
        const logMinDate = expectedLogs[expectedLogs.length - 1].date
        const { data: logsData } = await supabase
          .from('training_logs').select('date, group_name')
          .gte('date', logMinDate)
          .lt('date', today)

        const logsSet = new Set<string>(
          (logsData || []).map(l => `${String(l.date).slice(0, 10)}|${l.group_name}`)
        )
        const missingL = expectedLogs
          .filter(e => !logsSet.has(`${e.date}|${e.group_name}`))
          .sort((a, b) => b.date.localeCompare(a.date))
        setMissingLogs(missingL)
      }
    }
    loadMissingDays()
  }, [])

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
    const { error: attErr } = await supabase.from('attendance').upsert([...mainRows, ...guestRows], { onConflict: 'student_id,date' })
    if (attErr) { alert('Ошибка сохранения посещаемости: ' + attErr.message); setSaving(false); return }

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

    const noSubPresent = allStudents.filter(s => present.has(s.id) && !originalPresent.has(s.id) && s.subs.length === 0 && !s.has_pending)
    if (noSubPresent.length > 0) {
      alert(`⚠️ Не забудь внести абонемент!\n\nПрисутствовали без абонемента:\n${noSubPresent.map(s => `• ${s.name}`).join('\n')}`)
    }
  }

  async function openLogSheet() {
    const { data } = await supabase
      .from('training_logs')
      .select('id, warmup_items, fitness_items, basic_techniques, applied_techniques, taolu_items, qigong_items, aikido_ukemi, aikido_techniques, aikido_weapons, aikido_etiquette, aikido_movement, notes')
      .eq('group_name', group)
      .eq('date', date)
      .order('created_at', { ascending: false })
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
    loadLogDates()
  }

  function sessionsColor(n: number | null) {
    if (n === null) return ''
    if (n === 0) return 'text-red-500 font-bold'
    if (n <= 2) return 'text-orange-500 font-medium'
    return 'text-gray-400'
  }

  const guestsPresentCount = guests.filter(g => present.has(g.id)).length
  const mainPresentCount = students.filter(s => present.has(s.id)).length
  const effectiveGuestCount = guestsLoaded ? guestsPresentCount : savedGuestCount

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Посещаемость</h1>
      </div>

      <OnboardingHint id="attendance" className="mb-4" />

      {missingDays.length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <span className="text-orange-500 text-base shrink-0 mt-0.5">⚠️</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-orange-800 mb-1">
                  Не отмечено {missingDays.length} {missingDays.length === 1 ? 'тренировка' : missingDays.length <= 4 ? 'тренировки' : 'тренировок'} за 14 дней
                </div>
                <div className="space-y-0.5">
                  {(showAllMissing ? missingDays : missingDays.slice(0, 3)).map(m => (
                    <button
                      key={`${m.date}|${m.group_name}`}
                      onClick={() => { setDate(m.date); setGroup(m.group_name) }}
                      className="block text-xs text-orange-700 hover:text-orange-900 hover:underline text-left"
                    >
                      {new Date(m.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })} — {m.group_name}{m.trainer_name ? ` · ${m.trainer_name}` : ''}
                    </button>
                  ))}
                  {missingDays.length > 3 && (
                    <button onClick={() => setShowAllMissing(v => !v)}
                      className="text-xs text-orange-500 hover:text-orange-700 mt-1">
                      {showAllMissing ? 'Скрыть' : `Ещё ${missingDays.length - 3}...`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {missingLogs.length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-orange-500 text-base shrink-0 mt-0.5">⚠️</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-orange-800 mb-1">
                Не заполнен журнал {missingLogs.length} {missingLogs.length === 1 ? 'тренировки' : 'тренировок'} за 14 дней
              </div>
              <div className="space-y-0.5">
                {missingLogs.map(m => (
                  <button
                    key={`log|${m.date}|${m.group_name}`}
                    onClick={() => { setDate(m.date); setGroup(m.group_name) }}
                    className="block text-xs text-orange-700 hover:text-orange-900 hover:underline text-left"
                  >
                    {new Date(m.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })} — {m.group_name}{m.trainer_name ? ` · ${m.trainer_name}` : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <div className="flex items-center">
                    <button onClick={() => toggle(s.id)} className="flex items-center px-4 py-3 flex-1 min-w-0">
                      <span className="text-xl mr-3">{present.has(s.id) ? '✅' : '⬜'}</span>
                      <span className="font-medium text-gray-800 text-left truncate">{s.name}</span>
                    </button>
                    <Link href={`/students/${s.id}`} onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 pr-4 py-3 shrink-0">
                      {s.subs.length === 0 ? (
                        s.has_pending ? (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⏳ Ожидает активации</span>
                        ) : (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Нет абонемента</span>
                        )
                      ) : chosenSub && (
                        <span className={`text-sm ${sessionsColor(chosenSub.sessions_left)}`}>
                          {chosenSub.sessions_left === 0 ? '❗ 0 зан.' : `${chosenSub.sessions_left} зан.`}
                        </span>
                      )}
                      <span className="text-gray-300 text-sm ml-1">›</span>
                    </Link>
                  </div>
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
              ? `▲ Скрыть гостей${effectiveGuestCount > 0 ? ` (отмечено: ${effectiveGuestCount})` : ''}`
              : `+ Гости из других групп${effectiveGuestCount > 0 ? ` (${effectiveGuestCount})` : ''}`}
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
            Присутствует: {mainPresentCount} из {students.length}
            {effectiveGuestCount > 0 && ` + ${effectiveGuestCount} гост.`}
          </div>
          {canEdit && (
            <button onClick={save} disabled={saving}
              className="w-full bg-black text-white py-3 rounded-xl font-medium disabled:opacity-50">
              {saved ? '✓ Сохранено!' : saving ? 'Сохранение...' : 'Сохранить посещаемость'}
            </button>
          )}

          {/* Training Log Button */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={openLogSheet}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors
                ${logDates.has(date)
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
              {logDates.has(date) ? '📝 Редактировать журнал' : '📝 Добавить журнал тренировки'}
            </button>
          </div>

          {/* Training Photo Block */}
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-800">📸 Фото тренировки</span>
              {sessionPhotos.length > 0 && (
                photoPublished
                  ? <span className="text-xs text-green-500 font-medium">✅ Опубликовано</span>
                  : <span className="text-xs text-gray-400">{sessionPhotos.length} фото</span>
              )}
            </div>

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

            <div className="flex gap-2">
              <label className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border border-dashed cursor-pointer transition-colors
                ${photoUploading
                  ? 'opacity-50 cursor-not-allowed border-gray-300 text-gray-400'
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
                  ? 'opacity-50 cursor-not-allowed border-gray-300 text-gray-400'
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

            {sessionPhotos.length > 0 && !photoPublished && (
              <button
                onClick={handlePublishToTelegram}
                disabled={photoPublishing}
                className="mt-2 w-full py-2.5 rounded-xl text-sm font-medium bg-[#229ED9] text-white disabled:opacity-50 transition-opacity"
              >
                {photoPublishing ? 'Публикую...' : '✈️ Опубликовать в Telegram'}
              </button>
            )}
            {photoPublished && (
              <button
                onClick={handleResendToTelegram}
                disabled={photoPublishing}
                className="mt-2 w-full py-2.5 rounded-xl text-sm font-medium bg-[#229ED9] text-white disabled:opacity-50 transition-opacity"
              >
                {photoPublishing ? 'Публикую...' : '🔄 Отправить заново'}
              </button>
            )}
          </div>
        </>
      )}

      <TrainingLogSheet
        isOpen={showLogSheet}
        onClose={handleLogSheetClose}
        groupName={group}
        trainerName={userName || ''}
        date={date}
        existingLog={existingLog}
      />
    </main>
  )
}
