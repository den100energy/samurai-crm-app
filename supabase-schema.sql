-- Samurai CRM Database Schema
-- Run this in Supabase SQL Editor

-- Groups (учебные группы)
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  schedule TEXT,
  trainer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Students (студенты)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  parent_phone TEXT,
  birth_date DATE,
  group_id UUID REFERENCES groups(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'left')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscriptions (абонементы)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  visits_total INTEGER,
  visits_used INTEGER DEFAULT 0,
  price NUMERIC(10,2),
  paid_amount NUMERIC(10,2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'frozen')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attendance (посещаемость)
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  group_id UUID REFERENCES groups(id),
  visited_at DATE NOT NULL DEFAULT CURRENT_DATE,
  marked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, visited_at, group_id)
);

-- Payments (платежи)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT DEFAULT 'cash' CHECK (method IN ('cash', 'card', 'transfer')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Leads (потенциальные клиенты)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  source TEXT,
  interest TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'trial', 'converted', 'lost')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert initial groups
INSERT INTO groups (name, schedule, trainer_name) VALUES
  ('Дети 4-9 лет', 'Уточнить расписание', NULL),
  ('Подростки (новички)', 'Вт, Сб', NULL),
  ('Подростки (опытные)', 'Пн, Ср, Пт', NULL),
  ('Цигун', 'Чт', NULL),
  ('Индивидуальные занятия', 'По договорённости', NULL);

-- Enable Row Level Security (allow all for now - add auth later)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Temporary: allow all operations (no auth yet)
CREATE POLICY "allow_all" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON leads FOR ALL USING (true) WITH CHECK (true);
