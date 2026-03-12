import { NextRequest, NextResponse } from 'next/server'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID!

export async function POST(req: NextRequest) {
  const { chat_id, message } = await req.json()

  const targetChatId = chat_id || OWNER_CHAT_ID

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: targetChatId,
      text: message,
      parse_mode: 'HTML',
    }),
  })

  const data = await res.json()
  if (!data.ok) {
    return NextResponse.json({ error: data.description }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
