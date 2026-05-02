-- Training Photos Migration
-- Run in Supabase SQL Editor

-- 1. Конфиг Telegram-тем для каждой группы
CREATE TABLE IF NOT EXISTS training_group_config (
  group_name TEXT PRIMARY KEY,
  telegram_thread_id BIGINT
);

INSERT INTO training_group_config (group_name, telegram_thread_id) VALUES
  ('Старт',              76),
  ('Основная (нач.)',    66),
  ('Основная (оп.)',     69),
  ('Цигун',             425)
ON CONFLICT (group_name) DO UPDATE SET telegram_thread_id = EXCLUDED.telegram_thread_id;

-- RLS
ALTER TABLE training_group_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON training_group_config FOR ALL USING (true) WITH CHECK (true);

-- 2. Таблица фотоотчётов тренировок
CREATE TABLE IF NOT EXISTS training_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name TEXT NOT NULL,
  session_date DATE NOT NULL,
  trainer_name TEXT,
  student_count INTEGER,
  photo_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  sort_order INTEGER DEFAULT 0,
  telegram_published_at TIMESTAMPTZ,
  telegram_message_ids BIGINT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Индекс для быстрого поиска по группе и дате
CREATE INDEX IF NOT EXISTS training_photos_group_date_idx
  ON training_photos(group_name, session_date);

-- RLS
ALTER TABLE training_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON training_photos FOR ALL USING (true) WITH CHECK (true);
