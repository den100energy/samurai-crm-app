-- Миграция для клиентского бота
-- Запусти это в Supabase SQL Editor

-- Добавляем поля в таблицу учеников
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT;

-- Добавляем поля в таблицу лидов
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT;

-- Индексы для быстрого поиска по токену
CREATE INDEX IF NOT EXISTS idx_students_invite_token ON students(invite_token);
CREATE INDEX IF NOT EXISTS idx_leads_invite_token ON leads(invite_token);
