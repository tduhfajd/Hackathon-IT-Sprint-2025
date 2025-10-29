# 📊 Мониторинг Smart Support

## ✅ Установлено и настроено

Система мониторинга на базе **Prometheus + Grafana** с уведомлениями в **Telegram**.

### 🛠️ Компоненты:

1. **Prometheus** - сбор метрик
   - URL: https://prometheus.vadimevgrafov.ru
   - Порт: 9090 (внутри Docker сети)

2. **Grafana** - визуализация и алерты
   - URL: https://grafana.vadimevgrafov.ru
   - Логин: `admin` / Пароль: `admin`
   - ⚠️ Рекомендуется сменить пароль!

3. **Node Exporter** - метрики системы
   - CPU, RAM, Disk, Network

4. **cAdvisor** - метрики Docker контейнеров
   - Статус контейнеров, использование ресурсов

---

## 📦 Мониторируемые контейнеры

Всего мониторится **10 контейнеров** Smart Support:

| № | Контейнер | Назначение | Healthcheck |
|---|-----------|------------|-------------|
| 1 | `smart-support-backend` | Node.js API сервер | ✅ Yes |
| 2 | `smart-support-db` | PostgreSQL база данных | ✅ Yes |
| 3 | `smart-support-redis` | Redis кэш | ✅ Yes |
| 4 | `smart-support-rabbitmq` | RabbitMQ очередь задач | ✅ Yes |
| 5 | `smart-support-celery-worker` | Celery worker для AI | ❌ No |
| 6 | `smart-support-celery-beat` | Celery beat планировщик | ❌ No |
| 7 | `smart-support-frontend-user` | Форма для граждан | ✅ Yes |
| 8 | `smart-support-frontend-operator` | Панель оператора | ✅ Yes |
| 9 | `smart-support-frontend-admin` | Админ-панель | ✅ Yes |
| 10 | `smart-support-landing` | Лендинг | ✅ Yes |

**Проверка статуса:**
```bash
docker ps --filter "name=smart-support" --format "{{.Names}}: {{.Status}}"
```

---

## 🚨 Активные алерты (4 шт.)

### 🔴 Критичные алерты:

1. **Smart Support Container Down** ⭐
   - **Мониторит:** ВСЕ 10 контейнеров Smart Support (см. таблицу выше)
   - **Условие:** Если хотя бы 1 контейнер остановлен более 3 минут
   - **PromQL:** `count(container_last_seen{name=~"smart-support.*"} > (time() - 120)) < 10`
   - **Задержка:** 3 минуты
   - **Действие:** 
     ```bash
     # Проверить статус
     docker ps -a | grep smart-support
     # Логи упавшего контейнера
     docker logs <container_name> --tail 50
     # Перезапуск
     docker restart <container_name>
     ```

2. **Critical Disk Usage**
   - **Условие:** Диск заполнен > 90%
   - **Задержка:** 1 минута
   - **Действие:** Срочно освободите место
     ```bash
     # Проверить использование
     df -h
     # Очистить Docker
     docker system prune -af --volumes
     # Очистить логи
     sudo journalctl --vacuum-time=3d
     ```

### 🟡 Предупреждающие алерты:

3. **High CPU Usage**
   - **Условие:** CPU > 80% в течение 5 минут
   - **Действие:** 
     ```bash
     htop
     docker stats
     # Проверить нагрузку по контейнерам
     ```

4. **High Memory Usage**
   - **Условие:** RAM > 85% в течение 5 минут
   - **Действие:** 
     ```bash
     free -h
     docker stats
     # При необходимости перезапустить контейнеры
     docker restart <container_name>
     ```

---

## 📱 Telegram уведомления

- **Бот:** @smart_support_altrts_bot
- **Chat ID:** 242942609
- Все алерты отправляются автоматически в Telegram

### Формат уведомлений:

#### 🔴 [FIRING] - Проблема обнаружена
```
🔴 [FIRING] Smart Support Container Down
Один или несколько контейнеров Smart Support остановлены!
Проверьте 'docker ps -a | grep smart-support'
```
**Что делать:** Проверьте систему и устраните проблему

#### 🟢 [RESOLVED] - Проблема решена
```
🟢 [RESOLVED] Smart Support Container Down
Все контейнеры Smart Support работают
```
**Что это значит:** Система вернулась в норму, действий не требуется

### ⚠️ Ложные срабатывания

Иногда возможны краткосрочные ложные алерты из-за:
- Временного сбоя сбора метрик (< 2 минут)
- Перезапуска Prometheus/cAdvisor
- Сетевых задержек

**Если получили [FIRING], а затем сразу [RESOLVED]** — это нормально, алерт был ложным. Все контейнеры работают.

---

## 🎯 Как использовать

### 1. Просмотр метрик в Grafana:
1. Откройте https://grafana.vadimevgrafov.ru
2. Войдите: `admin` / `admin`
3. Перейдите в **Alerting → Alert rules**
4. Создайте дашборды с графиками (CPU, RAM, Docker контейнеры)

### 2. Просмотр алертов:
- **Grafana:** https://grafana.vadimevgrafov.ru/alerting/list
- **Telegram:** автоматически приходят уведомления

### 3. Добавление новых алертов:

**Через Grafana UI:**
1. Alerting → Alert rules → New alert rule
2. Выберите Prometheus как data source
3. Напишите PromQL запрос
4. Настройте условия и Telegram contact point

**Через API (пример):**
```bash
curl -X POST -H "Content-Type: application/json" \
  -u admin:admin \
  -d '{
    "uid": "my_alert",
    "title": "My Alert",
    "condition": "A",
    "data": [{
      "refId": "A",
      "datasourceUid": "<DS_UID>",
      "model": {
        "expr": "up{job=\"prometheus\"} == 0"
      }
    }],
    "for": "1m"
  }' \
  https://grafana.vadimevgrafov.ru/api/v1/provisioning/alert-rules
```

---

## 🔧 Управление

### Перезапуск мониторинга:
```bash
cd /srv/monitoring
echo 'zdvivw7h' | sudo -S docker-compose restart
```

### Просмотр логов:
```bash
docker logs prometheus
docker logs grafana
docker logs node-exporter
docker logs cadvisor
```

### Проверка метрик:
```bash
# Все targets
curl -s http://localhost:9090/api/v1/targets | jq

# Метрики CPU
docker exec prometheus wget -q -O- \
  'http://localhost:9090/api/v1/query?query=node_cpu_seconds_total'
```

---

## 📊 Полезные PromQL запросы

### Использование CPU:
```promql
100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

### Использование RAM:
```promql
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
```

### Использование Disk:
```promql
(1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes)) * 100
```

### Статус контейнеров:
```promql
container_last_seen{name=~"smart-support.*"}
```

### Количество запущенных контейнеров Smart Support:
```promql
count(container_last_seen{name=~"smart-support.*"} > (time() - 120))
```
**Должно быть:** 10

### Docker контейнеры (CPU):
```promql
rate(container_cpu_usage_seconds_total{name=~"smart-support.*"}[5m]) * 100
```

### Docker контейнеры (Memory):
```promql
container_memory_usage_bytes{name=~"smart-support.*"} / 1024 / 1024
```

---

## 🎨 Рекомендуемые дашборды Grafana

Импортируйте готовые дашборды:

1. **Node Exporter Full** - ID: `1860`
   - Полная информация о системе

2. **Docker Container & Host Metrics** - ID: `179`
   - Метрики Docker контейнеров

3. **Prometheus 2.0 Stats** - ID: `3662`
   - Статистика Prometheus

**Как импортировать:**
1. Grafana → Dashboards → Import
2. Введите ID дашборда
3. Выберите Prometheus data source
4. Load

---

## 🛡️ Безопасность

⚠️ **Важно:**
- Смените пароль Grafana: `admin` → Settings → Change Password
- Telegram бот токен хранится в `/tmp/setup_grafana_alerts.sh`
- Prometheus и Grafana доступны через HTTPS с Let's Encrypt

---

## 📞 Troubleshooting

### Алерты не приходят в Telegram:

1. Проверьте contact point:
```bash
docker exec grafana curl -s -u admin:admin \
  http://localhost:3000/api/v1/provisioning/contact-points
```

2. Отправьте тестовое сообщение:
```bash
curl -X POST \
  "https://api.telegram.org/bot8317768797:AAGmZF1pblCmTl8huo1mlT_6vzq_NESfrV8/sendMessage" \
  -d "chat_id=242942609" \
  -d "text=Test"
```

### Prometheus не собирает метрики:

```bash
docker exec prometheus wget -q -O- http://localhost:9090/api/v1/targets
```

Если target `down` → проверьте сеть:
```bash
docker network inspect nginx-net
```

### Grafana не запускается:

```bash
docker logs grafana --tail 50
echo 'zdvivw7h' | sudo -S chown -R 472:472 /srv/monitoring/grafana
docker restart grafana
```

---

## 📁 Файлы конфигурации

- **Docker Compose:** `/srv/monitoring/docker-compose.yml`
- **Prometheus:** `/srv/monitoring/prometheus/config/prometheus.yml`
- **Grafana Data:** `/srv/monitoring/grafana/`

---

## 🚀 Дальнейшие улучшения

1. **Добавить PostgreSQL exporter** для мониторинга БД
2. **Настроить RabbitMQ monitoring** для очередей Celery
3. **Создать дашборды** для Smart Support метрик
4. **Добавить retention policy** для экономии места (по умолчанию 15 дней)
5. **Настроить backup** Grafana дашбордов

---

## 📝 История изменений

### Версия 1.1 (2025-10-29)
- ✅ Улучшен алерт "Smart Support Container Down"
  - Теперь мониторит все 10 контейнеров (было: только backend)
  - Увеличена задержка: 2 → 3 минуты
  - Улучшено условие проверки активности контейнеров
  - Минимизированы ложные срабатывания
- ✅ Добавлено объяснение формата уведомлений [FIRING] и [RESOLVED]
- ✅ Добавлены PromQL запросы для мониторинга контейнеров
- ✅ Добавлен раздел о ложных срабатываниях

### Версия 1.0 (2025-10-29)
- ✅ Установлены Prometheus, Grafana, Node Exporter, cAdvisor
- ✅ Настроены Telegram уведомления
- ✅ Созданы базовые алерты (CPU, RAM, Disk, Backend)

---

**Дата последнего обновления:** 2025-10-29  
**Версия:** 1.1

