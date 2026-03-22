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
  photo_url: string | null
}

export default function TrainerStudentsPage() {
  const { userName, loading } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [myGroups, setMyGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [search, setSearch] = useState('')
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
      .select('id, name, group_name, health_notes, birth_date, photo_url')
      .in('group_name', groups)
      .eq('status', 'active')
      .order('name')

    setStudents(studs || [])
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
            return (
              <Link key={s.id} href={`/trainer/students/${s.id}`}
                className="flex items-center bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-400 overflow-hidden shrink-0 mr-3">
                  {s.photo_url
                    ? <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" />
                    : s.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800">{s.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {s.group_name || '—'}{age ? ` · ${age} лет` : ''}
                    {s.health_notes && <span className="ml-1 text-orange-500">⚠️</span>}
                  </div>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
