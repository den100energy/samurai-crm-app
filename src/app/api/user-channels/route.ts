// GET: возвращает карту user_id → список провайдеров из user_channels для заданных id.
// DELETE: отключает канал для пользователя, подтверждённого invite-токеном.
// Использует service role (RLS на user_channels активен, клиенту читать/писать нельзя).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('user_ids') || ''
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
  if (ids.length === 0) return NextResponse.json({})

  const { data } = await admin
    .from('user_channels')
    .select('user_id, provider')
    .in('user_id', ids)

  const result: Record<string, string[]> = {}
  for (const row of data || []) {
    if (!result[row.user_id]) result[row.user_id] = []
    result[row.user_id].push(row.provider)
  }
  return NextResponse.json(result)
}

// Резолвит invite-токен в пару (user_id, user_type). Пока поддерживаем только контакты родителей,
// но логика расширяемая — по мере необходимости добавим student/lead/trainer.
async function resolveOwner(token: string): Promise<{ user_id: string; user_type: string } | null> {
  const { data: contact } = await admin
    .from('student_contacts')
    .select('id')
    .eq('invite_token', token)
    .maybeSingle()
  if (contact) return { user_id: contact.id, user_type: 'contact' }

  return null
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null) as { token?: string; provider?: string } | null
  const token = body?.token?.trim()
  const provider = body?.provider?.trim()
  if (!token || !provider) {
    return NextResponse.json({ error: 'token and provider required' }, { status: 400 })
  }

  const owner = await resolveOwner(token)
  if (!owner) {
    return NextResponse.json({ error: 'invalid token' }, { status: 404 })
  }

  const { data: before } = await admin
    .from('user_channels')
    .select('provider')
    .eq('user_id', owner.user_id)
    .eq('user_type', owner.user_type)

  const hadProvider = (before || []).some(r => r.provider === provider)
  const wasLast = hadProvider && (before?.length ?? 0) === 1

  if (hadProvider) {
    const { error } = await admin
      .from('user_channels')
      .delete()
      .eq('user_id', owner.user_id)
      .eq('user_type', owner.user_type)
      .eq('provider', provider)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, wasLast })
}
