// Адаптер для отправки сообщений через VK API
// messages.send требует access_token сообщества, user_id получателя, текст и random_id
//
// VK не поддерживает HTML — стриппим теги в plain text

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

export async function sendVkMessage(userId: string, text: string): Promise<boolean> {
  const token = process.env.VK_GROUP_TOKEN
  if (!token) return false

  try {
    const res = await fetch('https://api.vk.com/method/messages.send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        user_id: userId,
        message: stripHtml(text),
        random_id: String(Date.now()),
        access_token: token,
        v: '5.199',
      }),
    })
    const json = await res.json()
    return !json.error
  } catch {
    return false
  }
}
