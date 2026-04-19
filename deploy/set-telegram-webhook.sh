#!/usr/bin/env bash
# Настройка Telegram webhook'ов после переезда на новый домен.
#
# Запуск: bash deploy/set-telegram-webhook.sh
#
# Требует в окружении (или подтянет из .env.local, если есть):
#   NEXT_PUBLIC_APP_URL         — новый домен, например https://crm.samurai.ru
#   TELEGRAM_BOT_TOKEN          — токен CRM-бота (@samurai_school_crm_bot)
#   TELEGRAM_CLIENT_BOT_TOKEN   — токен клиент-бота (@samuraihelp_bot)
#
# Что делает:
#   1. Устанавливает webhook CRM-бота    → $APP_URL/api/telegram/staff
#   2. Устанавливает webhook клиент-бота → $APP_URL/api/telegram
#   3. Проверяет ответ getWebhookInfo у обоих

set -euo pipefail

# Подтянуть .env.local, если рядом
if [[ -f .env.local ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env.local | grep -E '^(NEXT_PUBLIC_APP_URL|TELEGRAM_BOT_TOKEN|TELEGRAM_CLIENT_BOT_TOKEN)=' | xargs -d '\n')
fi

: "${NEXT_PUBLIC_APP_URL:?нужно задать NEXT_PUBLIC_APP_URL}"
: "${TELEGRAM_BOT_TOKEN:?нужно задать TELEGRAM_BOT_TOKEN}"
: "${TELEGRAM_CLIENT_BOT_TOKEN:?нужно задать TELEGRAM_CLIENT_BOT_TOKEN}"

STAFF_URL="${NEXT_PUBLIC_APP_URL%/}/api/telegram/staff"
CLIENT_URL="${NEXT_PUBLIC_APP_URL%/}/api/telegram"

echo "▶ Ставлю webhook CRM-бота → $STAFF_URL"
curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"${STAFF_URL}\",\"drop_pending_updates\":true}"
echo

echo "▶ Ставлю webhook клиент-бота → $CLIENT_URL"
curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_CLIENT_BOT_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"${CLIENT_URL}\",\"drop_pending_updates\":true}"
echo

echo "▶ Проверка CRM-бота:"
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | \
  sed -E 's/"[^"]*_token":"[^"]*"/"(redacted)"/g'
echo

echo "▶ Проверка клиент-бота:"
curl -fsS "https://api.telegram.org/bot${TELEGRAM_CLIENT_BOT_TOKEN}/getWebhookInfo" | \
  sed -E 's/"[^"]*_token":"[^"]*"/"(redacted)"/g'
echo

echo "✓ Готово. Отправь /start в обоих ботах и проверь, что они отвечают."
