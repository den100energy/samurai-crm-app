import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendClientMessage } from '@/lib/clientBot'
import { sendToUser, UserType } from '@/lib/notifications'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Получатель = одна сущность БД (ученик или контакт), с её user_type, id и старым telegram_chat_id для fallback
type Recipient = {
  user_id: string
  user_type: UserType
  display_name: string
  fallback_chat_id: number | string | null
}

export async function POST(req: NextRequest) {
  const { audience, group, student_ids, text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'Нет текста' }, { status: 400 })

  const recipients: Recipient[] = []

  if (audience === 'parents') {
    let sq = admin.from('students').select('id').eq('status', 'active')
    if (group && group !== 'Все') sq = sq.eq('group_name', group)
    const { data: studs } = await sq

    const ids = (studs || []).map(s => s.id)
    if (ids.length > 0) {
      const { data: contacts } = await admin
        .from('student_contacts')
        .select('id, telegram_chat_id, name')
        .in('student_id', ids)

      for (const c of contacts || []) {
        recipients.push({
          user_id: c.id,
          user_type: 'contact',
          display_name: c.name || 'Родитель',
          fallback_chat_id: c.telegram_chat_id,
        })
      }
    }
  } else {
    let q = admin.from('students').select('id, name, telegram_chat_id, status')

    if (audience === 'active') {
      q = q.eq('status', 'active')
    } else if (audience === 'inactive') {
      q = q.in('status', ['inactive', 'archived'])
    } else if (audience === 'expiring') {
      const { data: subs } = await admin.from('subscriptions')
        .select('student_id').lte('sessions_left', 2).gt('sessions_left', 0)
      const eids = (subs || []).map(s => s.student_id)
      if (!eids.length) return NextResponse.json({ sent: 0, no_telegram: 0, no_telegram_names: [] })
      q = q.in('id', eids).eq('status', 'active')
    } else if (audience === 'manual') {
      if (!student_ids?.length) return NextResponse.json({ sent: 0, no_telegram: 0, no_telegram_names: [] })
      q = q.in('id', student_ids)
    }

    if (group && group !== 'Все' && !['expiring', 'manual'].includes(audience)) {
      q = q.eq('group_name', group)
    }

    const { data: studs } = await q.order('name')
    const studIds = (studs || []).map(s => s.id)

    // Сам ученик
    for (const s of studs || []) {
      recipients.push({
        user_id: s.id,
        user_type: 'student',
        display_name: s.name,
        fallback_chat_id: s.telegram_chat_id,
      })
    }

    // Контакты учеников (могут быть несколько контактов на ученика)
    if (studIds.length > 0) {
      const { data: contacts } = await admin
        .from('student_contacts')
        .select('id, student_id, telegram_chat_id, name')
        .in('student_id', studIds)
      for (const c of contacts || []) {
        recipients.push({
          user_id: c.id,
          user_type: 'contact',
          display_name: c.name || 'Родитель',
          fallback_chat_id: c.telegram_chat_id,
        })
      }
    }
  }

  // Отправка с персонализацией {имя}.
  // Дедупликация fallback chat_id (чтобы родитель с двумя детьми не получил дубли в Telegram).
  let sent = 0
  const no_telegram_names: string[] = []
  const fallbackSentChatIds = new Set<string | number>()

  for (const r of recipients) {
    const firstName = r.display_name.split(' ').slice(-1)[0]
    const personalText = text.replace(/\{имя\}/gi, firstName)

    const sentViaService = await sendToUser(r.user_id, r.user_type, personalText)
    if (sentViaService) {
      sent++
      continue
    }

    if (r.fallback_chat_id) {
      if (!fallbackSentChatIds.has(r.fallback_chat_id)) {
        fallbackSentChatIds.add(r.fallback_chat_id)
        await sendClientMessage(r.fallback_chat_id, personalText)
        sent++
      }
    } else {
      no_telegram_names.push(r.display_name)
    }
  }

  const no_telegram = no_telegram_names.length

  // Сохранить в историю (игнорируем ошибку если таблица не создана)
  try {
    await admin.from('broadcasts').insert({
      audience,
      group_name: group && group !== 'Все' ? group : null,
      text,
      sent_count: sent,
      no_telegram_count: no_telegram,
      no_telegram_names,
    })
  } catch { /* table may not exist yet */ }

  return NextResponse.json({ sent, no_telegram, no_telegram_names })
}

// Загрузить историю рассылок
export async function GET() {
  try {
    const { data } = await admin
      .from('broadcasts')
      .select('id, audience, group_name, text, sent_count, no_telegram_count, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json([])
  }
}
