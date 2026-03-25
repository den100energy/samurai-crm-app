'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { OnboardingHint } from '@/components/OnboardingHint'

type Student = {
  id: string
  name: string
  phone: string | null
  group_name: string | null
  status: string
  photo_url: string | null
}

const GROUPS = ['Все', 'Дети 4-9', 'Подростки (нач)', 'Подростки (оп)', 'Цигун', 'Индивидуальные']

export default function StudentsPage() {
  const { role, permissions } = useAuth()
  const canAdd = role !== 'trainer' || permissions.includes('students.add')
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Все')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('students').select('*').eq('status', 'active').order('name')
      setStudents(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = students.filter(s => {
    const matchGroup = filter === 'Все' || s.group_name === filter
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    return matchGroup && matchSearch
  })

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">← </Link>
        <h1 className="text-xl font-bold text-gray-800">Ученики</h1>
        {canAdd && <>
          <Link href="/import"
            className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-xl">
            📂 Импорт
          </Link>
          <Link href="/students/new"
            className="bg-black text-white px-4 py-2 rounded-xl text-sm font-medium">
            + Добавить
          </Link>
        </>}
      </div>

      <OnboardingHint id="students_list" className="mb-4" />

      <input
        type="text"
        placeholder="Поиск по имени..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-3 text-sm outline-none focus:border-gray-400"
      />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {GROUPS.map(g => (
          <button key={g} onClick={() => setFilter(g)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filter === g ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {g}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Ученики не найдены</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Link key={s.id} href={`/students/${s.id}`}
              className="flex items-center bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600 mr-3 overflow-hidden shrink-0">
                {s.photo_url
                  ? <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" />
                  : s.name[0]}
              </div>
              <div>
                <div className="font-medium text-gray-800">{s.name}</div>
                <div className="text-sm text-gray-400">{s.group_name || '—'} {s.phone ? `· ${s.phone}` : ''}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
