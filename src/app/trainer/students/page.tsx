'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTheme } from '@/components/ThemeProvider'

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
  const { theme } = useTheme()
  const [students, setStudents] = useState<Student[]>([])
  const [myGroups, setMyGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [search, setSearch] = useState('')
  const [dataLoading, setDataLoading] = useState(true)

  const dark = theme === 'dark'
  const card = dark ? 'bg-[#2C2C2E] border-[#3A3A3C]' : 'bg-white border-gray-100 shadow-sm'
  const textPrimary = dark ? 'text-[#E5E5E7]' : 'text-gray-800'
  const textSecondary = dark ? 'text-[#8E8E93]' : 'text-gray-400'
  const inputCls = dark
    ? 'bg-[#2C2C2E] border-[#3A3A3C] text-[#E5E5E7] placeholder-[#636366]'
    : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'

  useEffect(() => {
    if (!loading && userName) loadData()
  }, [loading, userName])

  async function loadData() {
    const { data: slots } = await supabase.from('schedule').select('group_name').eq('trainer_name', userName)
    let groups = [...new Set((slots || []).map(s => s.group_name).filter(Boolean))] as string[]

    if (groups.length === 0) {
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
    <div className="min-h-screen flex items-center justify-center text-gray-400" style={{ background: 'var(--bg)' }}>Загрузка...</div>
  )

  return (
    <main className="max-w-lg mx-auto p-4" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/trainer" className={`text-xl font-bold leading-none ${textSecondary} hover:opacity-70`}>←</Link>
        <h1 className={`text-xl font-bold ${textPrimary}`}>Мои ученики</h1>
        <span className={`ml-auto text-sm ${textSecondary}`}>{filtered.length} чел.</span>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по имени..."
        className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none mb-3 ${inputCls}`}
      />

      {myGroups.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button onClick={() => setSelectedGroup('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors
              ${selectedGroup === 'all' ? 'bg-black text-white' : dark ? 'bg-[#3A3A3C] text-[#8E8E93]' : 'bg-gray-100 text-gray-600'}`}>
            Все
          </button>
          {myGroups.map(g => (
            <button key={g} onClick={() => setSelectedGroup(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors
                ${selectedGroup === g ? 'bg-black text-white' : dark ? 'bg-[#3A3A3C] text-[#8E8E93]' : 'bg-gray-100 text-gray-600'}`}>
              {g}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={`text-center py-12 ${textSecondary}`}>Нет учеников</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const age = getAge(s.birth_date)
            return (
              <Link key={s.id} href={`/trainer/students/${s.id}`}
                className={`flex items-center rounded-2xl border px-4 py-3 transition-opacity hover:opacity-80 ${card}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold overflow-hidden shrink-0 mr-3 ${dark ? 'bg-[#3A3A3C] text-[#636366]' : 'bg-gray-100 text-gray-400'}`}>
                  {s.photo_url
                    ? <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" />
                    : s.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${textPrimary}`}>{s.name}</div>
                  <div className={`text-xs mt-0.5 ${textSecondary}`}>
                    {s.group_name || '—'}{age ? ` · ${age} лет` : ''}
                    {s.health_notes && <span className="ml-1 text-orange-500">⚠️</span>}
                  </div>
                </div>
                <span className={`text-sm ${textSecondary}`}>›</span>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
