-- Training Logs Migration
-- Добавляет таблицу для быстрых заметок тренеров после тренировки

CREATE TABLE IF NOT EXISTS training_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name TEXT NOT NULL,
  trainer_name TEXT NOT NULL,
  date DATE NOT NULL,
  
  -- Разминка и растяжка
  warmup_items TEXT[] DEFAULT '{}',         -- ['бег', 'растяжка', 'махи_ногами', 'дыхательная_настройка']
  
  -- ОФП (физическая подготовка)
  fitness_items TEXT[] DEFAULT '{}',        -- ['отжимания_кулаки', 'пресс', 'мабу_статика']
  
  -- Базовая техника (стойки, удары, передвижения)
  basic_techniques TEXT[] DEFAULT '{}',     -- ['стойки:мабу', 'удары_руками:чунцюань', 'удары_ногами:чжэнтитуй']
  
  -- Прикладная техника (защита, броски, циньна, саньда)
  applied_techniques TEXT[] DEFAULT '{}',   -- ['защита_от_ударов', 'броски', 'саньда']
  
  -- Таолу (комплексы) и Цигун
  taolu_items TEXT[] DEFAULT '{}',          -- ['шаолинь_дахунцюань', 'игцзиньцзин']
  qigong_items TEXT[] DEFAULT '{}',         -- ['игцзиньцзин', 'медитация']
  
  -- Айкидо: Укэми (страховки)
  aikido_ukemi TEXT[] DEFAULT '{}',         -- ['вперёд', 'назад', 'вбок']
  
  -- Айкидо: Техники
  aikido_techniques TEXT[] DEFAULT '{}',    -- ['иккё', 'никкё', 'ирими_нагэ']
  
  -- Айкидо: Работа с оружием
  aikido_weapons TEXT[] DEFAULT '{}',       -- ['боккен', 'дзё', 'танто_дори']
  
  -- Айкидо: Рэйги (этикет) и перемещения
  aikido_etiquette BOOLEAN DEFAULT FALSE,   -- Отмечен ли этикет
  aikido_movement TEXT[] DEFAULT '{}',      -- ['сикко', 'танкен', 'хэнко']
  
  -- Заметка тренера (свободный текст)
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Индекс для быстрого поиска по дате и группе
CREATE INDEX IF NOT EXISTS idx_training_logs_date_group ON training_logs(date, group_name);
CREATE INDEX IF NOT EXISTS idx_training_logs_trainer ON training_logs(trainer_name, date);

-- Уникальное ограничение: один журнал на тренера/группу/дату (но можно обновлять)
-- Убираем UNIQUE — тренер может оставить несколько записей за день (утро/вечер)

-- Row Level Security
ALTER TABLE training_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_training_logs" ON training_logs FOR ALL USING (true) WITH CHECK (true);
