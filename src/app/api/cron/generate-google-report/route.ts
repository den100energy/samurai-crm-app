import { NextRequest, NextResponse } from 'next/server'
import { generateMonthlyReport } from '@/lib/monthlyReport'

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const now = new Date()
  const month: number = body.month || (now.getMonth() === 0 ? 12 : now.getMonth())
  const year: number = body.year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())
  try {
    const result = await generateMonthlyReport(month, year)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[generate-google-report]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
