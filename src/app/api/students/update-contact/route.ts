import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { student_id, phone } = await req.json()
  if (!student_id) return NextResponse.json({ error: 'no id' }, { status: 400 })

  const { data: student } = await admin
    .from('students')
    .select('phone')
    .eq('id', student_id)
    .single()

  if (!student) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const update: Record<string, string> = {}
  const updated: string[] = []

  if (phone && !student.phone) {
    update.phone = phone
    updated.push('телефон')
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ updated: [] })
  }

  await admin.from('students').update(update).eq('id', student_id)
  return NextResponse.json({ updated })
}
