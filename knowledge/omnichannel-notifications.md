# Омниканальные уведомления: Telegram + VK + Макс

> Статус: 🟢 Этапы 1, 2 (VK) и 3 (Макс — код) готовы. Макс ждёт регистрации webhook на проде
> Последнее обновление: 2026-04-22

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
**Статус: 🟢 Готово, протестировано в проде 2026-04-21**

#### Настройка сообщества VK (сделано):
- [x] Сообщество клуба с включёнными сообщениями
- [x] Callback API → URL `https://crm.samu-rai.ru/api/vk` (ВАЖНО: домен `crm.samu-rai.ru`, не корень)
- [x] Секретный ключ (`VK_CONFIRMATION_CODE`) + строка подтверждения
- [x] События: `message_new`
- [x] `VK_GROUP_TOKEN` (права «Сообщения сообщества») и `VK_GROUP_ID` = 19630823

#### Код (сделано):

**Шаг 2.1 — VkAdapter** — `src/lib/notifications/adapters/vk.ts`
- [x] `messages.send` через fetch, plain text (VK не любит HTML)
- [x] Логирование ошибок API: `console.error('[vk] API error: ...')` — оставлено на будущее

**Шаг 2.2 — VK webhook** — `src/app/api/vk/route.ts`
- [x] Подтверждение (type=confirmation → отдаём VK_CONFIRMATION_CODE)
- [x] Поиск токена: сначала `ref`, потом `payload`, потом `/start TOKEN` в тексте
  (VK присылает `ref` только в первом сообщении)
- [x] Перебор lead → student → contact → trainer
- [x] `linkUserChannel()` и приветствие

**Шаг 2.3 — Env-переменные** (в `.env.local` на Beget):
```
VK_GROUP_TOKEN=<ключ сообщества>
VK_GROUP_ID=19630823
VK_CONFIRMATION_CODE=<строка подтверждения>
```

**Шаг 2.4 — Страница `/invite/[token]`** — кнопка VK активна с ref-ссылкой.

#### Формат invite-ссылки VK:
`https://vk.com/club19630823?ref={TOKEN}` (используется `vk.com/club<ID>`, не `vk.me`)

> ⚠️ VK-бот не может написать первым. Клиент должен сам написать в группу по ссылке.
> После первого сообщения webhook получает ref и привязывает аккаунт.

**Шаг 2.5 — UI-интеграция (добавлено по фидбеку):**
- [x] Счётчик «с ботом / без» в рассылке учитывает user_channels, а не только `telegram_chat_id`.
  Новый эндпоинт: `src/app/api/broadcast/student-channels/route.ts`
- [x] Универсальный эндпоинт для чтения `user_channels` с service_role: `src/app/api/user-channels/route.ts`
  (RLS не даёт клиенту читать напрямую)
- [x] Карточка ученика `src/app/students/[id]/page.tsx`: бейджи TG/VK/Макс для каждого контакта
  и для самого ученика (вместо отдельной кнопки «Подключить Telegram»)

#### Подводные камни, на которых потеряли время:
1. **Домен в URL Callback API**: указали `samu-rai.ru` (старый Bitrix) вместо `crm.samu-rai.ru` → webhook не доходил
2. **VK_CONFIRMATION_CODE меняется при смене URL** — VK генерирует новый код, старый перестаёт работать
3. **Пустой токен** (placeholder `"здесь ключ сообщества"`) → VK API ошибка 5 «invalid access_token»
4. **Миграция применялась в Supabase Cloud, а прод — self-hosted на Beget**. После применения нужно:
   ```bash
   docker exec -i <supabase-db-container> psql -U postgres -d postgres < user-channels-migration.sql
   docker exec -i <supabase-db-container> psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
   ```
5. **broadcast возвращал 0 получателей** для «Родители»: SQL запрашивал `contact_name`, а колонка называется `name` — PostgREST молча отдавал `null`

---

### ЭТАП 3 — Мессенджер Макс
**Статус: 🟢 Код готов, ждёт env на Beget + регистрацию webhook**

#### Бот:
- [x] Зарегистрирован на dev.max.ru
- [x] Ник: `id615518110903_bot` (автогенерируется по шаблону `id<INN>_bot`)
- [x] Токен получен (хранится у владельца, в `.env.local` на Beget)

#### Код (готов):

**Шаг 3.1 — MaxAdapter** — `src/lib/notifications/adapters/max.ts`
- [x] `POST https://platform-api.max.ru/messages?user_id={ID}`
- [x] Заголовок `Authorization: <token>` (БЕЗ слова Bearer — важно!)
- [x] Body: `{text, format: "html", notify: true}`

**Шаг 3.2 — Макс webhook** — `src/app/api/max/route.ts`
- [x] Проверка `X-Max-Bot-Api-Secret`
- [x] `bot_started`: `payload` = наш TOKEN, `user.user_id` = chat_id → автопривязка через диплинк
- [x] `message_created`: fallback на `/start TOKEN` в тексте
- [x] Перебор lead → student → contact → trainer
- [x] Приветствие через `sendMaxMessage`

**Шаг 3.3 — Регистрация webhook** — `src/app/api/max/register/route.ts`
- [x] Защищённый роут (`Authorization: Bearer $CRON_SECRET`)
- [x] POST → подписка, GET → текущие подписки, DELETE → отписаться

**Шаг 3.4 — Страница `/invite/[token]`** — кнопка Макс уже была подготовлена под `NEXT_PUBLIC_MAX_BOT_USERNAME`, активируется автоматически когда env появится.

#### Формат invite-ссылки Макс:
`https://max.ru/id615518110903_bot?start={TOKEN}` (payload до 128 символов)

#### Env на Beget (`.env.local`):
```
MAX_BOT_TOKEN=<токен из Чат-боты → Интеграция → Получить токен>
NEXT_PUBLIC_MAX_BOT_USERNAME=id615518110903_bot
MAX_WEBHOOK_SECRET=P8N5B7jBUfi5ewMtKlLhpNJGayh6xzWZ
```

#### Что осталось сделать на Beget после `git pull`:
1. Добавить 3 env-переменные в `.env.local`
2. Перезапустить приложение (`pm2 restart all` или как настроено)
3. Зарегистрировать webhook:
   ```bash
   curl -X POST https://crm.samu-rai.ru/api/max/register \
        -H "Authorization: Bearer $CRON_SECRET"
   ```
4. Проверить: `curl -H "Authorization: Bearer $CRON_SECRET" https://crm.samu-rai.ru/api/max/register` → должен вернуть наш URL в списке подписок
5. Тест: открыть `/invite/<TOKEN>` существующего ученика → нажать «Макс» → попасть в бот → автопривязка + приветствие

#### Подводные камни (на которых можем потерять время):
1. **Authorization БЕЗ слова Bearer** — у MAX просто `Authorization: <token>`, отличается от Telegram
2. **user_id передаётся как query-параметр**, не в body — `?user_id={ID}`
3. **Webhook требует HTTPS на 443** + сертификат от доверенного CA (у нас Let's Encrypt — ок). Самоподписанные не работают
4. **Webhook должен ответить 200 за 30 секунд**, иначе MAX повторяет запрос с экспоненциальной задержкой
5. **Если в течение 8 часов webhook не отвечает 200** — MAX автоматически отписывает бота, придётся регистрировать заново
6. **payload в диплинке до 128 символов** — наши TOKEN-ы укладываются, но если когда-то решим закодировать несколько параметров — формат `?start=param1_value1__param2_value2`

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
NEXT_PUBLIC_MAX_BOT_USERNAME=id615518110903_bot
MAX_WEBHOOK_SECRET=
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
