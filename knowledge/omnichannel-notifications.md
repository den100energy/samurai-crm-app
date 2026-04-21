# Омниканальные уведомления: Telegram + VK + Макс

> Статус: 🟢 Этап 1 готов в коде, ожидает применения миграции в Supabase
> Последнее обновление: 2026-04-20

## Зачем это нужно

Telegram в России блокируют. Клиенты (ученики, родители) должны сами выбирать удобный мессенджер для получения уведомлений от школы. Вместо одной Telegram-ссылки — универсальная страница с выбором.

---

## Как это работает сейчас (до изменений)

- Два Telegram-бота:
  - **Клиентский** (`TELEGRAM_CLIENT_BOT_TOKEN`) — ученики, родители, лиды
  - **CRM** (`TELEGRAM_BOT_TOKEN`) — персонал, финансы (этот НЕ трогаем)
- `telegram_chat_id` хранится прямо в таблицах: `students`, `leads`, `trainers`, `student_contacts`
- Клиент получает ссылку `t.me/bot?start=TOKEN` → пишет боту → бот привязывает chat_id к карточке
- Все уведомления идут через `sendClientMessage()` из `src/lib/clientBot.ts`

---

## Целевая архитектура

### Новая таблица БД — `user_channels`

```sql
CREATE TABLE user_channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  user_type   text CHECK (user_type IN ('student', 'lead', 'trainer', 'contact')) NOT NULL,
  provider    text CHECK (provider IN ('telegram', 'vk', 'max')) NOT NULL,
  chat_id     text NOT NULL,
  is_preferred boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(provider, chat_id),
  UNIQUE(user_id, user_type, provider)
);
```

**Старые колонки `telegram_chat_id` не удаляем** — они нужны как fallback пока идёт миграция.

### Адаптерный слой уведомлений

```
src/lib/notifications/
  index.ts              ← единая функция sendToUser()
  adapters/
    telegram.ts         ← отправка через Telegram Bot API
    vk.ts               ← отправка через VK API
    max.ts              ← отправка через Макс Bot API
```

`sendToUser(userId, userType, text)`:
1. Берёт из `user_channels` все привязанные каналы пользователя
2. Отправляет через нужный адаптер
3. Если каналов нет — возвращает `false` (роут делает fallback на старый telegram_chat_id)

### Страница выбора мессенджера — `/invite/[token]`

Вместо прямой ссылки `t.me/bot?start=TOKEN` теперь:
`https://crm.samurai.school/invite/TOKEN`

Страница показывает 3 кнопки:
- **Telegram** → `https://t.me/{BOT_USERNAME}?start=TOKEN`
- **ВКонтакте** → `https://vk.com/...?ref=TOKEN`
- **Макс** → ссылка на бот Макс

### Новые webhook-роуты

| Роут | Назначение |
|------|-----------|
| `/api/telegram/route.ts` | Уже есть, добавить запись в user_channels при привязке |
| `/api/vk/route.ts` | Новый — обработчик Callback API от VK |
| `/api/max/route.ts` | Новый — обработчик webhook от Макс |

---

## Поэтапный план реализации

---

### ЭТАП 1 — Фундамент (не зависит от ботов)
**Статус: 🟢 Код готов, нужно применить миграцию в Supabase и протестировать**

**Шаг 1.1 — БД: создать таблицу user_channels**
- [x] SQL-файл создан: `user-channels-migration.sql` (корень проекта)
- [ ] **TODO:** запустить файл в Supabase SQL Editor

**Шаг 1.2 — Адаптеры: создать notification service**
- [x] `src/lib/notifications/adapters/telegram.ts`
- [x] `src/lib/notifications/adapters/vk.ts` (готов, требует VK_GROUP_TOKEN)
- [x] `src/lib/notifications/adapters/max.ts` (готов, требует MAX_BOT_TOKEN)
- [x] `src/lib/notifications/index.ts` — `sendToUser`, `linkUserChannel`, `sendDirect`

**Шаг 1.3 — Страница выбора мессенджера**
- [x] `src/app/invite/[token]/page.tsx`
- [x] Кнопка Telegram активна, VK/Макс — «Скоро» пока нет env-переменных

**Шаг 1.4 — Обновить getInviteLink**
- [x] `src/lib/clientBot.ts` — `getInviteLink` теперь возвращает `/invite/TOKEN`
- [x] Обновлены 4 места с прямыми Telegram-ссылками:
  - `src/app/students/[id]/page.tsx` (copyContactInviteLink, copyStudentTelegramLink)
  - `src/app/cabinet/[token]/page.tsx` (баннер «Подключить уведомления»)
  - `src/app/parent/[token]/page.tsx` (кнопки контактов)
  - `src/app/api/trainer/telegram-link/route.ts` (ссылка для тренера)

**Шаг 1.5 — Fallback-логика в notification-роутах**
- [x] `src/app/api/broadcast/route.ts` (переписан под Recipient с user_id/user_type)
- [x] `src/app/api/notify-event/route.ts`
- [x] `src/app/api/notify-schedule-change/route.ts`
- [x] `src/app/api/cron/lifecycle-touchpoints/route.ts`
- [x] `src/app/api/auto-send-survey/route.ts`

**Шаг 1.6 — Обновить Telegram webhook**
- [x] `/api/telegram/route.ts` — при привязке `/start TOKEN` теперь вызывается `linkUserChannel`
  для всех 4 типов: lead, student, contact, trainer

**Шаг 1.7 — TypeScript-проверка**
- [x] `npx tsc --noEmit` проходит без ошибок

**Шаг 1.8 — Ручная проверка после миграции (TODO)**
- [ ] Применить SQL-миграцию в Supabase
- [ ] Открыть `/invite/TOKEN` существующего ученика → видны 3 кнопки
- [ ] Нажать «Telegram» → бот привязывает → проверить запись в user_channels
- [ ] Запустить `/api/notify-event` или `/api/broadcast` — старый ученик получает через fallback, новый через user_channels

---

### ЭТАП 2 — ВКонтакте
**Статус: ⬜ Не начат**
**Предварительно: зарегистрировать бота в VK**

#### Что нужно сделать вручную перед кодом:
- [ ] Создать/использовать существующее сообщество VK школы
- [ ] В настройках сообщества: Сообщения → Включить
- [ ] Настройки → Работа с API → Ключи доступа → Создать ключ с правами на сообщения
- [ ] Настройки → Работа с API → Callback API:
  - Указать URL: `https://crm.samurai.school/api/vk`
  - Сохранить строку подтверждения (`VK_CONFIRMATION_CODE`)
- [ ] Включить события: `message_new`
- [ ] Получить `VK_GROUP_TOKEN` и `VK_GROUP_ID`

#### Код:

**Шаг 2.1 — Реализовать VkAdapter**
- [ ] Заполнить `src/lib/notifications/adapters/vk.ts`
- [ ] Использовать `messages.send` через fetch (не vk-io, чтобы не тянуть зависимость)
- [ ] VK не поддерживает HTML-теги → стриппить или заменять на plain text

**Шаг 2.2 — Создать VK webhook**
- [ ] Создать `src/app/api/vk/route.ts`
- [ ] Обработать подтверждение (VK шлёт GET/POST с type=confirmation → ответить строкой)
- [ ] Обработать `message_new`:
  - Извлечь `ref` из payload (инвайт-токен)
  - Найти запись по токену в students/leads/contacts
  - Записать `vk_user_id` в `user_channels`
  - Ответить приветственным сообщением

**Шаг 2.3 — Добавить env-переменные**
```
VK_GROUP_TOKEN=
VK_GROUP_ID=
VK_CONFIRMATION_CODE=
```

**Шаг 2.4 — Обновить страницу /invite/[token]**
- [ ] Кнопка VK становится активной с реальной ссылкой

#### Формат invite-ссылки VK:
`https://vk.com/im?sel=-{GROUP_ID}&ref={TOKEN}`
или через короткий адрес сообщества: `https://vk.me/{club_short_name}?ref={TOKEN}`

> ⚠️ VK-бот не может написать первым. Клиент должен сам написать в группу по ссылке.
> После первого сообщения webhook получает ref и привязывает аккаунт.

**Шаг 2.5 — Проверка Этапа 2**
- [ ] Ученик открывает `/invite/TOKEN`, нажимает «ВКонтакте»
- [ ] Переходит в VK, пишет боту любое сообщение
- [ ] Webhook получает сообщение, извлекает TOKEN из ref, записывает в user_channels
- [ ] Ученик получает приветствие
- [ ] Запустить рассылку — ученик с VK получает в VK

---

### ЭТАП 3 — Мессенджер Макс
**Статус: ⬜ Не начат**
**Предварительно: зарегистрировать бота в Макс**

#### Что нужно сделать вручную перед кодом:
- [ ] Зайти на https://dev.max.ru (или аналог — уточнить актуальный адрес)
- [ ] Создать бота, получить `MAX_BOT_TOKEN`
- [ ] Настроить webhook URL: `https://crm.samurai.school/api/max`
- [ ] Уточнить формат invite-ссылки (аналог `t.me/bot?start=TOKEN`)

#### Код:

**Шаг 3.1 — Реализовать MaxAdapter**
- [ ] Заполнить `src/lib/notifications/adapters/max.ts`
- [ ] Эндпоинт: `https://platform-api.max.ru/messages` (уточнить по документации)
- [ ] Авторизация: Bearer token

**Шаг 3.2 — Создать Макс webhook**
- [ ] Создать `src/app/api/max/route.ts`
- [ ] Обработать входящие сообщения (формат похож на Telegram)
- [ ] Извлечь токен из команды `/start TOKEN`
- [ ] Привязать max_user_id → записать в user_channels

**Шаг 3.3 — Добавить env-переменные**
```
MAX_BOT_TOKEN=
MAX_BOT_USERNAME=
```

**Шаг 3.4 — Обновить страницу /invite/[token]**
- [ ] Кнопка Макс становится активной

**Шаг 3.5 — Проверка Этапа 3**
- [ ] Аналогично VK — пройти весь флоу привязки и уведомления

---

### ЭТАП 4 — Чистая миграция (опционально, потом)
**Статус: ⬜ Не начат**

Когда всё стабильно работает через user_channels:
- [ ] Написать скрипт миграции: перенести все `telegram_chat_id` из таблиц → `user_channels`
- [ ] Убрать fallback-логику из notification-роутов
- [ ] Удалить колонки `telegram_chat_id` из `students`, `leads`, `trainers`, `student_contacts`

---

## Env-переменные (итог)

### Уже есть
```
TELEGRAM_CLIENT_BOT_TOKEN
TELEGRAM_CLIENT_BOT_USERNAME
TELEGRAM_BOT_TOKEN
TELEGRAM_FINANCE_CHAT_ID
TELEGRAM_OWNER_CHAT_ID
ADMIN_CHAT_ID
FOUNDER_TELEGRAM_CHAT_ID
```

### Добавить (Этап 2)
```
VK_GROUP_TOKEN=
VK_GROUP_ID=
VK_CONFIRMATION_CODE=
```

### Добавить (Этап 3)
```
MAX_BOT_TOKEN=
MAX_BOT_USERNAME=
```

---

## Файлы проекта — что меняем

| Файл | Действие |
|------|----------|
| `src/lib/clientBot.ts` | Изменить `getInviteLink` → `/invite/TOKEN` |
| `src/lib/notifications/index.ts` | Создать |
| `src/lib/notifications/adapters/telegram.ts` | Создать |
| `src/lib/notifications/adapters/vk.ts` | Создать |
| `src/lib/notifications/adapters/max.ts` | Создать |
| `src/app/invite/[token]/page.tsx` | Создать |
| `src/app/api/telegram/route.ts` | Обновить (+ запись в user_channels) |
| `src/app/api/vk/route.ts` | Создать |
| `src/app/api/max/route.ts` | Создать |
| `src/app/api/broadcast/route.ts` | Обновить (fallback) |
| `src/app/api/notify-event/route.ts` | Обновить (fallback) |
| `src/app/api/notify-schedule-change/route.ts` | Обновить (fallback) |
| `src/app/api/cron/lifecycle-touchpoints/route.ts` | Обновить (fallback) |
| `src/app/api/auto-send-survey/route.ts` | Обновить (fallback) |
