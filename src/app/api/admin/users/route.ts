import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Клиент с правами администратора (только серверная сторона)
function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY не задан')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// Проверяем что вызывает основатель
async function checkFounder() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single()
  return data?.role === 'founder'
}

// GET — список пользователей
export async function GET() {
  if (!(await checkFounder())) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }
  const admin = getAdminClient()
  const supabase = await createSupabaseServerClient()

  const { data: { users } } = await admin.auth.admin.listUsers()
  const { data: profiles } = await supabase.from('user_profiles').select('id, role, name, trainer_id, permissions')

  const profileMap = new Map((profiles || []).map(p => [p.id, p]))
  const result = (users || []).map(u => ({
    id: u.id,
    email: u.email,
    ...profileMap.get(u.id),
    created_at: u.created_at,
  }))

  return NextResponse.json(result)
}

// POST — создать пользователя
export async function POST(req: NextRequest) {
  if (!(await checkFounder())) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }
  const { email, password, role, name, trainer_id } = await req.json()
  if (!email || !password || !role || !name) {
    return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || 'Ошибка создания' }, { status: 500 })
  }

  const supabase = await createSupabaseServerClient()
  await supabase.from('user_profiles').insert({
    id: data.user.id,
    role,
    name,
    trainer_id: trainer_id || null,
  })

  return NextResponse.json({ ok: true, id: data.user.id })
}

// PATCH — обновить права доступа
export async function PATCH(req: NextRequest) {
  if (!(await checkFounder())) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }
  const { id, permissions } = await req.json()
  const supabase = await createSupabaseServerClient()
  await supabase.from('user_profiles').update({ permissions }).eq('id', id)
  return NextResponse.json({ ok: true })
}

// DELETE — удалить пользователя
export async function DELETE(req: NextRequest) {
  if (!(await checkFounder())) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }
  const { id } = await req.json()
  const admin = getAdminClient()
  await admin.auth.admin.deleteUser(id)
  return NextResponse.json({ ok: true })
}
