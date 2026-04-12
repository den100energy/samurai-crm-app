import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { randomUUID } from 'crypto'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await admin
    .from('user_profiles').select('role, name, trainer_id').eq('id', user.id).single()

  if (!profile || (profile.role !== 'trainer' && profile.role !== 'founder')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Находим запись тренера по имени
  const { data: trainer } = await admin
    .from('trainers').select('id, name, telegram_chat_id').eq('name', profile.name).maybeSingle()

  if (!trainer) return NextResponse.json({ error: 'trainer_not_found' }, { status: 404 })

  // Генерируем токен с префиксом tr_
  const token = 'tr_' + randomUUID().replace(/-/g, '')

  await admin.from('trainers').update({ telegram_invite_token: token }).eq('id', trainer.id)

  const botUsername = process.env.TELEGRAM_CLIENT_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_BOT_USERNAME || ''
  const link = `https://t.me/${botUsername}?start=${token}`

  return NextResponse.json({ link, already_linked: !!trainer.telegram_chat_id })
}
