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

  const [{ data: seminar }, { data: tariffs }, { data: regs }, { data: sessions }] = await Promise.all([
    supabase
      .from('seminar_events')
      .select('id, title, discipline, location, starts_at, ends_at, status')
      .eq('id', id)
      .single(),
    supabase
      .from('seminar_tariffs')
      .select('id, name, base_price')
      .eq('seminar_id', id)
      .order('sort_order'),
    supabase
      .from('seminar_registrations')
      .select('id, participant_name, tariff_id, school_status, locked_price, deposit_amount, total_paid, status, is_external, attended')
      .eq('seminar_id', id)
      .neq('status', 'cancelled')
      .order('participant_name'),
    supabase
      .from('seminar_sessions')
      .select('id, title, session_date, sort_order')
      .eq('seminar_id', id)
      .order('sort_order'),
  ])

  if (!seminar) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Посещаемость по тренировкам — второй запрос после получения session ids
  const sessionIds = (sessions || []).map(s => s.id)
  let attendance: { registration_id: string; session_id: string; attended: boolean }[] = []
  if (sessionIds.length > 0) {
    const { data } = await supabase
      .from('seminar_session_attendance')
      .select('registration_id, session_id, attended')
      .in('session_id', sessionIds)
    attendance = data || []
  }

  return NextResponse.json({
    seminar,
    tariffs: tariffs || [],
    registrations: regs || [],
    sessions: sessions || [],
    attendance,
  })
}
