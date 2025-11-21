# 02 — Архитектура и потоки данных

Система построена как набор сервисов, связанных через HTTP, WebSocket и очередь RabbitMQ. Центральная логика живёт в Node.js backend, а долгие AI-задачи выполняют Celery workers на Python.

## 🧱 Основные компоненты

| Компонент | Технологии | Что делает |
| --- | --- | --- |
| Frontend (user/operator/admin) | React + TypeScript + Vite + Tailwind (`frontend/`) | Предоставляет три отдельных SPA, общающихся с API и WebSocket. |
| Backend API | Node.js 18, Express, Socket.io (`backend/src`) | REST API, авторизация, бизнес-логика обращений, WebSocket-канал для чатов и статусов. |
| Telegram Bot | node-telegram-bot-api (входит в backend) | Принимает обращения и сообщения из Telegram, синхронизирует их с системой. |
| Celery workers | Python 3, Celery, aiohttp (`workers/`) | Выполняют AI-анализ и генерацию ответов через GigaChat. |
| Очередь сообщений | RabbitMQ | Развязывает backend и workers, гарантирует доставку задач AI. |
| Хранилища | PostgreSQL 15, Redis 7 | PostgreSQL хранит основную модель данных; Redis служит кэшем и для сессий. |
| Гейтвей | Nginx (+ Let's Encrypt) | Маршрутизирует трафик к фронту/бекенду, терминирует SSL. |

Более детальная диаграмма находится в [ARCHITECTURE.md](../ARCHITECTURE.md). Ниже приведена визуализация взаимодействия основных сервисов.

```mermaid
flowchart LR
    Citizen[[Web / Telegram]]
    FrontUser[Frontend User]
    FrontOperator[Frontend Operator]
    FrontAdmin[Frontend Admin]
    Backend[Backend API + Socket.io + Telegram Bot]
    Rabbit[(RabbitMQ)]
    Celery[Celery AI Workers]
    GigaChat[[GigaChat API]]
    Postgres[(PostgreSQL)]
    Redis[(Redis)]
    KB[(Knowledge Base)]
    Nginx[Nginx / SSL]

    Citizen -->|HTTP/WebSocket| FrontUser
    Citizen -->|Telegram| Backend
    FrontUser -->|REST/WebSocket| Backend
    FrontOperator -->|REST/WebSocket| Backend
    FrontAdmin -->|REST| Backend
    Nginx --> Backend
    Backend --> Postgres
    Backend --> Redis
    Backend --> Rabbit
    Backend --> KB
    Rabbit --> Celery
    Celery --> GigaChat
    Celery --> Postgres
    Celery --> KB
```

## 🔁 Путь обращения

```
Web/Telegram → Backend API → PostgreSQL
              ↘ RabbitMQ → Celery → GigaChat → PostgreSQL
Backend → Socket.io → Frontend операторов (обновления в реальном времени)
```

1. **Создание**: гражданин отправляет форму → `/api/appeals` сохраняет данные и публикует задание `tasks.analyze_appeal`.
2. **AI-анализ**: worker обрабатывает запрос, обращается к GigaChat и обновляет `appeal_analysis` + подбирает статьи из `knowledge_base`.
3. **Оповещение**: backend пушит новые данные операторам через Socket.io и отображает подсказки.
4. **Ответ**: оператор редактирует AI-черновик → `POST /api/appeals/:id/responses` → сообщение уходит гражданину (WebSocket или Telegram).
5. **Автоматическое закрытие**: job следит за неактивными обращениями и меняет статус на `Завершено`.

```mermaid
sequenceDiagram
    participant Citizen as Citizen/Telegram
    participant Front as Frontend
    participant Backend as Backend API
    participant Rabbit as RabbitMQ
    participant Worker as Celery AI Worker
    participant Giga as GigaChat
    participant DB as PostgreSQL
    participant Operator as Operator UI

    Citizen->>Front: Создать обращение
    Front->>Backend: POST /api/appeals
    Backend->>DB: Сохранить обращение
    Backend->>Rabbit: Задача analyze_appeal
    Rabbit-->>Worker: Получить задачу
    Worker->>Giga: Запрос анализа
    Giga-->>Worker: Результаты
    Worker->>DB: Сохранить анализ/ответ
    Backend-->>Operator: Socket.io событие appeal.updated
    Operator->>Backend: POST /api/appeals/:id/responses
    Backend->>DB: Сохранить ответ
    Backend-->>Citizen: Уведомление через WebSocket/Telegram
```

## ⚙️ Сервисы и контейнеры

В `docker-compose.yml` описаны основные контейнеры: postgres, redis, rabbitmq, backend, три фронта, nginx, celery-worker, celery-beat, telegram-бот (как часть backend). Стандартный запуск поднимает 11 контейнеров (см. [QUICKSTART.md](../QUICKSTART.md)).

## 🔐 Интеграция с GigaChat

- Креды хранятся в `gigachat-config.json` (локально) или переменных окружения.
- Backend отправляет payloadы workers через RabbitMQ, чтобы не блокировать запросы.
- Подробную настройку см. в [GIGACHAT_SETUP.md](../GIGACHAT_SETUP.md) и `workers/gigachat_client.py`.

## 📡 Мониторинг и журналы

- Логи контейнеров доступны через `docker logs` или `docker-compose logs`.
- RabbitMQ имеет web-интерфейс (`rabbitmq-smartsupport.vadimevgrafov.ru`).
- Дополнительные инструменты описаны в [MONITORING.md](../MONITORING.md).
