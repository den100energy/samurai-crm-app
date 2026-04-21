// Защищённый разовый роут для регистрации webhook в Макс.
// Вызывать после деплоя:
//   curl -X POST https://crm.samu-rai.ru/api/max/register \
//        -H "Authorization: Bearer $CRON_SECRET"
//
// Также поддерживает:
//   GET  /api/max/register  → показать текущие подписки
//   DELETE /api/max/register → отписаться от webhook

import { NextRequest, NextResponse } from 'next/server'

const API_BASE = 'https://platform-api.max.ru'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.samu-rai.ru'
const WEBHOOK_URL = `${APP_URL}/api/max`

function checkAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

function checkEnv(): { ok: true; token: string; secret: string } | { ok: false; error: string } {
  const token = process.env.MAX_BOT_TOKEN
  const secret = process.env.MAX_WEBHOOK_SECRET
  if (!token) return { ok: false, error: 'MAX_BOT_TOKEN не задан' }
  if (!secret) return { ok: false, error: 'MAX_WEBHOOK_SECRET не задан' }
  return { ok: true, token, secret }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const env = checkEnv()
  if (!env.ok) {
    return NextResponse.json({ error: env.error }, { status: 500 })
  }

  const res = await fetch(`${API_BASE}/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': env.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      update_types: ['message_created', 'bot_started'],
      secret: env.secret,
    }),
  })

  const json = await res.json().catch(() => ({}))
  return NextResponse.json({ status: res.status, webhook_url: WEBHOOK_URL, response: json })
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const env = checkEnv()
  if (!env.ok) {
    return NextResponse.json({ error: env.error }, { status: 500 })
  }

  const res = await fetch(`${API_BASE}/subscriptions`, {
    headers: { 'Authorization': env.token },
  })
  const json = await res.json().catch(() => ({}))
  return NextResponse.json({ status: res.status, response: json })
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const env = checkEnv()
  if (!env.ok) {
    return NextResponse.json({ error: env.error }, { status: 500 })
  }

  const url = `${API_BASE}/subscriptions?url=${encodeURIComponent(WEBHOOK_URL)}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': env.token },
  })
  const json = await res.json().catch(() => ({}))
  return NextResponse.json({ status: res.status, response: json })
}
