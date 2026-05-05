import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TRAINING_CHAT_ID = process.env.TELEGRAM_TRAINING_CHAT_ID!

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

async function sendPhoto(chatId: string, threadId: number | null, photoUrl: string, caption?: string): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    parse_mode: 'HTML',
  }
  if (caption) body.caption = caption
  if (threadId) body.message_thread_id = threadId

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) {
    console.error('[publish-training-photo] sendPhoto error:', JSON.stringify(json))
    return null
  }
  return json.result?.message_id ?? null
}

async function sendMediaGroup(chatId: string, threadId: number | null, photos: { url: string; caption?: string }[]): Promise<number[]> {
  const media = photos.map((p, i) => ({
    type: 'photo',
    media: p.url,
    ...(i === 0 && p.caption ? { caption: p.caption, parse_mode: 'HTML' } : {}),
  }))

  const body: Record<string, unknown> = {
    chat_id: chatId,
    media,
  }
  if (threadId) body.message_thread_id = threadId

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) {
    console.error('[publish-training-photo] sendMediaGroup error:', JSON.stringify(json))
    return []
  }
  return (json.result || []).map((m: { message_id: number }) => m.message_id)
}

export async function POST(req: NextRequest) {
  if (!BOT_TOKEN) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 })
  if (!TRAINING_CHAT_ID) return NextResponse.json({ error: 'TELEGRAM_TRAINING_CHAT_ID not set' }, { status: 500 })

  const { group_name, session_date } = await req.json()
  if (!group_name || !session_date) {
    return NextResponse.json({ error: 'group_name and session_date required' }, { status: 400 })
  }

  // Загружаем фото сессии по порядку
  const { data: photos, error: photosErr } = await supabase
    .from('training_photos')
    .select('id, photo_url, trainer_name, student_count')
    .eq('group_name', group_name)
    .eq('session_date', session_date)
    .order('sort_order')

  if (photosErr || !photos || photos.length === 0) {
    return NextResponse.json({ error: 'No photos found for this session' }, { status: 404 })
  }

  // Получаем telegram_thread_id из конфига
  const { data: groupRow } = await supabase
    .from('training_group_config')
    .select('telegram_thread_id')
    .eq('group_name', group_name)
    .maybeSingle()

  const threadId: number | null = groupRow?.telegram_thread_id ?? null

  // Считаем присутствующих напрямую из attendance (точнее, чем кэшированное поле)
  const { data: attRows } = await supabase
    .from('attendance')
    .select('student_id')
    .eq('group_name', group_name)
    .eq('present', true)
    .eq('date', session_date)

  const first = photos[0]
  const trainerName = first.trainer_name || ''
  const studentCount = attRows?.length ?? first.student_count ?? 0
  const caption =
    `📸 <b>${formatDate(session_date)}</b>\n` +
    `${group_name} · ${studentCount} чел.\n` +
    (trainerName ? `Тренер: ${trainerName}` : '')

  let messageIds: number[] = []

  if (photos.length === 1) {
    const msgId = await sendPhoto(TRAINING_CHAT_ID, threadId, photos[0].photo_url, caption)
    if (msgId) messageIds = [msgId]
  } else {
    messageIds = await sendMediaGroup(
      TRAINING_CHAT_ID,
      threadId,
      photos.map((p, i) => ({ url: p.photo_url, caption: i === 0 ? caption : undefined }))
    )
  }

  if (messageIds.length === 0) {
    return NextResponse.json({ error: 'Telegram send failed' }, { status: 500 })
  }

  // Обновляем все фото сессии как опубликованные
  const now = new Date().toISOString()
  await supabase
    .from('training_photos')
    .update({ telegram_published_at: now, telegram_message_ids: messageIds })
    .eq('group_name', group_name)
    .eq('session_date', session_date)

  return NextResponse.json({ ok: true, message_ids: messageIds })
}
