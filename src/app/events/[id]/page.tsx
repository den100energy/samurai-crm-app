'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { TrainingLogSheet } from '@/components/TrainingLogSheet'
import { TrainingLogData } from '@/lib/training-checklists'

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
  bonuses_used: Record<string, number | string[]> | null
  sessions_left: number | null
}

type Event = {
  id: string
  name: string
  date: string
  time_start: string | null
  time_end: string | null
  price: number | null
  description: string | null
  bonus_type: string | null
  group_restriction: string[] | null
  trainer_name: string | null
  trainer_name_extra: string | null
}

const ATTENDANCE_LABELS: Record<string, { label: string; color: string }> = {
  bonus:   { label: 'Бонус',   color: 'bg-purple-100 text-purple-700' },
  session: { label: 'Занятие', color: 'bg-gray-100 text-gray-600' },
  paid:    { label: 'Платный', color: 'bg-green-100 text-green-700' },
  regular: { label: 'Участник', color: 'bg-gray-100 text-gray-500' },
}

const BONUS_TYPES = ['тренировка с оружием', 'мастер-класс', 'инд.тренировка']
const GROUPS = ['Старт', 'Основная (нач.)', 'Основная (оп.)', 'Цигун', 'Индивидуальные']

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [subMap, setSubMap] = useState<Record<string, SubInfo>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [addGroup, setAddGroup] = useState('Все')
  const [trainers, setTrainers] = useState<string[]>([])

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<{ name: string; date: string; time_start: string; time_end: string; price: string; description: string; bonus_type: string; group_restriction: string[]; trainer_name: string; trainer_name_extra: string }>({ name: '', date: '', time_start: '', time_end: '', price: '', description: '', bonus_type: '', group_restriction: [], trainer_name: '', trainer_name_extra: '' })
  const [saving, setSaving] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [notifyResult, setNotifyResult] = useState<string | null>(null)

  // Training log state
  const [showLogSheet, setShowLogSheet] = useState(false)
  const [existingLog, setExistingLog] = useState<{ id: string; data: TrainingLogData } | null>(null)
  const [hasLog, setHasLog] = useState(false)

  async function load() {
    const [{ data: ev }, { data: parts }, { data: students }, { data: subs }, { data: tr }] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('event_participants').select('*, students(name, group_name)').eq('event_id', id),
      supabase.from('students').select('id, name, group_name').eq('status', 'active').order('name'),
      supabase.from('subscriptions').select('id, student_id, bonuses, bonuses_used, sessions_left').order('created_at', { ascending: false }),
      supabase.from('trainers').select('name').order('name'),
    ])

    setEvent(ev)
    setTrainers((tr || []).map(t => t.name))
    setParticipants(parts || [])

    const map: Record<string, SubInfo> = {}
    for (const sub of (subs || [])) {
      if (!map[sub.student_id]) map[sub.student_id] = sub
    }
    setSubMap(map)

    const filtered = ev?.group_restriction && ev.group_restriction.length > 0
      ? (students || []).filter(s => s.group_name && ev.group_restriction!.includes(s.group_name))
      : (students || [])
    setAllStudents(filtered)
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { if (event) checkLogExists() }, [event?.id])

  function startEdit() {
    if (!event) return
    setEditForm({
      name: event.name,
      date: event.date,
      time_start: event.time_start || '',
      time_end: event.time_end || '',
      price: event.price != null ? String(event.price) : '',
      description: event.description || '',
      bonus_type: event.bonus_type || '',
      group_restriction: event.group_restriction || [],
      trainer_name: event.trainer_name || '',
      trainer_name_extra: event.trainer_name_extra || '',
    })
    setEditing(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('events').update({
      name: editForm.name,
      date: editForm.date,
      time_start: editForm.time_start || null,
      time_end: editForm.time_end || null,
      price: editForm.price !== '' ? parseFloat(editForm.price) : null,
      description: editForm.description || null,
      bonus_type: editForm.bonus_type || null,
      group_restriction: editForm.group_restriction.length > 0 ? editForm.group_restriction : null,
      trainer_name: editForm.trainer_name || null,
      trainer_name_extra: editForm.trainer_name_extra || null,
    }).eq('id', id)
    setSaving(false)
    setEditing(false)
    load()
  }

  async function notifyStudents() {
    setNotifying(true)
    setNotifyResult(null)
    try {
      const res = await fetch('/api/notify-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: id }),
      })
      const data = await res.json()
      setNotifyResult(`✅ Отправлено ${data.sent} получателям`)
    } catch {
      setNotifyResult('❌ Ошибка отправки')
    } finally {
      setNotifying(false)
    }
  }

  async function openLogSheet() {
    if (!event) return
    const { data } = await supabase
      .from('training_logs')
      .select('id, warmup_items, fitness_items, basic_techniques, applied_techniques, taolu_items, qigong_items, aikido_ukemi, aikido_techniques, aikido_weapons, aikido_etiquette, aikido_movement, notes')
      .eq('group_name', event.name)
      .eq('trainer_name', event.trainer_name || '')
      .eq('date', event.date)
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

  async function checkLogExists() {
    if (!event) return
    const { data } = await supabase
      .from('training_logs')
      .select('id')
      .eq('group_name', event.name)
      .eq('trainer_name', event.trainer_name || '')
      .eq('date', event.date)
      .maybeSingle()
    setHasLog(!!data)
  }

  function handleLogSheetClose() {
    setShowLogSheet(false)
    checkLogExists()
  }

  function getBonusUsedCount(bonusesUsed: Record<string, number | string[]> | null, key: string): number {
    const val = bonusesUsed?.[key]
    if (!val) return 0
    if (Array.isArray(val)) return val.length
    return val as number
  }

  function getBonusStatus(studentId: string): { hasBonusAvailable: boolean; bonusLeft: number } {
    if (!event?.bonus_type) return { hasBonusAvailable: false, bonusLeft: 0 }
    const sub = subMap[studentId]
    if (!sub?.bonuses) return { hasBonusAvailable: false, bonusLeft: 0 }
    const total = sub.bonuses[event.bonus_type] || 0
    const used = getBonusUsedCount(sub.bonuses_used, event.bonus_type)
    return { hasBonusAvailable: total > used, bonusLeft: total - used }
  }

  async function addParticipant(attendanceType: string) {
    if (!selectedId) return
    const sub = subMap[selectedId]
    const eventDate = event?.date || new Date().toISOString().split('T')[0]

    await supabase.from('event_participants').insert({
      event_id: id,
      student_id: selectedId,
      paid: attendanceType === 'paid',
      amount: attendanceType === 'paid' ? (event?.price || null) : null,
      attendance_type: attendanceType,
    })

    if (sub && attendanceType === 'bonus' && event?.bonus_type) {
      const currentUsed = sub.bonuses_used || {}
      const existing = currentUsed[event.bonus_type]
      const existingDates: string[] = Array.isArray(existing) ? existing : Array.from({ length: (existing as number) || 0 }, () => '')
      const newUsed = { ...currentUsed, [event.bonus_type]: [...existingDates.filter(d => d !== ''), eventDate] }
      await supabase.from('subscriptions').update({ bonuses_used: newUsed }).eq('id', sub.id)
    }
    if (sub && attendanceType === 'session' && sub.sessions_left != null) {
      await supabase.from('subscriptions').update({ sessions_left: Math.max(0, sub.sessions_left - 1) }).eq('id', sub.id)
    }

    setShowAdd(false)
    setSelectedId('')
    load()
  }

  async function deleteEvent() {
    if (!confirm('Удалить мероприятие? Это действие нельзя отменить.')) return
    await supabase.from('events').delete().eq('id', id)
    router.push('/events')
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
  const isWeaponTraining = event.bonus_type === 'тренировка с оружием'

  function getWeaponTrainingType(studentId: string): 'bonus' | 'session' | 'paid' {
    const { hasBonusAvailable } = getBonusStatus(studentId)
    if (hasBonusAvailable) return 'bonus'
    const sub = subMap[studentId]
    if (sub && sub.sessions_left != null && sub.sessions_left > 0) return 'session'
    return 'paid'
  }

  const bonusCnt = participants.filter(p => p.attendance_type === 'bonus').length
  const sessionCnt = participants.filter(p => p.attendance_type === 'session').length
  const paidCnt = participants.filter(p => p.attendance_type === 'paid').length
  const totalCollected = participants.filter(p => p.paid).reduce((sum, p) => sum + (p.amount || event.price || 0), 0)

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/events" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">{event.name}</h1>
          {(event.bonus_type || (event.group_restriction && event.group_restriction.length > 0)) && (
            <div className="flex flex-wrap gap-2 mt-0.5">
              {event.bonus_type && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{event.bonus_type}</span>
              )}
              {event.group_restriction && event.group_restriction.map(g => (
                <span key={g} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{g}</span>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => {
          navigator.clipboard.writeText(`${window.location.origin}/events/${id}/register`)
          alert('Ссылка скопирована!')
        }} className="text-sm border border-gray-200 px-3 py-1.5 rounded-xl text-gray-600 hover:border-gray-400">
          🔗
        </button>
        <button onClick={startEdit}
          className="text-sm border border-gray-200 px-3 py-1.5 rounded-xl text-gray-600 hover:border-gray-400">
          ✎ Изменить
        </button>
        <button onClick={deleteEvent}
          className="text-sm border border-red-100 px-3 py-1.5 rounded-xl text-red-400 hover:border-red-300 hover:text-red-600">
          🗑
        </button>
      </div>

      {/* Edit form */}
      {editing && (
        <form onSubmit={saveEdit} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm mb-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold text-gray-800 text-sm">Редактирование мероприятия</div>
            <button type="button" onClick={() => setEditing(false)} className="text-gray-400 text-lg">✕</button>
          </div>
          <input required value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})}
            placeholder="Название *" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
          <input required value={editForm.date || ''} onChange={e => setEditForm({...editForm, date: e.target.value})}
            type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Начало</label>
              <input value={editForm.time_start || ''} onChange={e => setEditForm({...editForm, time_start: e.target.value})}
                type="time" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Конец</label>
              <input value={editForm.time_end || ''} onChange={e => setEditForm({...editForm, time_end: e.target.value})}
                type="time" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <select value={editForm.bonus_type || ''} onChange={e => setEditForm({...editForm, bonus_type: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
            <option value="">Тип бонуса</option>
            {BONUS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input value={editForm.price ?? ''} onChange={e => setEditForm({...editForm, price: e.target.value})}
            placeholder="Стоимость (₽)" type="number" min="0"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
          <div className="border border-gray-200 rounded-xl px-3 py-2">
            <div className="text-xs text-gray-400 mb-2">Группы (пусто = все)</div>
            <div className="flex flex-wrap gap-2">
              {GROUPS.map(g => (
                <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={editForm.group_restriction.includes(g)}
                    onChange={e => setEditForm({...editForm, group_restriction: e.target.checked ? [...editForm.group_restriction, g] : editForm.group_restriction.filter(x => x !== g)})}
                    className="rounded" />
                  <span className="text-sm text-gray-700">{g}</span>
                </label>
              ))}
            </div>
          </div>
          <select value={editForm.trainer_name || ''} onChange={e => setEditForm({...editForm, trainer_name: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
            <option value="">Ответственный тренер</option>
            {trainers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={editForm.trainer_name_extra || ''} onChange={e => setEditForm({...editForm, trainer_name_extra: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
            <option value="">Доп. тренер (необязательно)</option>
            {trainers.filter(t => t !== editForm.trainer_name).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})}
            placeholder="Описание" rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="px-4 border border-gray-200 text-gray-500 py-2 rounded-xl text-sm">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Event info */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Дата</span><span>{event.date}{event.time_start && ` · ${event.time_start.slice(0, 5)}${event.time_end ? `–${event.time_end.slice(0, 5)}` : ''}`}</span></div>
          {event.trainer_name && <div className="flex justify-between"><span className="text-gray-400">Тренер</span><span>👤 {event.trainer_name}</span></div>}
          {event.trainer_name_extra && <div className="flex justify-between"><span className="text-gray-400">Доп. тренер</span><span>👤 {event.trainer_name_extra}</span></div>}
          {event.price && <div className="flex justify-between"><span className="text-gray-400">Стоимость</span><span>{event.price.toLocaleString()} ₽</span></div>}
          {event.description && <div className="flex justify-between"><span className="text-gray-400">Описание</span><span className="text-right max-w-[60%]">{event.description}</span></div>}
        </div>

        {/* Notify button */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button onClick={notifyStudents} disabled={notifying}
            className="w-full flex items-center justify-center gap-2 bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
            {notifying ? '...' : '📨 Уведомить учеников в Telegram'}
          </button>
          {notifyResult && <div className="text-xs text-center mt-2 text-gray-500">{notifyResult}</div>}
        </div>

        {/* Training Log button — only for weapon training */}
        {isWeaponTraining && (
          <div className="mt-2">
            <button
              onClick={openLogSheet}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium border transition-colors
                ${hasLog
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {hasLog ? '📝 Редактировать журнал тренировки' : '📝 Журнал тренировки'}
            </button>
          </div>
        )}
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
          {/* Вкладки по группам */}
          {(() => {
            const groupsInAvailable = ['Все', ...Array.from(new Set(available.map(s => s.group_name).filter(Boolean))) as string[]]
            const filtered = addGroup === 'Все' ? available : available.filter(s => s.group_name === addGroup)
            return (
              <>
                <div className="flex gap-1.5 overflow-x-auto px-3 pt-3 pb-2 border-b border-gray-100">
                  {groupsInAvailable.map(g => (
                    <button key={g}
                      onClick={() => { setAddGroup(g); setSelectedId('') }}
                      className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0
                        ${addGroup === g ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {g}
                    </button>
                  ))}
                </div>

                {/* Список учеников */}
                <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-4">Все добавлены</div>
                  ) : (
                    filtered.map(s => (
                      <button key={s.id}
                        onClick={() => setSelectedId(s.id === selectedId ? '' : s.id)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors
                          ${selectedId === s.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <span className={`text-sm font-medium ${selectedId === s.id ? 'text-blue-700' : 'text-gray-700'}`}>
                          {s.name}
                        </span>
                        {selectedId === s.id && <span className="text-blue-500 text-xs">✓ выбран</span>}
                      </button>
                    ))
                  )}
                </div>
              </>
            )
          })()}

          {/* Кнопки оплаты — появляются после выбора */}
          {selectedId && (
            <div className="px-4 py-3 border-t border-gray-100 space-y-2">
              {isWeaponTraining ? (() => {
                const autoType = getWeaponTrainingType(selectedId)
                const labels = {
                  bonus: { text: `🎁 Бонус (осталось ${bonusLeft})`, cls: 'bg-purple-500 text-white' },
                  session: { text: `✅ Занятие с абонемента (${selectedSub?.sessions_left ?? 0} зан.)`, cls: 'bg-gray-700 text-white' },
                  paid: { text: '💰 Платный (нет абонемента)', cls: 'bg-green-600 text-white' },
                }
                const { text, cls } = labels[autoType]
                return (
                  <button onClick={() => addParticipant(autoType)}
                    className={`w-full py-2 rounded-xl text-sm font-medium ${cls}`}>
                    {text}
                  </button>
                )
              })() : (
                <>
                  {isBonusEvent && (
                    <div className={`text-xs px-3 py-2 rounded-xl ${hasBonusAvailable ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-500'}`}>
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
                </>
              )}
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

      <TrainingLogSheet
        isOpen={showLogSheet}
        onClose={handleLogSheetClose}
        groupName={event.name}
        trainerName={event.trainer_name || ''}
        date={event.date}
        existingLog={existingLog}
      />
    </main>
  )
}
