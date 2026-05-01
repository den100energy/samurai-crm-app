import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { student_id, url } = await req.json()

  if (!student_id || !url) {
    return NextResponse.json({ error: 'student_id and url required' }, { status: 400 })
  }

  await supabase
    .from('students')
    .update({ photo_url: url })
    .eq('id', student_id)

  return NextResponse.json({ success: true })
}
