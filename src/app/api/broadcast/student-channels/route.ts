// Возвращает список id учеников, у которых есть хоть какой-то канал связи —
// сам telegram_chat_id, либо запись в user_channels, либо через контакт (родителя).
// Нужно UI рассылки, чтобы правильно показывать «с ботом / без бота» (учитывая VK/Макс).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const studentIds = new Set<string>()

  // 1. Ученики с прямым telegram_chat_id
  const { data: studsWithTG } = await admin
    .from('students').select('id').not('telegram_chat_id', 'is', null)
  for (const s of studsWithTG || []) studentIds.add(s.id)

  // 2. Ученики с user_channels (любой провайдер)
  const { data: studChannels } = await admin
    .from('user_channels').select('user_id').eq('user_type', 'student')
  for (const c of studChannels || []) studentIds.add(c.user_id)

  // 3. Контакты с прямым telegram_chat_id → добавляем их student_id
  const { data: contactsWithTG } = await admin
    .from('student_contacts').select('student_id').not('telegram_chat_id', 'is', null)
  for (const c of contactsWithTG || []) studentIds.add(c.student_id)

  // 4. Контакты с user_channels → получаем их student_id
  const { data: contactChannels } = await admin
    .from('user_channels').select('user_id').eq('user_type', 'contact')
  const contactIds = (contactChannels || []).map(c => c.user_id)
  if (contactIds.length > 0) {
    const { data: contactRows } = await admin
      .from('student_contacts').select('student_id').in('id', contactIds)
    for (const c of contactRows || []) studentIds.add(c.student_id)
  }

  return NextResponse.json(Array.from(studentIds))
}
