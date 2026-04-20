'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import { localDateStr } from '@/lib/dates'

type Student = {
  id: string
  name: string
  group_name: string | null
  birth_date: string | null
  health_notes: string | null
  photo_url: string | null
  status: string
}

type Subscription = {
  id: string
  type: string
  sessions_total: number | null
  sessions_left: number | null
  start_date: string | null
  end_date: string | null
  paid: boolean
  amount: number | null
  bonuses: Record<string, number> | null
  bonuses_used: Record<string, number | string[]> | null
  is_pending: boolean
}

type Attendance = {
  date: string
  present: boolean
}

function getAge(birthDate: string | null) {
  if (!birthDate) return null
  const diff = Date.now() - new Date(birthDate).getTime()
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
}

export default function TrainerStudentCard() {
  const { id } = useParams<{ id: string }>()
  const { theme } = useTheme()
  const [student, setStudent] = useState<Student | null>(null)
  const [sub, setSub] = useState<Subscription | null>(null)
  const [pendingSub, setPendingSub] = useState<Subscription | null>(null)
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [bonusDatePicker, setBonusDatePicker] = useState<string | null>(null)
  const [bonusDate, setBonusDate] = useState(new Date().toISOString().split('T')[0])

  const dark = theme === 'dark'
  const card = dark ? 'bg-[#2C2C2E] border-[#3A3A3C]' : 'bg-white border-gray-100 shadow-sm'
  const textPrimary = dark ? 'text-[#E5E5E7]' : 'text-gray-800'
  const textSecondary = dark ? 'text-[#8E8E93]' : 'text-gray-400'
  const textMuted = dark ? 'text-[#636366]' : 'text-gray-500'
  const divider = dark ? 'border-[#3A3A3C]' : 'border-gray-100'

  useEffect(() => {
    if (id) loadData()
  }, [id])

  async function loadData() {
    const [{ data: s }, { data: subData }, { data: attData }] = await Promise.all([
      supabase.from('students').select('id, name, group_name, birth_date, health_notes, photo_url, status').eq('id', id).single(),
      supabase.from('subscriptions').select('id, type, sessions_total, sessions_left, start_date, end_date, paid, amount, bonuses, bonuses_used, is_pending')
        .eq('student_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('attendance').select('date, present').eq('student_id', id)
        .order('date', { ascending: false }).limit(20),
    ])
    setStudent(s)
    setSub(subData?.is_pending ? null : subData)
    setPendingSub(subData?.is_pending ? subData : null)
    setAttendance(attData || [])
    setLoading(false)
  }

  async function useBonus(bonusName: string, date: string) {
    if (!sub) return
    const bonuses = sub.bonuses || {}
    const total = bonuses[bonusName] || 0
    const val = sub.bonuses_used?.[bonusName]
    const usedDates: string[] = Array.isArray(val) ? val : Array.from({ length: (val as number) || 0 }, () => '')
    if (usedDates.length >= total) return
    const newUsed = { ...(sub.bonuses_used || {}), [bonusName]: [...usedDates.filter(d => d !== ''), date] }
    await supabase.from('subscriptions').update({ bonuses_used: newUsed }).eq('id', sub.id)
    setSub({ ...sub, bonuses_used: newUsed })
    setBonusDatePicker(null)
  }

  async function cancelBonus(bonusName: string, index: number) {
    if (!sub) return
    const val = sub.bonuses_used?.[bonusName]
    const usedDates: string[] = Array.isArray(val) ? val : Array.from({ length: (val as number) || 0 }, () => '')
    const newDates = usedDates.filter((_, i) => i !== index)
    const newUsed = { ...(sub.bonuses_used || {}), [bonusName]: newDates }
    await supabase.from('subscriptions').update({ bonuses_used: newUsed }).eq('id', sub.id)
    setSub({ ...sub, bonuses_used: newUsed })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400" style={{ background: 'var(--bg)' }}>Загрузка...</div>
  )
  if (!student) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400" style={{ background: 'var(--bg)' }}>Ученик не найден</div>
  )

  const age = getAge(student.birth_date)
  const presentCount = attendance.filter(a => a.present).length
  const totalCount = attendance.length

  function sessionsColor(left: number | null) {
    if (left === null) return textMuted
    if (left === 0) return 'text-red-500 font-bold'
    if (left <= 2) return 'text-orange-500 font-semibold'
    return 'text-green-500 font-semibold'
  }

  return (
    <main className="max-w-lg mx-auto p-4" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/trainer/students" className={`text-xl font-bold leading-none hover:opacity-70 ${textSecondary}`}>←</Link>
        <h1 className={`text-xl font-bold ${textPrimary}`}>Карточка ученика</h1>
      </div>

      {/* Profile */}
      <div className={`rounded-2xl border p-5 mb-4 ${card}`}>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden shrink-0 ${dark ? 'bg-[#3A3A3C] text-[#636366]' : 'bg-gray-100 text-gray-400'}`}>
            {student.photo_url
              ? <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
              : student.name[0]}
          </div>
          <div>
            <div className={`text-lg font-bold ${textPrimary}`}>{student.name}</div>
            <div className={`text-sm mt-0.5 ${textSecondary}`}>
              {student.group_name || '—'}
              {age ? ` · ${age} лет` : ''}
            </div>
            {student.birth_date && (
              <div className={`text-xs mt-0.5 ${textSecondary}`}>
                {new Date(student.birth_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Health notes */}
      {student.health_notes && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-4">
          <div className="text-xs font-semibold text-orange-700 mb-1">⚠️ Здоровье / ограничения</div>
          <div className="text-sm text-orange-900">{student.health_notes}</div>
        </div>
      )}

      {/* Subscription */}
      {(() => {
        const today = localDateStr()
        const isExpiredByDate = sub?.end_date ? sub.end_date < today : false
        const isExpiredBySessions = sub !== null && sub.sessions_left !== null && sub.sessions_left <= 0
        const isExpired = isExpiredByDate || isExpiredBySessions
        const bonusEntries = sub?.bonuses ? Object.entries(sub.bonuses) : []
        return (
          <div className={`rounded-2xl border p-4 mb-4 ${card} ${isExpired ? 'border-red-400' : ''}`}>
            <div className={`text-xs font-semibold uppercase tracking-wide mb-3 ${textMuted}`}>Абонемент</div>
            {isExpired && (
              <div className="bg-red-500 text-white text-xs font-medium text-center py-1.5 rounded-xl mb-3">
                ❌ Абонемент окончен
              </div>
            )}
            {sub ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${textPrimary}`}>{sub.type}</span>
                  {!sub.paid && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Не оплачен</span>
                  )}
                </div>
                {sub.sessions_total !== null && (
                  <div className={`flex items-center justify-between border-t pt-2 ${divider}`}>
                    <span className={`text-sm ${textSecondary}`}>Занятий осталось</span>
                    <span className={`text-sm ${sessionsColor(sub.sessions_left)}`}>
                      {sub.sessions_left ?? '—'} / {sub.sessions_total}
                    </span>
                  </div>
                )}
                {sub.start_date && (
                  <div className={`flex items-center justify-between border-t pt-2 ${divider}`}>
                    <span className={`text-sm ${textSecondary}`}>Начало</span>
                    <span className={`text-sm ${textPrimary}`}>
                      {new Date(sub.start_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                )}
                {sub.end_date && (
                  <div className={`flex items-center justify-between border-t pt-2 ${divider}`}>
                    <span className={`text-sm ${textSecondary}`}>Действует до</span>
                    <span className={`text-sm ${isExpiredByDate ? 'text-red-500 font-medium' : textPrimary}`}>
                      {new Date(sub.end_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                )}
                {sub.amount && (
                  <div className={`flex items-center justify-between border-t pt-2 ${divider}`}>
                    <span className={`text-sm ${textSecondary}`}>Стоимость</span>
                    <span className={`text-sm ${textPrimary}`}>{sub.amount.toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
                {bonusEntries.length > 0 && (
                  <div className={`border-t pt-2 ${divider}`}>
                    <div className={`text-xs font-medium mb-2 ${textMuted}`}>🎁 Бонусы:</div>
                    <div className="space-y-2">
                      {bonusEntries.map(([key, total]) => {
                        const val = sub.bonuses_used?.[key]
                        const usedDates: string[] = Array.isArray(val) ? val : Array.from({ length: (val as number) || 0 }, () => '')
                        const used = usedDates.length
                        const left = total - used
                        const isPickerOpen = bonusDatePicker === key
                        return (
                          <div key={key}>
                            <div className={`text-xs flex items-center justify-between px-2 py-1.5 rounded-lg ${left > 0 ? 'bg-purple-100' : 'bg-gray-100'}`}>
                              <div>
                                <span className={left > 0 ? 'text-purple-700' : 'text-gray-400'}>{key}</span>
                                <span className={`ml-2 ${left > 0 ? 'text-purple-500' : 'text-gray-400'}`}>{used}/{total}</span>
                                {usedDates.map((d, i) => (
                                  <div key={i} className="flex items-center gap-1 mt-0.5">
                                    <span className="text-gray-400">✓ {d || '—'}</span>
                                    <button onClick={() => cancelBonus(key, i)}
                                      className="text-red-400 hover:text-red-600 leading-none text-xs">✕</button>
                                  </div>
                                ))}
                              </div>
                              {left > 0 && !isPickerOpen && (
                                <button onClick={() => { setBonusDatePicker(key); setBonusDate(new Date().toISOString().split('T')[0]) }}
                                  className="text-xs bg-purple-600 text-white px-2 py-1 rounded-lg ml-2 shrink-0">
                                  Использовать
                                </button>
                              )}
                              {left === 0 && <span className="text-gray-400 ml-2">✓ все</span>}
                            </div>
                            {isPickerOpen && (
                              <div className="mt-1 flex gap-2 items-center px-1">
                                <input type="date" value={bonusDate} onChange={e => setBonusDate(e.target.value)}
                                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none bg-white text-gray-800" />
                                <button onClick={() => useBonus(key, bonusDate)}
                                  className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg shrink-0">Ок</button>
                                <button onClick={() => setBonusDatePicker(null)}
                                  className="text-xs text-gray-400 px-2 py-1 rounded-lg border border-gray-200 shrink-0">✕</button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : pendingSub ? (
              <div className="space-y-2">
                <div className="bg-amber-500/20 text-amber-500 text-xs font-medium text-center py-1.5 rounded-xl">
                  ⏳ Абонемент ожидает активации
                </div>
                <div className={`text-sm ${textPrimary}`}>{pendingSub.type}</div>
                {pendingSub.sessions_total !== null && (
                  <div className={`flex items-center justify-between border-t pt-2 ${divider}`}>
                    <span className={`text-sm ${textSecondary}`}>Занятий</span>
                    <span className={`text-sm ${textPrimary}`}>{pendingSub.sessions_total}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-orange-500 font-medium">⚠️ Нет абонемента</div>
            )}
          </div>
        )
      })()}

      {/* Attendance */}
      <div className={`rounded-2xl border p-4 ${card}`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`text-xs font-semibold uppercase tracking-wide ${textMuted}`}>Посещаемость</div>
          {totalCount > 0 && (
            <span className={`text-xs ${textSecondary}`}>{presentCount} из {totalCount}</span>
          )}
        </div>
        {attendance.length === 0 ? (
          <div className={`text-sm ${textSecondary}`}>Нет записей</div>
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            {attendance.map(a => (
              <span key={a.date}
                className={`text-xs px-2 py-1 rounded-lg ${a.present ? 'bg-green-100 text-green-700' : dark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-400'}`}>
                {new Date(a.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                {a.present ? ' ✓' : ' —'}
              </span>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
