-- Миграция: редактирование оплаты аттестации + рассрочка
-- Дата: 2026-04-22
--
-- Запустить на Beget через:
--   docker exec -t supabase-db psql -U postgres -d postgres < /tmp/attestation-payment-migration.sql
--
-- Или скопировать вручную в Supabase Studio → SQL Editor

-- 1. Поля предоплаты (рассрочки) в заявке на аттестацию
ALTER TABLE attestation_applications
  ADD COLUMN IF NOT EXISTS prepaid_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS prepaid_at     DATE,
  ADD COLUMN IF NOT EXISTS prepaid_method TEXT;

-- 2. Привязка платежа к конкретной заявке (нужна для корректировки суммы)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS attestation_application_id UUID REFERENCES attestation_applications(id);

-- 3. Уведомить PostgREST о новой схеме (обязательно!)
NOTIFY pgrst, 'reload schema';
