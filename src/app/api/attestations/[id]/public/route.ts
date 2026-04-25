import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getAdminClient()

  const [{ data: event }, { data: apps }] = await Promise.all([
    supabase
      .from('attestation_events')
      .select('id, title, discipline, event_date, preatt1_date, preatt2_date, status, preatt_groups')
      .eq('id', id)
      .single(),
    supabase
      .from('attestation_applications')
      .select('id, student_id, discipline, current_grade, target_grade, req_tenure_ok, req_visits_ok, req_age_ok, req_override_by, paid, preatt1_status, preatt2_status, result, result_grade, status, students(name)')
      .eq('event_id', id)
      .neq('status', 'cancelled')
      .order('submitted_at', { ascending: true }),
  ])

  if (!event) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  return NextResponse.json({ event, applications: apps || [] })
}
