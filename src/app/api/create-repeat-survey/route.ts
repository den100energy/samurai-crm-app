import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function surveyTitle() {
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const now = new Date()
  return `Рост — ${months[now.getMonth()]} ${now.getFullYear()}`
}

export async function POST(req: NextRequest) {
  const { student_id, initiated_by = 'trainer' } = await req.json()
  if (!student_id) return NextResponse.json({ error: 'student_id required' }, { status: 400 })

  // Проверяем нет ли уже незаполненного среза
  const { data: pending } = await admin
    .from('progress_surveys')
    .select('id')
    .eq('student_id', student_id)
    .is('filled_at', null)
    .limit(1)
    .maybeSingle()

  if (pending) {
    return NextResponse.json({ error: 'already_pending', message: 'Уже есть незаполненный срез' }, { status: 409 })
  }

  // Считаем сколько срезов уже есть
  const { count } = await admin
    .from('progress_surveys')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', student_id)

  const survey_number = (count ?? 0) + 1
  const title = surveyTitle()

  const { data, error } = await admin
    .from('progress_surveys')
    .insert({ student_id, survey_number, title, initiated_by })
    .select('id, survey_token, survey_number, title')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, ...data })
}
