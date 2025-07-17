# Multi-SaaS API Gateway

API Gateway для микросервисной архитектуры Multi-SaaS платформы.

## Возможности

- **Маршрутизация запросов** к микросервисам
- **Аутентификация и авторизация** через JWT
- **Multi-tenant поддержка** с изоляцией данных
- **Rate limiting** для защиты от DDoS
- **Логирование** всех запросов
- **Health checks** для мониторинга микросервисов
- **Error handling** с детальным логированием
- **CORS** поддержка
- **Security headers** через Helmet

## Архитектура

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │────│ API Gateway │────│   Services  │
│             │    │             │    │             │
│ Frontend    │    │ Port 3001   │    │ Auth: 8000  │
│ Mobile App  │    │             │    │ CRM: 8000   │
│ External    │    │ Middleware: │    │ ERP: 8001   │
│ API         │    │ - Auth      │    │ Marketing   │
│             │    │ - Tenant    │    │ Plugins     │
│             │    │ - Logging   │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Быстрый старт

### Разработка

```bash
# Установить зависимости
npm install

# Создать .env файл
cp .env.example .env

# Запустить в режиме разработки
npm run dev
```

### Продакшн

```bash
# Собрать проект
npm run build

# Запустить
npm start
```

### Docker

```bash
# Собрать и запустить
docker-compose up -d

# Проверить логи
docker-compose logs -f api-gateway
```

## Конфигурация

### Переменные окружения

```env
# API Gateway
NODE_ENV=development
PORT=3001

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Services
AUTH_SERVICE_URL=http://localhost:8000
USERS_SERVICE_URL=http://localhost:8000
...
```

### Регистрация новых сервисов

```typescript
// В src/config/index.ts
services: {
  newService: {
    url: process.env.NEW_SERVICE_URL || 'http://localhost:8004',
    timeout: 30000,
  },
}

// В src/index.ts
app.use('/api/v1/new-service', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.getService('newService').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/new-service': '/api/v1',
  },
}));
```

## API Endpoints

### Health Check

```bash
GET /health                 # Базовый health check
GET /health/detailed       # Детальный health check с статусом сервисов
GET /health/service/:name  # Health check конкретного сервиса
```

### Proxy Routes

```bash
# Аутентификация (без middleware)
POST /api/v1/auth/login
POST /api/v1/auth/register

# Защищенные роуты (с auth middleware)
GET /api/v1/users/me
GET /api/v1/contacts
GET /api/v1/companies
GET /api/v1/opportunities
GET /api/v1/dashboard
GET /api/v1/erp/*
GET /api/v1/marketing/*
GET /api/v1/plugins/*
```

## Middleware

### Auth Middleware

Проверяет JWT токен и добавляет headers:
- `x-user-id`
- `x-user-email`
- `x-tenant-id`
- `x-user-role`

### Tenant Middleware

Обрабатывает multi-tenant контекст:
- `x-tenant-id`
- `x-tenant-name`
- `x-tenant-status`

### Logging Middleware

Логирует все запросы с:
- Unique request ID
- Время выполнения
- Пользователь и tenant
- Статус ответа

## Мониторинг

### Health Checks

API Gateway автоматически проверяет здоровье всех зарегистрированных сервисов каждые 30 секунд.

### Логирование

- Console logs для разработки
- File logs для продакшна
- Structured JSON логи
- Request/Response трекинг

### Метрики

```bash
# Проверить статус всех сервисов
curl http://localhost:3001/health/detailed

# Проверить конкретный сервис
curl http://localhost:3001/health/service/auth
```

## Безопасность

- **JWT** аутентификация
- **Rate limiting** (1000 req/15min)
- **CORS** настройка
- **Security headers** через Helmet
- **Request validation**
- **Error sanitization**

## Масштабирование

API Gateway может быть легко масштабирован:
- Horizontal scaling через load balancer
- Stateless архитектура
- Redis для shared state
- Health checks для service discovery

## Развертывание

### Kubernetes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: multi-saas/api-gateway:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
```

### Docker Swarm

```yaml
# docker-stack.yml
version: '3.8'
services:
  api-gateway:
    image: multi-saas/api-gateway:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
    secrets:
      - jwt_secret
```

## Разработка

### Добавление нового middleware

```typescript
// src/middleware/newMiddleware.ts
import { Request, Response, NextFunction } from 'express';

export const newMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Логика middleware
  next();
};

// В src/index.ts
app.use(newMiddleware);
```

### Добавление нового роута

```typescript
// src/routes/newRoute.ts
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'New route' });
});

export const newRoute = router;

// В src/index.ts
app.use('/api/v1/new-route', newRoute);
```

## Тестирование

```bash
# Запустить тесты
npm test

# Запустить с coverage
npm run test:coverage

# Linting
npm run lint

# Type checking
npm run type-check
```

## Поддержка

- Логи: `/app/logs/`
- Health checks: `/health`
- Метрики: `/metrics` (planned)
- Документация: `/docs` (planned)