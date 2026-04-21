// Возвращает карту user_id → список провайдеров из user_channels для заданных id.
// Использует service role (RLS на user_channels активен, клиенту читать нельзя).

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
