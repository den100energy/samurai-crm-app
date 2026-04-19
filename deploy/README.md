# Деплой Samurai CRM на Beget VPS

Этот каталог — рабочие материалы для переезда с Vercel на Beget. Полный план — в `C:\Users\DJ\.claude\plans\cryptic-squishing-hejlsberg.md`.

## Что здесь

- [`crontab.txt`](crontab.txt) — 8 cron-задач, замена `vercel.json` на системный crontab VPS
- [`set-telegram-webhook.sh`](set-telegram-webhook.sh) — одноразовый скрипт: переводит вебхуки обоих Telegram-ботов на новый домен
- [`../.env.example`](../.env.example) — шаблон всех переменных окружения

## Требования к VPS

- Ubuntu 22.04 LTS
- 2 vCPU, 4+ ГБ RAM, 40+ ГБ SSD
- Beget marketplace образ **«Supabase»** (он же ставит Docker + self-hosted Supabase)
- Node.js 20 LTS, PM2, nginx

## Быстрый старт (на VPS)

### 1. Первичная настройка

```bash
# После ssh root@<ip>
apt update && apt install -y nodejs npm nginx certbot python3-certbot-nginx
npm install -g pm2
node -v    # должно быть >=20
```

### 2. Клонирование и сборка

```bash
cd /opt
git clone https://github.com/<user>/samurai-crm-app.git
cd samurai-crm-app
cp .env.example .env.local
nano .env.local     # заполнить все переменные — см. .env.example
npm ci
npm run build
```

### 3. Запуск через PM2

```bash
pm2 start npm --name samurai-crm -- start
pm2 save
pm2 startup           # скопировать и выполнить команду, которую выведет
pm2 logs samurai-crm  # убедиться, что Next.js слушает порт 3000
```

### 4. nginx reverse-proxy

Конфиг для `crm.samurai.ru` (положить в `/etc/nginx/sites-available/crm.samurai.ru`):

```nginx
server {
  listen 80;
  server_name crm.samurai.ru;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

```bash
ln -s /etc/nginx/sites-available/crm.samurai.ru /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d crm.samurai.ru   # Let's Encrypt SSL
```

### 5. Crontab

```bash
mkdir -p /var/log/samurai-cron
cp deploy/crontab.txt /tmp/crontab.txt
nano /tmp/crontab.txt       # подставить APP_URL и CRON_SECRET
crontab /tmp/crontab.txt
crontab -l                  # проверить
```

### 6. Telegram webhook'и

```bash
bash deploy/set-telegram-webhook.sh
# Отправить /start в обоих ботах — должны ответить.
```

## Обновление кода (после merge в main)

```bash
cd /opt/samurai-crm-app
git pull
npm ci
npm run build
pm2 reload samurai-crm
```

## Бэкап базы (раз в сутки)

Добавить в crontab отдельной строкой:

```
0 3 * * *  pg_dump -h localhost -U postgres -d postgres -F c -f /var/backups/supabase-$(date +\%F).dump && find /var/backups -name 'supabase-*.dump' -mtime +14 -delete
```

## Откат на Vercel (если что-то пошло не так)

1. В DNS-панели Beget переключить A-запись `crm.samurai.ru` обратно на IP Vercel (либо на CNAME `cname.vercel-dns.com`).
2. В Telegram вернуть вебхуки на старый URL:
   ```bash
   NEXT_PUBLIC_APP_URL=https://samurai-crm-app.vercel.app bash deploy/set-telegram-webhook.sh
   ```
3. Supabase Cloud всё это время **не трогался** — данные целы.

## Что пока НЕ сделано (отдельные задачи)

- `CRON_SECRET` на проде — пользователь должен сам положить в `.env.local` и в crontab
- Перенос фото из Cloudinary в Supabase Storage (вопрос биометрических ПДн)
- Замена OpenRouter на SberGPT/YandexGPT (для полного 152-ФЗ)
- Автоматический CI/CD
