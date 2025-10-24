# 🤖 SmartSupport - Интеллектуальный помощник по работе с обращениями

[![Status](https://img.shields.io/badge/status-production-green.svg)](https://smartsupport.vadimevgrafov.ru)
[![Tech Stack](https://img.shields.io/badge/tech-Node.js%20%7C%20React%20%7C%20PostgreSQL-blue.svg)](#-технологический-стек)
[![License](https://img.shields.io/badge/license-Educational-yellow.svg)]()
[![GitLab](https://img.shields.io/badge/GitLab-Repository-orange.svg?logo=gitlab)](https://gitlab.vadimevgrafov.ru/it-sprint/it-support)
[![API Docs](https://img.shields.io/badge/API-Swagger-85EA2D.svg?logo=swagger)](https://api-smartsupport.vadimevgrafov.ru/api-docs)
[![Demo](https://img.shields.io/badge/demo-online-success.svg)](https://smartsupport.vadimevgrafov.ru)

> Интеллектуальная система обработки обращений граждан с использованием искусственного интеллекта для автоматизации и оптимизации процессов работы.

**Разработано командой "Имени товарища Вертера" (КИТВ)** от Школы 21 для участия в кейс-чемпионате Белгородской области в сфере информационных технологий **(ИТ-Спринт 2025)**.

---

## 📋 Содержание

- [О проекте](#-о-проекте)
- [Возможности](#-возможности)
- [Архитектура](#-архитектура)
- [Технологический стек](#-технологический-стек)
- [Структура проекта](#-структура-проекта)
- [Быстрый старт](#-быстрый-старт)
- [Развёртывание](#-развёртывание)
- [Использование](#-использование)
- [API документация](#-api-документация)
- [Безопасность](#-безопасность)
- [Будущее развитие](#-будущее-развитие)
- [Команда](#-команда)

---

## 🎯 О проекте

SmartSupport — это инновационная система обработки обращений граждан, которая использует возможности искусственного интеллекта для:

- **Автоматического анализа** обращений (категория, приоритет, тональность)
- **Интеллектуального поиска** релевантной информации в базе знаний
- **Генерации человекоподобных ответов** для операторов
- **Масштабируемой обработки** обращений в режиме реального времени

### Цель проекта

Создать эффективную систему, которая автоматически анализирует обращения граждан, находит релевантную информацию в базе знаний и предоставляет операторам готовые варианты ответов, значительно ускоряя процесс обработки запросов.

### Статус

**MVP (Minimum Viable Product)** - реализован минимальный функционал для демонстрации основных возможностей системы. Тестовая база знаний содержит 9 статей по различным категориям для демонстрации работы интеллектуального поиска и генерации ответов.

---

## ✨ Возможности

### Для граждан

- 📝 **Простая форма подачи обращений** с автоматической категоризацией
- 💬 **Чат в реальном времени** с операторами (WebSocket)
- 🔍 **Отслеживание статуса** обращения по номеру
- 📱 **Адаптивный интерфейс** для всех устройств

### Для операторов

- 🎯 **Панель управления обращениями** с фильтрацией и сортировкой
- 🤖 **ИИ-подсказки** с готовыми вариантами ответов
- 💬 **Чат-интерфейс** для общения с гражданами
- 📊 **Информация о приоритете и тональности** каждого обращения
- 🔄 **Статусы обращений**: новое → в работе → завершено
- 🚪 **Простая авторизация** (demo / demo)

### Для администраторов

- 📚 **Управление базой знаний** (CRUD операции)
- 🏷️ **Категоризация статей** и управление тегами
- 🔍 **Поиск и фильтрация** статей
- 📊 **Статистика** по статьям
- 🚪 **Защищённый доступ** (admin / admin)

### Интеллектуальные возможности

- 🧠 **ИИ-анализ обращений** (GigaChat API):
  - Определение приоритета (низкий, средний, высокий, критический)
  - Анализ тональности (позитивная, нейтральная, негативная)
  - Автоматическая категоризация
  - Извлечение ключевых слов
  
- 🔍 **Умный поиск в базе знаний**:
  - Поиск по всей БЗ (не ограничен категорией обращения)
  - Ранжирование релевантности (0-100+ баллов)
  - Кросс-категорийный поиск
  - Извлечение релевантных секций

- 🤖 **Генерация человекоподобных ответов**:
  - Персонализация под вопрос гражданина
  - Чистый текст без markdown
  - Профессиональное оформление
  - Контекстные ответы в диалоге

---

## 🏗️ Архитектура

### Общая схема

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Гражданин     │◄────►│   Frontend User   │◄────►│                 │
│                 │      │   (React/Vite)    │      │                 │
└─────────────────┘      └──────────────────┘      │                 │
                                                     │                 │
┌─────────────────┐      ┌──────────────────┐      │                 │
│   Оператор      │◄────►│Frontend Operator │◄────►│   nginx-proxy   │
│                 │      │   (React/Vite)    │      │   (Let's Encrypt)│
└─────────────────┘      └──────────────────┘      │                 │
                                                     │                 │
┌─────────────────┐      ┌──────────────────┐      │                 │
│ Администратор   │◄────►│  Frontend Admin   │◄────►│                 │
│                 │      │   (React/Vite)    │      └────────┬────────┘
└─────────────────┘      └──────────────────┘               │
                                                             │
                         ┌──────────────────┐               │
                         │  Backend API     │◄──────────────┘
                         │ (Node.js/Express)│
                         │  + WebSocket     │
                         └────────┬─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
            ┌───────▼──────┐ ┌───▼────────┐ ┌─▼────────────┐
            │  PostgreSQL  │ │   Redis    │ │  RabbitMQ    │
            │   (База      │ │  (Кэш)     │ │  (Очереди)   │
            │   данных)    │ │            │ │              │
            └──────────────┘ └────────────┘ └──────┬───────┘
                                                    │
                                            ┌───────▼────────┐
                                            │ Celery Workers │
                                            │   (Python)     │
                                            │  + GigaChat API│
                                            └────────────────┘
```

### Компоненты системы

#### Frontend (3 приложения)

1. **User Interface** - Интерфейс для граждан
   - Форма подачи обращений
   - Чат с оператором
   - URL: `https://user-smartsupport.vadimevgrafov.ru`

2. **Operator Panel** - Панель для операторов
   - Управление обращениями
   - Чат с гражданами
   - ИИ-подсказки
   - URL: `https://operator-smartsupport.vadimevgrafov.ru`

3. **Admin Panel** - Панель для администраторов
   - Управление базой знаний
   - CRUD операции со статьями
   - URL: `https://admin-smartsupport.vadimevgrafov.ru`

#### Backend API

- **REST API** для обработки запросов
- **WebSocket** для чата в реальном времени (Socket.io)
- **Авторизация** с JWT токенами
- **Интеграция** с RabbitMQ для асинхронных задач

#### База данных (PostgreSQL)

- **Обращения** (appeals)
- **Пользователи** (users, operators)
- **База знаний** (knowledge_base, categories)
- **Чат** (chat_messages)
- **ИИ ответы** (ai_responses)

#### Очередь задач (RabbitMQ + Celery)

- **Анализ обращений** (analyze_appeal)
- **Генерация ответов** (generate_response)
- **Контекстные ответы** (contextual_response)

#### Кэширование (Redis)

- Сессии пользователей
- Кэширование API запросов

---

## 🛠 Технологический стек

### Frontend

| Технология | Версия | Назначение |
|-----------|--------|------------|
| **React** | 18.x | UI библиотека |
| **TypeScript** | 5.x | Типизация |
| **Vite** | 5.x | Сборщик и dev-сервер |
| **Tailwind CSS** | 3.x | CSS фреймворк |
| **Socket.io Client** | 4.x | WebSocket для чата |
| **React Hot Toast** | 2.x | Уведомления |
| **date-fns** | 3.x | Работа с датами |

### Backend

| Технология | Версия | Назначение |
|-----------|--------|------------|
| **Node.js** | 18.x | Runtime окружение |
| **Express** | 4.x | Web фреймворк |
| **TypeScript** | 5.x | Типизация |
| **Socket.io** | 4.x | WebSocket сервер |
| **JWT** | 9.x | Авторизация |
| **ts-node** | 10.x | Запуск TypeScript |

### Базы данных

| Технология | Версия | Назначение |
|-----------|--------|------------|
| **PostgreSQL** | 15.x | Основная БД |
| **Redis** | 7.x | Кэширование |

### Очереди и воркеры

| Технология | Версия | Назначение |
|-----------|--------|------------|
| **RabbitMQ** | 3.12 | Брокер сообщений |
| **Celery** | 5.x | Асинхронные задачи (Python) |
| **amqplib** | 0.10 | RabbitMQ клиент (Node.js) |

### ИИ и анализ

| Технология | Версия | Назначение |
|-----------|--------|------------|
| **GigaChat API** | - | ИИ анализ и генерация |
| **psycopg2** | 2.9 | PostgreSQL драйвер (Python) |

### DevOps

| Технология | Версия | Назначение |
|-----------|--------|------------|
| **Docker** | 24.x | Контейнеризация |
| **Docker Compose** | 2.x | Оркестрация контейнеров |
| **Nginx** | 1.25 | Reverse proxy |
| **nginx-proxy** | - | Автоматический reverse proxy |
| **acme-companion** | - | Let's Encrypt SSL |

---

## 📁 Структура проекта

```
it-support/
├── backend/                      # Backend API (Node.js/Express)
│   ├── src/
│   │   ├── controllers/          # Контроллеры API
│   │   ├── models/               # Модели данных
│   │   ├── routes/               # Маршруты API
│   │   │   ├── appeals.ts        # Обращения
│   │   │   ├── auth.ts           # Авторизация (demo/demo, admin/admin)
│   │   │   ├── knowledgeBase.ts  # База знаний
│   │   │   └── ...
│   │   ├── services/             # Бизнес-логика
│   │   │   ├── ChatService.ts    # WebSocket чат
│   │   │   ├── RabbitMQService.ts# Очереди задач
│   │   │   └── ...
│   │   ├── validators/           # Валидация данных
│   │   └── index.ts              # Точка входа
│   ├── migrations/               # Миграции БД
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                     # Frontend приложения
│   ├── user/                     # Интерфейс для граждан
│   │   ├── src/
│   │   │   ├── App.tsx           # Главный компонент
│   │   │   ├── components/       # React компоненты
│   │   │   │   └── ChatModal.tsx # Чат с оператором
│   │   │   └── config.ts         # Конфигурация API
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── operator/                 # Панель оператора
│   │   ├── src/
│   │   │   ├── App.tsx           # Главный компонент
│   │   │   ├── components/
│   │   │   │   ├── ChatWindow.tsx    # Чат с гражданином
│   │   │   │   └── LoginForm.tsx     # Форма входа
│   │   │   └── config.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── admin/                    # Панель администратора
│       ├── src/
│       │   ├── App.tsx           # Управление БЗ
│       │   ├── components/
│       │   │   └── LoginForm.tsx # Форма входа
│       │   └── config.ts
│       ├── Dockerfile
│       └── package.json
│
├── workers/                      # Celery воркеры (Python)
│   ├── celery_app.py             # Celery приложение
│   ├── tasks/
│   │   ├── analyze_appeal.py    # Анализ обращений
│   │   ├── generate_response.py # Генерация ответов
│   │   └── contextual_response.py# Контекстные ответы
│   ├── Dockerfile
│   └── requirements.txt
│
├── landing/                      # Landing страница
│   ├── index.html                # HTML
│   ├── Dockerfile
│   └── README.md
│
├── database/                     # База данных
│   ├── init/
│   │   └── 01-init.sql           # Инициализация схемы
│   └── migrations/               # SQL миграции
│
├── knowledge_base/               # База знаний
│   └── manual/                   # Markdown статьи
│       ├── heating.md            # Теплоснабжение
│       ├── water.md              # Водоснабжение
│       └── ...
│
├── nginx-configs/                # Nginx конфигурации
│   ├── user-smartsupport.vadimevgrafov.ru.conf
│   ├── operator-smartsupport.vadimevgrafov.ru.conf
│   ├── admin-smartsupport.vadimevgrafov.ru.conf
│   └── smartsupport.vadimevgrafov.ru.conf
│
├── scripts/                      # Утилиты
│   └── import-kb.py              # Импорт статей в БД
│
├── docker-compose.production.yml # Production конфигурация
├── deploy-landing.sh             # Скрипт деплоя landing
├── TESTING_REPORT.md             # Отчёт о тестировании
└── README.md                     # Этот файл
```

---

## 🚀 Быстрый старт

### Предварительные требования

- Docker и Docker Compose
- Git
- Доступ к серверу (опционально)

### Локальная разработка

1. **Клонирование репозитория:**

```bash
git clone <repository-url>
cd it-support
```

2. **Настройка переменных окружения:**

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend User
cp frontend/user/.env.production.example frontend/user/.env.production

# Frontend Operator
cp frontend/operator/.env.production.example frontend/operator/.env.production

# Frontend Admin
cp frontend/admin/.env.production.example frontend/admin/.env.production
```

3. **Запуск с Docker Compose:**

```bash
# Production режим
docker-compose -f docker-compose.production.yml up -d

# Просмотр логов
docker-compose -f docker-compose.production.yml logs -f

# Остановка
docker-compose -f docker-compose.production.yml down
```

4. **Проверка статуса:**

```bash
docker ps
```

### Доступ к интерфейсам

После запуска системы доступны следующие интерфейсы:

- **Landing:** https://smartsupport.vadimevgrafov.ru
- **User Interface:** https://user-smartsupport.vadimevgrafov.ru
- **Operator Panel:** https://operator-smartsupport.vadimevgrafov.ru
- **Admin Panel:** https://admin-smartsupport.vadimevgrafov.ru
- **Backend API:** https://api-smartsupport.vadimevgrafov.ru

---

## 📦 Развёртывание

### Production окружение

Система развёрнута на сервере с использованием Docker и nginx-proxy для автоматического HTTPS.

#### Компоненты

```bash
# Backend
docker-compose -f docker-compose.production.yml up -d backend

# Frontends
docker-compose -f docker-compose.production.yml up -d \
  frontend-user operator-frontend admin-frontend

# Workers
docker-compose -f docker-compose.production.yml up -d celery-worker

# Landing
./deploy-landing.sh
```

#### Мониторинг

```bash
# Статус всех контейнеров
docker ps

# Логи конкретного сервиса
docker logs smart-support-backend -f
docker logs smart-support-celery-worker -f

# Health checks
curl https://api-smartsupport.vadimevgrafov.ru/health
curl https://smartsupport.vadimevgrafov.ru/health
```

---

## 💡 Использование

### Для граждан

1. Откройте https://user-smartsupport.vadimevgrafov.ru
2. Заполните форму обращения:
   - ФИО
   - Телефон
   - Email (опционально)
   - Категория (выбор из списка)
   - Описание проблемы
3. Нажмите "Отправить обращение"
4. Автоматически открывается чат с оператором
5. Вы можете продолжать диалог в чате

### Для операторов

1. Откройте https://operator-smartsupport.vadimevgrafov.ru
2. Войдите в систему:
   - Логин: `demo`
   - Пароль: `demo`
3. Выберите обращение из списка
4. Нажмите "Открыть чат"
5. Используйте ИИ-подсказку или напишите свой ответ
6. После решения вопроса нажмите "Завершить обращение"

### Для администраторов

1. Откройте https://admin-smartsupport.vadimevgrafov.ru
2. Войдите в систему:
   - Логин: `admin`
   - Пароль: `admin`
3. Управляйте статьями базы знаний:
   - Создание новых статей
   - Редактирование существующих
   - Удаление статей
   - Управление категориями

---

## 📚 API документация

### Основные endpoints

#### Обращения

```http
# Создать обращение
POST /api/appeals
Content-Type: application/json

{
  "full_name": "Иванов Иван Иванович",
  "phone": "+79991234567",
  "email": "ivanov@test.ru",
  "subject": "Теплоснабжение",
  "description": "В квартире холодно"
}

# Получить список обращений
GET /api/appeals?status=new&limit=20

# Получить обращение по ID
GET /api/appeals/:id

# Обновить статус обращения
PATCH /api/appeals/:id
Content-Type: application/json

{
  "status": "in_progress" | "resolved"
}

# Получить ИИ ответ для обращения
GET /api/appeals/:id/ai-response
```

#### Авторизация

```http
# Вход в систему
POST /api/auth/demo-login
Content-Type: application/json

{
  "username": "demo",
  "password": "demo"
}

# Ответ
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": {
      "username": "demo",
      "role": "operator",
      "name": "Демо Оператор"
    }
  }
}

# Проверка токена
POST /api/auth/verify
Authorization: Bearer <token>
```

#### База знаний

```http
# Получить все статьи
GET /api/knowledge-base

# Получить статью по ID
GET /api/knowledge-base/:id

# Создать статью (требуется авторизация)
POST /api/knowledge-base
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "title": "Заголовок",
  "content": "Содержание",
  "category_id": "uuid",
  "tags": ["тег1", "тег2"],
  "is_active": true
}

# Обновить статью
PUT /api/knowledge-base/:id

# Удалить статью
DELETE /api/knowledge-base/:id
```

#### WebSocket (Chat)

```javascript
// Подключение
const socket = io('https://api-smartsupport.vadimevgrafov.ru');

// Присоединиться к комнате обращения
socket.emit('join-appeal', { appealId, userId, userType });

// Отправить сообщение
socket.emit('send-message', {
  appealId,
  senderId,
  senderType: 'citizen' | 'operator',
  message: 'Текст сообщения'
});

// Получить сообщение
socket.on('new-message', (data) => {
  console.log('New message:', data);
});

// Уведомление о новом обращении
socket.on('new-appeal', (data) => {
  console.log('New appeal:', data);
});
```

---

## 🔒 Безопасность

### Авторизация

Система использует простую авторизацию для демонстрации:

**Учётные данные:**
- Оператор: `demo` / `demo`
- Администратор: `admin` / `admin`

**Механизм:**
- JWT токены со сроком действия 24 часа
- Разделение ролей (operator/admin)
- Проверка токена на каждой загрузке
- Автоматический выход при невалидном токене

### Защита данных

- ✅ HTTPS для всех подключений (Let's Encrypt)
- ✅ CORS настроен только для разрешённых доменов
- ✅ Rate limiting на API endpoints
- ✅ Валидация всех входных данных
- ✅ SQL injection защита (prepared statements)
- ✅ XSS защита (Content Security Policy)

### Рекомендации для production

⚠️ **Важно:** Текущая реализация авторизации предназначена только для демонстрации!

Для реального использования необходимо:
1. Использовать базу данных для хранения пользователей
2. Хэшировать пароли (bcrypt)
3. Добавить 2FA
4. Реализовать сброс пароля
5. Логировать попытки входа
6. Настроить мониторинг безопасности

---

## 🔮 Будущее развитие

### Планы команды

#### Мультиагентная система

Команда видит проект как мультиагентную систему, которая:
- Работает максимально автоматизированно
- Функционирует без участия оператора
- Эскалирует запросы только при отсутствии информации в БЗ

#### Векторное представление знаний

Планируется:
- Представление базы знаний в векторном виде
- Гибридный поиск (keyword + semantic)
- Использование embedding моделей
- Значительное улучшение качества поиска

#### Аналитика и обучение

Внедрение:
- Аналитика для пополнения БЗ
- Актуализация базы знаний
- Обучение на основе обработанных обращений
- Автоматическое улучшение ответов

### Коммерческое применение

Полностью реализованная система может использоваться:

**Основные клиенты:**
- 🏢 Управляющие компании
- 🔧 Коммунальные службы
- 🏬 Торговые центры
- 📦 Предприятия мелкооптовой торговли

**Преимущества:**
- ⏰ 24/7 доступность
- 📈 Масштабируемость
- 📊 Аналитика обращений
- 🤖 Автоматизация процессов
- 💰 Снижение нагрузки на операторов

---

## 👥 Команда

**"Имени товарища Вертера" (КИТВ)**

- Школа 21
- Кейс-чемпионат Белгородской области
- ИТ-Спринт 2025

---

## 📄 Лицензия

Проект создан в рамках образовательного кейс-чемпионата.  
Все права защищены.

---

## 📞 Контакты

- **Landing:** https://smartsupport.vadimevgrafov.ru
- **Репозиторий:** `ssh://gitlab.vadimevgrafov.ru:2224/it-sprint/it-support.git`

---

## 📊 Статистика проекта

- **Технологий:** 20+
- **Микросервисов:** 10
- **Строк кода:** 15,000+
- **Время разработки:** 2 недели
- **Статус:** Production Ready ✅

---

**SmartSupport** - Интеллектуальный помощник по работе с обращениями граждан 🤖

*Разработано с ❤️ командой КИТВ для ИТ-Спринт 2025*