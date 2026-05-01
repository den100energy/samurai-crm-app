import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const [studentsRes, contactsRes, channelsRes] = await Promise.all([
    admin.from('students').select('id, name, group_name, telegram_chat_id').eq('status', 'active').order('name'),
    admin.from('student_contacts').select('id, name, role, student_id, telegram_chat_id').order('name'),
    admin.from('user_channels').select('user_id, provider'),
  ])

  const students = studentsRes.data || []
  const contacts = contactsRes.data || []
  const channels = channelsRes.data || []

  const channelMap: Record<string, string[]> = {}
  for (const ch of channels) {
    if (!channelMap[ch.user_id]) channelMap[ch.user_id] = []
    channelMap[ch.user_id].push(ch.provider)
  }

  const getProviders = (id: string, telegram_chat_id: string | null) => {
    const ps = new Set<string>(channelMap[id] || [])
    if (telegram_chat_id) ps.add('telegram')
    return Array.from(ps)
  }

  const studentMap = new Map(students.map(s => [s.id, s]))

  return NextResponse.json({
    studentsLinked: students
      .filter(s => getProviders(s.id, s.telegram_chat_id).length > 0)
      .map(s => ({ id: s.id, name: s.name, group_name: s.group_name, providers: getProviders(s.id, s.telegram_chat_id) })),
    studentsUnlinked: students
      .filter(s => getProviders(s.id, s.telegram_chat_id).length === 0)
      .map(s => ({ id: s.id, name: s.name, group_name: s.group_name })),
    contacts: contacts
      .filter(c => getProviders(c.id, c.telegram_chat_id).length > 0)
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
          providers: getProviders(c.id, c.telegram_chat_id),
        }
      }),
  })
}
