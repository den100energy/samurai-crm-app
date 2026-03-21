'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Student = {
  id: string
  name: string
  group_name: string | null
  health_notes: string | null
  birth_date: string | null
}

type Attendance = { student_id: string; date: string; present: boolean }

export default function TrainerStudentsPage() {
  const { userName, loading } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [myGroups, setMyGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!loading && userName) loadData()
  }, [loading, userName])

  async function loadData() {
    const { data: slots } = await supabase.from('schedule').select('group_name').eq('trainer_name', userName)
    let groups = [...new Set((slots || []).map(s => s.group_name).filter(Boolean))] as string[]

    if (groups.length === 0) {
      // Расписание не настроено — показываем всех учеников
      const { data: studs } = await supabase.from('students').select('group_name').eq('status', 'active')
      groups = [...new Set((studs || []).map(s => s.group_name).filter(Boolean))] as string[]
    }

    setMyGroups(groups)
    if (groups.length === 0) { setDataLoading(false); return }

    const { data: studs } = await supabase
      .from('students')
      .select('id, name, group_name, health_notes, birth_date')
      .in('group_name', groups)
      .eq('status', 'active')
      .order('name')

    const studList = studs || []
    setStudents(studList)

    if (studList.length > 0) {
      const { data: att } = await supabase
        .from('attendance')
        .select('student_id, date, present')
        .in('student_id', studList.map(s => s.id))
        .order('date', { ascending: false })
        .limit(200)
      setAttendance(att || [])
    }

    setDataLoading(false)
  }

  const filtered = students.filter(s => {
    const inGroup = selectedGroup === 'all' || s.group_name === selectedGroup
    const inSearch = s.name.toLowerCase().includes(search.toLowerCase())
    return inGroup && inSearch
  })

  function getAge(birthDate: string | null) {
    if (!birthDate) return null
    const diff = Date.now() - new Date(birthDate).getTime()
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
  }

  function getLastVisits(studentId: string) {
    return attendance
      .filter(a => a.student_id === studentId)
      .slice(0, 8)
  }

  if (loading || dataLoading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>
  )

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/trainer" className="text-gray-500 hover:text-black text-xl font-bold">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Мои ученики</h1>
        <span className="ml-auto text-sm text-gray-400">{filtered.length} чел.</span>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по имени..."
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none mb-3"
      />

      {myGroups.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button onClick={() => setSelectedGroup('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors
              ${selectedGroup === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
            Все
          </button>
          {myGroups.map(g => (
            <button key={g} onClick={() => setSelectedGroup(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors
                ${selectedGroup === g ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
              {g}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Нет учеников</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const age = getAge(s.birth_date)
            const visits = getLastVisits(s.id)
            const isOpen = expanded === s.id
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="w-full flex items-center px-4 py-3 text-left"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{s.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {s.group_name}{age ? ` · ${age} лет` : ''}
                    </div>
                  </div>
                  <span className="text-gray-300 text-sm">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                    {s.health_notes && (
                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                        <div className="text-xs font-semibold text-orange-700 mb-1">⚠️ Здоровье</div>
                        <div className="text-sm text-orange-800">{s.health_notes}</div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs text-gray-500 mb-2">Последние занятия:</div>
                      {visits.length === 0 ? (
                        <div className="text-xs text-gray-400">Нет данных</div>
                      ) : (
                        <div className="flex gap-1.5 flex-wrap">
                          {visits.map(v => (
                            <span key={v.date}
                              className={`text-xs px-2 py-1 rounded-lg ${v.present ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-400'}`}>
                              {new Date(v.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                              {v.present ? ' ✓' : ' —'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
