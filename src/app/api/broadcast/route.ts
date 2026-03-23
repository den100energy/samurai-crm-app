import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendClientMessage } from '@/lib/clientBot'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Recipient = { name: string; chat_ids: (number | string)[] }

export async function POST(req: NextRequest) {
  const { audience, group, student_ids, text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'Нет текста' }, { status: 400 })

  const recipients: Recipient[] = []

  if (audience === 'parents') {
    // Только родительские контакты активных учеников
    let sq = admin.from('students').select('id, name').eq('status', 'active')
    if (group && group !== 'Все') sq = sq.eq('group_name', group)
    const { data: studs } = await sq

    const ids = (studs || []).map(s => s.id)
    if (ids.length > 0) {
      const { data: contacts } = await admin
        .from('student_contacts')
        .select('telegram_chat_id, student_id')
        .in('student_id', ids)

      const nameMap = new Map((studs || []).map(s => [s.id, s.name]))
      for (const c of contacts || []) {
        recipients.push({
          name: nameMap.get(c.student_id) || 'Родитель',
          chat_ids: c.telegram_chat_id ? [c.telegram_chat_id] : [],
        })
      }
    }
  } else {
    // Ученики: active / inactive / expiring / manual
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

    // Родительские контакты (дополнительные получатели)
    const studIds = (studs || []).map(s => s.id)
    let contactMap = new Map<string, (number | string)[]>()
    if (studIds.length > 0) {
      const { data: contacts } = await admin
        .from('student_contacts')
        .select('student_id, telegram_chat_id')
        .in('student_id', studIds)
        .not('telegram_chat_id', 'is', null)
      for (const c of contacts || []) {
        if (!c.telegram_chat_id) continue
        const arr = contactMap.get(c.student_id) || []
        arr.push(c.telegram_chat_id)
        contactMap.set(c.student_id, arr)
      }
    }

    for (const s of studs || []) {
      const chatIds = new Set<number | string>()
      if (s.telegram_chat_id) chatIds.add(s.telegram_chat_id)
      for (const cid of contactMap.get(s.id) || []) chatIds.add(cid)
      recipients.push({ name: s.name, chat_ids: [...chatIds] })
    }
  }

  // Отправка сообщений с персонализацией {имя}
  let sent = 0
  const no_telegram_names: string[] = []

  for (const r of recipients) {
    if (r.chat_ids.length === 0) {
      no_telegram_names.push(r.name)
      continue
    }
    const firstName = r.name.split(' ').slice(-1)[0] // последнее слово = имя (Иванов Иван → Иван)
    const personalText = text.replace(/\{имя\}/gi, firstName)
    for (const chat_id of r.chat_ids) {
      await sendClientMessage(chat_id, personalText)
    }
    sent++
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
