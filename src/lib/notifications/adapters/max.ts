// Адаптер для отправки сообщений через Макс Bot API.
// Документация: https://dev.max.ru — POST /messages?user_id={ID}
//
// Особенности API:
//   - Заголовок Authorization: <token> (БЕЗ слова Bearer!)
//   - Получатель указывается как query-параметр user_id
//   - Текст до 4000 символов, поддерживается format: "html" | "markdown"
//   - Лимит 30 rps (нам с запасом хватает)

const API_BASE = 'https://platform-api.max.ru'

export async function sendMaxMessage(userId: string, text: string): Promise<boolean> {
  const token = process.env.MAX_BOT_TOKEN
  if (!token) {
    console.error('[max] MAX_BOT_TOKEN не задан')
    return false
  }

  try {
    const url = `${API_BASE}/messages?user_id=${encodeURIComponent(userId)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        format: 'html',
        notify: true,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[max] API error ${res.status} for user_id=${userId}:`, body.slice(0, 200))
      return false
    }
    return true
  } catch (e: any) {
    console.error('[max] fetch failed:', e?.message || e)
    return false
  }
}
