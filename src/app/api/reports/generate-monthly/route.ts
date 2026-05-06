import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateMonthlyReport } from '@/lib/monthlyReport'

export async function POST(req: NextRequest) {
  // Проверяем Supabase-сессию
  const token = req.headers.get('x-supabase-auth')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error } = await supabaseUser.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: profile } = await supabaseAdmin
    .from('user_profiles').select('role').eq('id', user.id).maybeSingle()

  if (!profile || !['founder', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const now = new Date()
  const month: number = body.month || (now.getMonth() === 0 ? 12 : now.getMonth())
  const year: number = body.year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())

  try {
    const result = await generateMonthlyReport(month, year)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[generate-monthly]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
