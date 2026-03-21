'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Student = { id: string; name: string; group_name: string | null }
type AttendanceRecord = { student_id: string; present: boolean }

function AttendanceContent() {
  const { userName, loading } = useAuth()
  const searchParams = useSearchParams()
  const [myGroups, setMyGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Pre-fill from URL params (?date=&group=)
  useEffect(() => {
    const urlDate = searchParams.get('date')
    const urlGroup = searchParams.get('group')
    if (urlDate) setDate(urlDate)
    if (urlGroup) setSelectedGroup(urlGroup)
  }, [searchParams])

  useEffect(() => {
    if (!loading && userName) {
      supabase.from('schedule').select('group_name').eq('trainer_name', userName)
        .then(async ({ data }) => {
          const groups = [...new Set((data || []).map(s => s.group_name).filter(Boolean))] as string[]
          if (groups.length > 0) {
            setMyGroups(groups)
            // Only auto-set group if no URL param was given
            if (!searchParams.get('group') && groups.length === 1) setSelectedGroup(groups[0])
          } else {
            // Расписание не настроено — показываем все группы
            const { data: studs } = await supabase
              .from('students').select('group_name').eq('status', 'active')
            const allGroups = [...new Set((studs || []).map(s => s.group_name).filter(Boolean))] as string[]
            setMyGroups(allGroups)
            if (!searchParams.get('group') && allGroups.length === 1) setSelectedGroup(allGroups[0])
          }
        })
    }
  }, [loading, userName])

  useEffect(() => {
    if (!selectedGroup) return
    loadStudentsAndAttendance()
  }, [selectedGroup, date])

  async function loadStudentsAndAttendance() {
    const { data: studs } = await supabase
      .from('students')
      .select('id, name, group_name')
      .eq('group_name', selectedGroup)
      .eq('status', 'active')
      .order('name')

    const studList = studs || []
    setStudents(studList)

    if (studList.length > 0) {
      const { data: attData } = await supabase
        .from('attendance')
        .select('student_id, present')
        .eq('date', date)
        .in('student_id', studList.map(s => s.id))

      const attMap: Record<string, boolean> = {}
      studList.forEach(s => { attMap[s.id] = false })
      ;(attData || []).forEach(a => { attMap[a.student_id] = a.present })
      setAttendance(attMap)
    }
  }

  function toggle(studentId: string) {
    setAttendance(prev => ({ ...prev, [studentId]: !prev[studentId] }))
  }

  async function save() {
    setSaving(true)
    for (const student of students) {
      const present = attendance[student.id] ?? false
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', student.id)
        .eq('date', date)
        .maybeSingle()

      if (existing) {
        await supabase.from('attendance').update({ present }).eq('id', existing.id)
      } else {
        await supabase.from('attendance').insert({ student_id: student.id, date, present })
      }
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const presentCount = Object.values(attendance).filter(Boolean).length

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/trainer" className="text-gray-500 hover:text-black text-xl font-bold">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Посещаемость</h1>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none flex-1"
        />
        {myGroups.length > 1 && (
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none flex-1"
          >
            <option value="">Выберите группу</option>
            {myGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        {myGroups.length === 1 && !selectedGroup && (
          <div className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600">
            {myGroups[0]}
          </div>
        )}
      </div>

      {!selectedGroup ? (
        <div className="text-center text-gray-400 py-12">Выберите группу</div>
      ) : students.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Нет учеников в группе</div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">{selectedGroup}</span>
              <span className="text-sm text-gray-500">{presentCount} / {students.length}</span>
            </div>
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`w-full flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 transition-colors
                  ${attendance[s.id] ? 'bg-green-50' : 'bg-white'}`}
              >
                <span className={`text-sm font-medium ${attendance[s.id] ? 'text-green-700' : 'text-gray-600'}`}>
                  {s.name}
                </span>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm
                  ${attendance[s.id] ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-300'}`}>
                  {attendance[s.id] ? '✓' : ''}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-black text-white py-3.5 rounded-2xl font-medium text-sm disabled:opacity-50"
          >
            {saving ? 'Сохраняю...' : saved ? '✓ Сохранено' : 'Сохранить посещаемость'}
          </button>
        </>
      )}
    </main>
  )
}

export default function TrainerAttendancePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>}>
      <AttendanceContent />
    </Suspense>
  )
}
