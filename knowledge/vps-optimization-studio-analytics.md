# Оптимизация VPS: отключение Studio и Analytics

## Когда делать
После ~1 месяца стабильной работы на Beget (ориентир: конец мая 2026).

## Цель
Отключить два Docker-контейнера, которые не нужны в проде:
- `supabase-studio` — веб-интерфейс БД (только для разработки)
- `supabase-analytics` (Logflare) — аналитика/логи

Освобождается ~300–400 МБ RAM → можно перейти с тарифа 33 ₽/день на 27 ₽/день (2 CPU / 3 ГБ). Экономия ~180 ₽/месяц.

## Важно знать

**Studio и TablePlus — независимы.** TablePlus подключается напрямую к PostgreSQL, Studio тут не участвует. Отключение Studio не влияет на TablePlus.

**Analytics зависимость:** kong (API-шлюз Supabase) имеет `depends_on: analytics`. Нельзя просто удалить analytics — сначала надо убрать эту зависимость у kong в docker-compose.yml.

## Пошаговые команды (SSH на Beget VPS)

### 1. Найти docker-compose
```bash
find /opt -name "docker-compose.yml" 2>/dev/null
# Скорее всего: /opt/supabase/docker/docker-compose.yml
```

### 2. Бэкап
```bash
cp /opt/supabase/docker/docker-compose.yml /opt/supabase/docker/docker-compose.yml.bak
```

### 3. Отключить Studio (безопасно, нет зависимостей)
```bash
cd /opt/supabase/docker
docker compose stop studio
docker compose rm -f studio
```
В docker-compose.yml закомментировать весь блок `studio:`.

### 4. Отключить Analytics (требует правки kong)
В docker-compose.yml в секции `kong:` удалить:
```yaml
    depends_on:
      analytics:
        condition: service_healthy
```
Затем:
```bash
docker compose stop analytics
docker compose rm -f analytics
```
И закомментировать весь блок `analytics:`.

### 5. Применить и проверить
```bash
docker compose up -d
docker ps --format "table {{.Names}}\t{{.Status}}"
curl -I https://crm.samu-rai.ru
```

### Откат (если что-то сломалось)
```bash
cp /opt/supabase/docker/docker-compose.yml.bak /opt/supabase/docker/docker-compose.yml
docker compose up -d
```

## После успешной проверки (1–2 дня)
В панели Beget перейти на тариф **2 CPU / 3 ГБ (27 ₽/день)**.
