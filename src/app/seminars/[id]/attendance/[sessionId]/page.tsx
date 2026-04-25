'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Session = {
  id: string
  title: string
  session_date: string | null
  start_time: string | null
}

type Participant = {
  id: string
  participant_name: string
  is_external: boolean
  status: string
}

export default function SeminarAttendancePage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>()
  const router = useRouter()
  const { role } = useAuth()
  const canEdit = role === 'founder' || role === 'admin'

  const [session, setSession] = useState<Session | null>(null)
  const [seminarTitle, setSeminarTitle] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [attended, setAttended] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: sess }, { data: sem }, { data: regs }, { data: att }] = await Promise.all([
      supabase.from('seminar_sessions').select('id, title, session_date, start_time').eq('id', sessionId).single(),
      supabase.from('seminar_events').select('title').eq('id', id).single(),
      supabase.from('seminar_registrations')
        .select('id, participant_name, is_external, status')
        .eq('seminar_id', id)
        .neq('status', 'cancelled')
        .order('participant_name'),
      supabase.from('seminar_session_attendance')
        .select('registration_id')
        .eq('session_id', sessionId)
        .eq('attended', true),
    ])

    setSession(sess)
    setSeminarTitle(sem?.title || '')
    setParticipants(regs || [])
    setAttended(new Set((att || []).map(a => a.registration_id)))
    setLoading(false)
  }, [id, sessionId])

  useEffect(() => { load() }, [load])

  async function toggle(regId: string) {
    if (!canEdit) return
    const isNowAttended = !attended.has(regId)
    setAttended(prev => {
      const next = new Set(prev)
      isNowAttended ? next.add(regId) : next.delete(regId)
      return next
    })
    setSaving(regId)
    await supabase.from('seminar_session_attendance').upsert(
      { session_id: sessionId, registration_id: regId, attended: isNowAttended },
      { onConflict: 'session_id,registration_id' }
    )
    setSaving(null)
  }

  const countAttended = attended.size
  const total = participants.length

  if (loading) return <div className="text-center py-12 text-gray-400">Загрузка...</div>
  if (!session) return <div className="text-center py-12 text-gray-400">Тренировка не найдена</div>

  return (
    <main className="max-w-lg mx-auto p-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</button>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 truncate">{seminarTitle}</div>
          <h1 className="text-base font-bold text-gray-800 truncate">{session.title}</h1>
          {(session.session_date || session.start_time) && (
            <div className="text-xs text-gray-400">
              {session.session_date && <span>{session.session_date}</span>}
              {session.start_time && <span className="ml-1">{session.start_time.slice(0, 5)}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Counter */}
      <div className="flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3 mb-4 mt-3">
        <div className="text-sm text-indigo-700 font-medium">Присутствует</div>
        <div className="text-xl font-bold text-indigo-800">{countAttended} / {total}</div>
      </div>

      {/* List */}
      {participants.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8 bg-gray-50 rounded-xl">Участников нет</div>
      ) : (
        <div className="space-y-2">
          {participants.map(p => {
            const isPresent = attended.has(p.id)
            const isSaving = saving === p.id
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                disabled={!canEdit || isSaving}
                className={`w-full flex items-center px-4 py-3 rounded-xl border transition-colors text-left
                  ${isPresent
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  } ${!canEdit ? 'cursor-default' : ''}`}
              >
                <span className="text-xl mr-3 shrink-0">
                  {isSaving ? '⏳' : isPresent ? '✅' : '⬜'}
                </span>
                <span className={`font-medium flex-1 truncate ${isPresent ? 'text-gray-800' : 'text-gray-600'}`}>
                  {p.participant_name}
                </span>
                {p.is_external && (
                  <span className="text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full ml-2 shrink-0">
                    внешний
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {!canEdit && (
        <div className="text-center text-xs text-gray-400 mt-6">Только просмотр</div>
      )}
    </main>
  )
}
