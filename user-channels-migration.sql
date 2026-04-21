-- Миграция для омниканальных уведомлений
-- Запусти это в Supabase SQL Editor
--
-- Таблица user_channels хранит привязки пользователей (учеников/лидов/тренеров/контактов)
-- к чатам в разных мессенджерах (Telegram, VK, Макс).
-- Старые колонки telegram_chat_id в students/leads/trainers/student_contacts НЕ удаляются —
-- пока работают как fallback.

CREATE TABLE IF NOT EXISTS user_channels (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  user_type    text NOT NULL CHECK (user_type IN ('student', 'lead', 'trainer', 'contact')),
  provider     text NOT NULL CHECK (provider IN ('telegram', 'vk', 'max')),
  chat_id      text NOT NULL,
  is_preferred boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT uniq_provider_chat UNIQUE (provider, chat_id),
  CONSTRAINT uniq_user_provider UNIQUE (user_id, user_type, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_channels_user ON user_channels(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_user_channels_provider_chat ON user_channels(provider, chat_id);
