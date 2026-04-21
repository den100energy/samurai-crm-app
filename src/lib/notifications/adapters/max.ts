// Адаптер для отправки сообщений через Макс Bot API
// Формат API уточнить по документации platform.max.ru

export async function sendMaxMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.MAX_BOT_TOKEN
  if (!token) return false

  try {
    const res = await fetch('https://platform-api.max.ru/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    return res.ok
  } catch {
    return false
  }
}
