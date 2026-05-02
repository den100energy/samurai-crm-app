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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  return data?.role === 'founder'
}

// GET — список пользователей
export async function GET() {
  if (!(await checkFounder())) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }
  const admin = getAdminClient()

  const { data: { users } } = await admin.auth.admin.listUsers()
  const { data: profiles } = await admin.from('user_profiles').select('id, role, name, trainer_id, permissions, assigned_groups')

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
  const { email, password, role, name, trainer_id, assigned_groups } = await req.json()
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

  const { error: profileError } = await admin.from('user_profiles').insert({
    id: data.user.id,
    role,
    name,
    trainer_id: trainer_id || null,
    permissions: [],
    assigned_groups: assigned_groups || [],
  })

  if (profileError) {
    // Удаляем созданного auth-пользователя чтобы не было мусора
    await admin.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.user.id })
}

// PATCH — обновить права, имя, email, пароль
export async function PATCH(req: NextRequest) {
  if (!(await checkFounder())) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }
  const { id, permissions, name, email, password, role, trainer_id, assigned_groups } = await req.json()
  const admin = getAdminClient()

  // Обновляем профиль через admin-клиент (обходит RLS)
  if (permissions !== undefined || name !== undefined || trainer_id !== undefined || role !== undefined || assigned_groups !== undefined) {
    const update: Record<string, unknown> = {}
    if (permissions !== undefined) update.permissions = permissions
    if (name !== undefined) update.name = name
    if (role !== undefined) update.role = role
    if (trainer_id !== undefined) update.trainer_id = trainer_id || null
    if (assigned_groups !== undefined) update.assigned_groups = assigned_groups
    const { error: updateError } = await admin
      .from('user_profiles')
      .update(update)
      .eq('id', id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Обновляем email и/или пароль через admin API
  if (email || password) {
    const authUpdate: Record<string, string> = {}
    if (email) authUpdate.email = email
    if (password) authUpdate.password = password
    const { error } = await admin.auth.admin.updateUserById(id, authUpdate)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

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
