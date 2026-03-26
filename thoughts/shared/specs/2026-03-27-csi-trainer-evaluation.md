# CSI Trainer Evaluation System — Specification

**Date:** 2026-03-27
**Status:** Ready for implementation

---

## Executive Summary

Система автоматического сбора и отслеживания CSI-оценок тренеров. Ученики и родители оценивают тренеров через Google Forms (по одной на каждого тренера) минимум раз в 3 месяца. CRM отслеживает кто оценил, напоминает тем кто не оценил, и показывает аналитику в дашборде.

---

## Problem Statement

- Текущий процент участия в CSI-опросе: ~10% от всех учеников
- Нет системы отслеживания — непонятно кто оценил, кто нет
- Нет автоматических напоминаний
- Данные из Google Forms существуют отдельно от CRM, аналитика ручная (Looker Studio)

**Почему сейчас:** Школа хочет системно улучшать качество работы тренеров и нуждается в регулярной обратной связи от учеников и родителей.

---

## Success Criteria

1. Процент учеников/родителей давших оценку за квартал: **>60%** (было 10%)
2. Данные из Google Forms автоматически попадают в CRM в течение 10 минут
3. Система автоматически напоминает тем, кто не оценивал более 2.5 месяцев
4. Аналитика доступна в CRM без Looker Studio

---

## User Personas

**Основатель (Денис)** — видит полную аналитику по всем тренерам, Coverage (кто оценил/нет), управляет настройками

**Тренер** — видит свой NPS, свои оценки по месяцам, текстовые комментарии от учеников/родителей

**Ученик (подростки, взрослые)** — видит кнопки оценки в своём кабинете, получает напоминания

**Родитель** — видит кнопки в родительском кабинете за ребёнка (группа "Дети 4-9" — только родитель, без кнопки у самого ученика)

---

## Rules: Who Can Evaluate

| Группа | Ученик сам | Родитель |
|--------|------------|----------|
| Дети 4-9 лет | ❌ нет | ✅ да |
| Подростки (нач) | ✅ да | ✅ да |
| Подростки (оп) | ✅ да | ✅ да |
| Цигун | ✅ да | ✅ да (если есть) |
| Индивидуальные | ✅ да | ✅ да |

---

## Google Forms (текущие)

| Тренер | Ссылка |
|--------|--------|
| Денис Филонов | https://forms.gle/j4y3szXFa4E1B3Gh7 |
| Евгения Филонова | https://forms.gle/Rzt1JPoBxrP3KcWS9 |
| Михаил Лунёв | https://forms.gle/yqndxqfz6d7vt6tr9 |

### Структура форм (одинакова для всех)
1. **NPS** (1-10): "Тебе нравится занятия, удовлетворен ли ты пользой..." (обязательный)
2. **Причина** (текст): "Какова причина, по которой ты поставил(а) такую оценку?" (обязательный)
3. **Улучшения** (текст): "Что мы можем сделать лучше?" (обязательный)
4. **Группа** (dropdown): Старт / Основная
5. **Телефон** (текст, необязательный): для обратной связи
6. **Код участника** (текст) ← **ДОБАВИТЬ в каждую форму** — предзаполняется автоматически

---

## User Journey

### Ученик/Родитель оценивает тренера

1. Заходит в личный кабинет
2. Видит блок "Оцените тренеров" с карточкой на каждого тренера
3. На каждой карточке: имя тренера, дата последней оценки (или "Ещё не оценивали"), кнопка "Оценить"
4. Нажимает "Оценить" → открывается Google Form с предзаполненным кодом участника
5. Заполняет форму
6. Возвращается в кабинет → в течение 10 минут карточка обновляется ("Оценено сегодня ✓")

### Напоминание (2.5 месяца без оценки)

1. Cron ежедневно проверяет: прошло ли 75 дней с последней оценки каждого студента по каждому тренеру
2. Если да — показывает баннер в кабинете: *"Помогите тренеру стать лучше — оцените занятия. Это займёт 2 минуты 👇"*
3. + отправляет сообщение в Telegram: *"Привет! Твоё мнение помогает [Имя тренера] делать тренировки полезнее и интереснее для тебя. Оцени занятия — это займёт 2 минуты: [ссылка]"*
4. После того как оценка получена — баннер пропадает, следующее напоминание через 75 дней

---

## Technical Architecture

### Data Flow

```
Ученик открывает форму из кабинета
  ↓ URL = form_url + ?entry.XXXXXXX={student_token}
Заполняет Google Form
  ↓                          ↓
Apps Script webhook      Google Sheet (всегда)
  ↓ POST (мгновенно)          ↓
/api/csi/webhook         Vercel cron /api/csi/poll
  ↓                          ↓ (каждые 10 минут)
Supabase: csi_responses (upsert по token + timestamp)
```

### Database Schema

```sql
-- Responses from Google Forms
CREATE TABLE csi_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  trainer_id UUID REFERENCES trainers(id),  -- определяется по форме из которой пришёл ответ
  submitted_at TIMESTAMPTZ NOT NULL,
  nps_score INTEGER NOT NULL CHECK (nps_score BETWEEN 1 AND 10),
  comment_reason TEXT,
  comment_improve TEXT,
  group_name TEXT,
  student_token TEXT,   -- для дедупликации
  source TEXT DEFAULT 'webhook',  -- 'webhook' | 'poll'
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_token, trainer_id, submitted_at)  -- предотвращение дублей
);

-- Tracking last notification sent
CREATE TABLE csi_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  trainer_id UUID REFERENCES trainers(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  channel TEXT  -- 'telegram' | 'cabinet'
);

-- Add to trainers table
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS google_form_url TEXT;
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS google_sheet_id TEXT;
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS google_form_entry_id TEXT;  -- entry.XXXXXXXXX для токена

-- Add to students table (для matching)
ALTER TABLE students ADD COLUMN IF NOT EXISTS survey_token TEXT DEFAULT gen_random_uuid()::text;
```

### NPS Categories (стандарт)
- **Промоутеры**: 9-10
- **Нейтральные**: 7-8
- **Критики**: 1-6
- **NPS% = (Промоутеры - Критики) / Всего × 100**

### API Endpoints

**`POST /api/csi/webhook`**
- Принимает данные от Apps Script
- Определяет тренера по заголовку запроса (trainer_id передаётся в скрипте)
- Находит студента по `student_token`
- Upsert в `csi_responses`

**`GET /api/cron/csi-poll`** (Vercel cron, каждые 10 мин)
- Для каждого тренера читает новые строки из Google Sheets API
- Upsert в `csi_responses` (дубли игнорируются по UNIQUE constraint)

**`GET /api/cron/csi-remind`** (Vercel cron, ежедневно 10:00)
- Находит студентов у кого нет оценки за последние 75 дней по каждому тренеру
- Отправляет Telegram-уведомление (не чаще раза в 14 дней повторно)
- Фиксирует в `csi_notifications`

### Google Apps Script (устанавливается на каждую форму)
```javascript
// Одинаковый скрипт для всех трёх форм, только TRAINER_ID разный
const TRAINER_ID = 'uuid-тренера'
const WEBHOOK_URL = 'https://samurai-crm.vercel.app/api/csi/webhook'
const CRON_SECRET = '...'  // из env

function onFormSubmit(e) {
  const values = e.namedValues
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify({
      trainer_id: TRAINER_ID,
      secret: CRON_SECRET,
      nps_score: parseInt(values['NPS'][0]),
      comment_reason: values['Причина'][0],
      comment_improve: values['Улучшения'][0],
      group_name: values['Группа'][0],
      student_token: values['Код участника'][0],
      submitted_at: new Date().toISOString()
    }),
    muteHttpExceptions: true
  })
}
```

---

## UI Components

### В кабинете ученика и родителя — блок "Оцените тренеров"

```
┌─────────────────────────────────────┐
│  ⭐ Оцените тренеров                │
│                                     │
│  Денис Филонов                      │
│  Последняя оценка: 15 января        │
│  [Оценить →]                        │
│                                     │
│  Евгения Филонова                   │
│  ⚠️ Не оценивали 3 месяца           │
│  [Оценить сейчас →]   ← выделено   │
│                                     │
│  Михаил Лунёв                       │
│  ✓ Оценено сегодня                  │
└─────────────────────────────────────┘
```

- Показывать блок только активным ученикам
- Группа "Дети 4-9": блок только в родительском кабинете
- Кнопка "Оценить" открывает форму в новой вкладке (с токеном в URL)
- Статус обновляется после получения ответа (polling)

### Баннер-напоминание (если 75+ дней)
```
┌─────────────────────────────────────────────┐
│ 💬 Помогите тренеру стать лучше!            │
│ Евгения Филонова ждёт вашу оценку.          │
│ Это займёт 2 минуты.    [Оценить →]  [✕]   │
└─────────────────────────────────────────────┘
```

### Страница аналитики `/analytics/csi`

**Для основателя — по каждому тренеру:**
- NPS текущего месяца (%)
- Количество ответов за месяц
- Промоутеры / Критики
- График динамики NPS по месяцам
- График динамики ответов
- Таблица Coverage: список учеников + дата последней оценки + статус (✓ Оценил / ⚠️ Не оценивал N дней)
- Последние 10 текстовых комментариев (разворачиваемые)

**Для тренера в своём кабинете — только свои данные:**
- Та же структура, только один блок (свои оценки)
- Комментарии анонимны (без имени ученика)

### Настройки тренера (раздел Settings)

Добавить в карточку тренера поля:
- `Ссылка на Google Form CSI`
- `ID Google Sheet` (для polling)
- `Entry ID поля "Код участника"` (технический параметр)

---

## Implementation Plan (порядок работ)

### Шаг 1 — SQL миграция (Supabase Dashboard)
Выполнить SQL из раздела Database Schema выше

### Шаг 2 — Добавить поле в Google Forms
Вручную добавить поле "Код участника (не изменяйте)" в конец каждой из 3 форм. Записать entry.XXXXXXXXX ID.

### Шаг 3 — Google Apps Script
Установить скрипт на каждую форму (vakikai@gmail.com). Настроить триггер onFormSubmit.

### Шаг 4 — Backend
- `POST /api/csi/webhook`
- `GET /api/cron/csi-poll` + vercel.json
- `GET /api/cron/csi-remind` + vercel.json

### Шаг 5 — Google Sheets API
Настроить Service Account в Google Cloud Console. Добавить GOOGLE_SERVICE_ACCOUNT_JSON в Vercel env.

### Шаг 6 — UI в кабинетах
Блок "Оцените тренеров" в `cabinet/[token]/page.tsx` и `parent/[token]/page.tsx`

### Шаг 7 — Аналитика
Страница `/analytics/csi` (или раздел в существующей аналитике)

### Шаг 8 — Настройки
Поля google_form_url в карточке тренера в Settings

---

## Out of Scope

- Встроенная (собственная) форма оценки — будущий этап
- Push-уведомления через браузер
- Экспорт отчётов в PDF/Excel
- Автоответ тренера на комментарий

---

## Open Questions for Implementation

1. Нужно выяснить `entry.XXXXXXXXX` ID поля "Код участника" для каждой из 3 форм (после добавления поля)
2. Нужно выяснить `spreadsheet_id` Google Sheet каждой формы (из URL таблицы)
3. Нужно создать Service Account в Google Cloud Console и дать доступ к таблицам
4. Уточнить UUID тренеров в Supabase для прописки в Apps Script
5. Проверить: есть ли в `trainers` таблице записи для всех 3 тренеров

---

## Appendix: Research Findings

- Google Apps Script webhook: 95%+ надёжность на малом масштабе, бесплатно, нет retry при ошибке
- Google Sheets API polling: 100% надёжность, требует Service Account, задержка до 10 мин
- Рекомендация: dual approach (webhook + polling) с dedup через UNIQUE constraint
- Pre-fill URL format: `{form_url}?usp=pp_url&entry.XXXXXXXXX={token}`
- entry.ID стабильны пока поле не удалено и не создано заново
- Matching через телефон отклонён из-за проблем с форматами — используем UUID-токен
