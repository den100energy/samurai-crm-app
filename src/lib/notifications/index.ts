// NotificationService — единая точка отправки уведомлений через любой мессенджер.
// Находит все привязанные каналы пользователя в user_channels и отправляет через нужный адаптер.

import { createClient } from '@supabase/supabase-js'
import { sendTelegramMessage } from './adapters/telegram'
import { sendVkMessage } from './adapters/vk'
import { sendMaxMessage } from './adapters/max'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type Provider = 'telegram' | 'vk' | 'max'
export type UserType = 'student' | 'lead' | 'trainer' | 'contact'

const adapters: Record<Provider, (chatId: string, text: string) => Promise<boolean>> = {
  telegram: sendTelegramMessage,
  vk: sendVkMessage,
  max: sendMaxMessage,
}

// Отправить сообщение пользователю через все его привязанные каналы.
// Возвращает true если хотя бы один канал был найден и отправка выполнена.
export async function sendToUser(userId: string, userType: UserType, text: string): Promise<boolean> {
  const { data: channels, error } = await admin
    .from('user_channels')
    .select('provider, chat_id')
    .eq('user_id', userId)
    .eq('user_type', userType)

  if (error) {
    console.error('[sendToUser] query error:', error.message)
    return false
  }
  if (!channels?.length) {
    console.log('[sendToUser] no channels for', userType, userId)
    return false
  }

  console.log('[sendToUser] found', channels.length, 'channels for', userType, userId, ':',
    channels.map(c => `${c.provider}:${c.chat_id}`).join(','))

  let anySent = false
  for (const ch of channels) {
    const adapter = adapters[ch.provider as Provider]
    if (!adapter) continue
    const ok = await adapter(ch.chat_id, text)
    console.log('[sendToUser]', ch.provider, 'send →', ok ? 'OK' : 'FAIL')
    if (ok) anySent = true
  }
  return anySent
}

// Привязать чат к пользователю (вызывается из webhook-ов при /start TOKEN).
// Если канал уже есть — обновляет chat_id.
export async function linkUserChannel(
  userId: string,
  userType: UserType,
  provider: Provider,
  chatId: string | number,
): Promise<void> {
  const { error } = await admin.from('user_channels').upsert(
    {
      user_id: userId,
      user_type: userType,
      provider,
      chat_id: String(chatId),
    },
    { onConflict: 'user_id,user_type,provider' },
  )
  if (error) {
    console.error('[linkUserChannel] upsert failed:', error.message, error.details, error.hint)
  } else {
    console.log('[linkUserChannel] linked', userType, userId, '→', provider, chatId)
  }
}

// Получить уникальные chat_id всех указанных получателей для массовых рассылок.
// Возвращает Map<chat_id, provider> — чтобы избежать дублей и отправлять через правильный адаптер.
export async function getChannelsForUsers(
  users: { user_id: string; user_type: UserType }[],
): Promise<Array<{ provider: Provider; chat_id: string }>> {
  if (!users.length) return []
  const { data } = await admin
    .from('user_channels')
    .select('provider, chat_id')
    .in('user_id', users.map(u => u.user_id))

  return (data || []) as Array<{ provider: Provider; chat_id: string }>
}

// Отправить напрямую через конкретный провайдер (для broadcast, где chat_id уже известен).
export async function sendDirect(provider: Provider, chatId: string, text: string): Promise<boolean> {
  const adapter = adapters[provider]
  if (!adapter) return false
  return adapter(chatId, text)
}
