'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type StudentRow = {
  id: string
  name: string
  group_name: string | null
  providers: string[]
}

type ContactRow = {
  id: string
  name: string
  role: string
  student_id: string
  studentName: string
  studentId: string
  groupName: string | null
  providers: string[]
}

const ROLE_LABELS: Record<string, string> = {
  mother: 'Мама',
  father: 'Папа',
  guardian: 'Опекун',
  other: 'Другое',
}

const PROVIDER_LABEL: Record<string, string> = {
  telegram: 'TG',
  vk: 'VK',
  max: 'Max',
}

function roleLabel(role: string) {
  return ROLE_LABELS[role] || role
}

function ProviderBadges({ providers }: { providers: string[] }) {
  return (
    <div className="flex gap-1 flex-wrap justify-end">
      {providers.map(p => (
        <span key={p} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
          ✓ {PROVIDER_LABEL[p] || p}
        </span>
      ))}
    </div>
  )
}

export default function CabinetsPage() {
  const [studentsLinked, setStudentsLinked] = useState<StudentRow[]>([])
  const [studentsUnlinked, setStudentsUnlinked] = useState<StudentRow[]>([])
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'students' | 'parents' | 'unlinked'>('students')

  useEffect(() => {
    async function load() {
      const [studentsRes, contactsRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, name, group_name, telegram_chat_id')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('student_contacts')
          .select('id, name, role, student_id, telegram_chat_id')
          .order('name'),
      ])

      const students = studentsRes.data || []
      const contactsRaw = contactsRes.data || []

      const allIds = [...students.map(s => s.id), ...contactsRaw.map(c => c.id)]
      let channelMap: Record<string, string[]> = {}
      if (allIds.length > 0) {
        const res = await fetch(`/api/user-channels?user_ids=${allIds.join(',')}`)
        if (res.ok) channelMap = await res.json()
      }

      const getStudentProviders = (s: { id: string; telegram_chat_id: string | null }) => {
        const ps = new Set<string>(channelMap[s.id] || [])
        if (s.telegram_chat_id) ps.add('telegram')
        return Array.from(ps)
      }
      const getContactProviders = (c: { id: string; telegram_chat_id: string | null }) => {
        const ps = new Set<string>(channelMap[c.id] || [])
        if (c.telegram_chat_id) ps.add('telegram')
        return Array.from(ps)
      }

      const studentMap = new Map(students.map(s => [s.id, s]))

      setStudentsLinked(
        students
          .filter(s => getStudentProviders(s).length > 0)
          .map(s => ({ id: s.id, name: s.name, group_name: s.group_name, providers: getStudentProviders(s) }))
      )
      setStudentsUnlinked(
        students
          .filter(s => getStudentProviders(s).length === 0)
          .map(s => ({ id: s.id, name: s.name, group_name: s.group_name, providers: [] }))
      )
      setContacts(
        contactsRaw
          .filter(c => getContactProviders(c).length > 0)
          .map(c => {
            const st = studentMap.get(c.student_id)
            return {
              id: c.id,
              name: c.name,
              role: c.role,
              student_id: c.student_id,
              studentName: st?.name || '—',
              studentId: st?.id || c.student_id,
              groupName: st?.group_name || null,
              providers: getContactProviders(c),
            }
          })
      )

      setLoading(false)
    }
    load()
  }, [])

  const tabs = [
    { key: 'students' as const, label: `✅ Ученики (${studentsLinked.length})` },
    { key: 'parents' as const, label: `✅ Родители (${contacts.length})` },
    { key: 'unlinked' as const, label: `⚠️ Нет (${studentsUnlinked.length})` },
  ]

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/analytics" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Кабинеты / Мессенджеры</h1>
      </div>

      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <div className="text-2xl font-bold text-green-600">{studentsLinked.length}</div>
            <div className="text-xs text-gray-400">учеников</div>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <div className="text-2xl font-bold text-blue-600">{contacts.length}</div>
            <div className="text-xs text-gray-400">родителей</div>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <div className={`text-2xl font-bold ${studentsUnlinked.length > 0 ? 'text-orange-500' : 'text-gray-800'}`}>
              {studentsUnlinked.length}
            </div>
            <div className="text-xs text-gray-400">без мессенджеров</div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`whitespace-nowrap flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-colors
              ${tab === t.key ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 bg-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : (
        <div className="space-y-2">
          {tab === 'students' && (
            studentsLinked.length === 0
              ? <div className="text-center text-gray-400 py-12">Нет подключённых учеников</div>
              : studentsLinked.map(s => (
                <Link key={s.id} href={`/students/${s.id}`}
                  className="flex items-center bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 mr-3 shrink-0">
                    {s.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.group_name || '—'}</div>
                  </div>
                  <ProviderBadges providers={s.providers} />
                </Link>
              ))
          )}

          {tab === 'parents' && (
            contacts.length === 0
              ? <div className="text-center text-gray-400 py-12">Нет подключённых родителей</div>
              : contacts.map(c => (
                <Link key={c.id} href={`/students/${c.studentId}`}
                  className="flex items-center bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 mr-3 shrink-0">
                    {c.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-400">
                      {roleLabel(c.role)} · {c.studentName}
                      {c.groupName ? ` · ${c.groupName}` : ''}
                    </div>
                  </div>
                  <ProviderBadges providers={c.providers} />
                </Link>
              ))
          )}

          {tab === 'unlinked' && (
            studentsUnlinked.length === 0
              ? <div className="text-center text-gray-400 py-12">✅ Все ученики подключены к мессенджерам!</div>
              : studentsUnlinked.map(s => (
                <Link key={s.id} href={`/students/${s.id}`}
                  className="flex items-center bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 mr-3 shrink-0">
                    {s.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.group_name || '—'}</div>
                  </div>
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full shrink-0">Нет</span>
                </Link>
              ))
          )}
        </div>
      )}
    </main>
  )
}
