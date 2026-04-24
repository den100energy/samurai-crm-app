-- Добавляем поля времени в тренировки семинара
ALTER TABLE seminar_sessions
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME;
