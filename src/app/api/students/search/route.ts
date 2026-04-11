import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  if (q.length < 2) return NextResponse.json([])

  const { data } = await admin
    .from('students')
    .select('id, name, phone')
    .eq('status', 'active')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(6)

  return NextResponse.json(data || [])
}
