# 🚀 Multi-SaaS CRM Platform

## 📋 О проекте

Современная микросервисная CRM платформа с поддержкой multi-tenancy, системой плагинов и полным стеком интеграций. Базируется на архитектуре, вдохновленной Salesforce, но с более гибкой и расширяемой структурой.

## 🏗️ Архитектура

### 🌐 Микросервисная архитектура

```
Frontend (Next.js) :3000
        ↓
API Gateway :3001
        ↓
┌─────────────────────────────────────────────────────────────┐
│ CRM     │ Plugin  │ ERP     │ Marketing │ Custom  │ OAuth2  │
│ Backend │ System  │ Service │ Service   │ Fields  │ Service │
│ :8000   │ :8008   │ :8006   │ :8007     │ :8009   │ :8010   │
└─────────────────────────────────────────────────────────────┘
        ↓
PostgreSQL :5432 │ Redis :6379 │ Elasticsearch :9200
```

### 🔧 Технологический стек

**Backend:**
- Python 3.11+ (FastAPI)
- Node.js 18+ (TypeScript)
- PostgreSQL 15+ с Row Level Security
- Redis для кеширования
- Elasticsearch для поиска
- Kafka для event-driven архитектуры

**Frontend:**
- Next.js 14 с App Router
- TypeScript
- Tailwind CSS + shadcn/ui
- Zustand для state management

**DevOps:**
- Docker + Docker Compose
- Kubernetes поддержка
- GitHub Actions CI/CD
- Prometheus + Grafana мониторинг

## 🚀 Быстрый старт

### Автоматический запуск (рекомендуется)

**Windows:**
```cmd
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

### Ручной запуск

```bash
# Клонирование репозитория
git clone <repository-url>
cd crm-project

# Запуск всей системы
docker-compose up --build -d

# Запуск минимальной версии (только CRM)
docker-compose -f docker-compose.simple.yml up --build -d

# Запуск микросервисов
docker-compose -f docker-compose.microservices.yml up --build -d
```

## 🐳 Docker команды

```bash
# Запуск всей системы
docker-compose up --build -d

# Запуск минимальной версии (только CRM)
docker-compose -f docker-compose.simple.yml up --build -d

# Запуск микросервисов
docker-compose -f docker-compose.microservices.yml up --build -d

# Остановка всех сервисов
docker-compose down

# Просмотр логов
docker-compose logs -f [service_name]

# Перезапуск конкретного сервиса
docker-compose restart [service_name]
```

## 💻 Разработка

### Frontend разработка
```bash
cd frontend
npm install
npm run dev
```

### Backend разработка
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Микросервисы разработка

**API Gateway:**
```bash
cd api-gateway
npm install
npm run dev
```

**Custom Fields Service:**
```bash
cd custom-fields-service
npm install
npm run dev
```

**OAuth2 Service:**
```bash
cd oauth2-service
npm install
npm run dev
```

**Workflow Engine:**
```bash
cd workflow-engine
npm install
npm run dev
```

## 🧪 Тестирование

```bash
# Тестирование всей системы
node test-full-integration-v2.js

# Тестирование CRM
node test-crm-integration.js

# Тестирование Custom Fields
node test-custom-fields.js

# Тестирование маршрутизации
node test-routing.js

# Тестирование сервисов
node test-services.js
```

## 🌐 Endpoints

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:3001
- **CRM Backend**: http://localhost:8000
- **Custom Fields Service**: http://localhost:8009
- **OAuth2 Service**: http://localhost:8010
- **Plugin System**: http://localhost:8008
- **Workflow Engine**: http://localhost:8011
- **ERP Service**: http://localhost:8006
- **Marketing Service**: http://localhost:8007

## 📁 Структура проекта

```
crm-project/
├── frontend/                 # Next.js фронтенд
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   ├── components/      # React компоненты
│   │   ├── lib/             # Утилиты и API
│   │   └── contexts/        # React контексты
│   └── package.json
├── backend/                  # Python FastAPI бэкенд
│   ├── app/
│   │   ├── api/             # API endpoints
│   │   ├── core/            # Конфигурация
│   │   ├── models/          # SQLAlchemy модели
│   │   ├── services/        # Бизнес логика
│   │   └── schemas/         # Pydantic схемы
│   └── requirements.txt
├── api-gateway/              # API Gateway (Node.js)
│   ├── src/
│   │   ├── routes/          # Маршрутизация
│   │   ├── middleware/      # Middleware
│   │   └── services/        # Сервисы
│   └── package.json
├── custom-fields-service/    # Сервис кастомных полей
├── oauth2-service/           # OAuth2 сервис
├── plugins-system/           # Система плагинов
├── workflow-engine/          # Workflow движок
├── infrastructure/           # Инфраструктура
│   ├── docker/              # Docker конфигурации
│   └── monitoring/          # Prometheus + Grafana
└── docker-compose.yml
```

## 📊 Статус разработки

### ✅ Завершено (100%)
- **Базовая CRM система** - полная функциональность
- **Multi-tenancy** - система арендаторов
- **Аутентификация** - JWT + email верификация
- **Контакты** - CRUD + поиск + фильтрация
- **Компании** - полный функционал
- **Сделки** - канбан + воронка + статистика
- **Dashboard** - базовая аналитика
- **Frontend** - современный UI на Next.js

### 🚧 В разработке
- **API Gateway** (90%) - маршрутизация и безопасность
- **Plugin System** (85%) - marketplace и sandbox
- **Custom Fields Service** (80%) - кастомные поля
- **OAuth2 Service** (60%) - внешние интеграции
- **Workflow Engine** (40%) - автоматизация процессов

### 📝 Планируется
- **ERP Service** - финансы и склад
- **Marketing Service** - кампании и рассылки
- **Analytics Service** - углубленная аналитика
- **Real-time функции** - WebSocket уведомления
- **Визуальные конструкторы** - drag-and-drop интерфейсы

## 🔧 Конфигурация

### Переменные окружения

Создайте файл `.env` в корне проекта:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/crm_db
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# External Services
STRIPE_SECRET_KEY=sk_test_...
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## 🛠️ Установка зависимостей

После клонирования проекта установите зависимости:

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install

# Микросервисы
cd api-gateway && npm install
cd custom-fields-service && npm install
cd oauth2-service && npm install
cd plugins-system && npm install
cd workflow-engine && npm install
```

## 📚 Документация

- **API Documentation**: http://localhost:8000/docs (Swagger)
- **Plugin Development**: [plugins-system/PLUGIN_DEVELOPMENT.md](plugins-system/PLUGIN_DEVELOPMENT.md)
- **Progress Tracking**: [PROGRESS.md](PROGRESS.md)
- **Features Completed**: [FEATURES_COMPLETED.md](FEATURES_COMPLETED.md)

## 🔒 Безопасность

- JWT токены с автоматическим обновлением
- Row Level Security в PostgreSQL
- Rate limiting на API Gateway
- Sandbox окружение для плагинов
- Валидация всех входящих данных

## 🌍 Интеграции

### Готовые интеграции:
- Email (SMTP/IMAP)
- OAuth2 провайдеры (Google, Microsoft)
- Webhook система

### Планируемые интеграции:
- Мессенджеры (Slack, Teams, WhatsApp, Telegram)
- Платежные системы (Stripe, PayPal)
- Календари (Google Calendar, Outlook)
- Файловые хранилища (Google Drive, Dropbox)
- Телефония (Twilio)

## 🤝 Участие в разработке

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Создайте Pull Request

## 📄 Лицензия

MIT License

## 📞 Поддержка

Если у вас возникли вопросы или проблемы, создайте issue в репозитории.

---

**Статус проекта:** Активная разработка  
**Последнее обновление:** 2024  
**Версия:** 1.0.0-beta