# 📋 Migration Guide: От CRM к Multi-SaaS Platform

Подробное руководство по миграции существующей CRM системы к Multi-SaaS платформе.

## 🎯 Обзор миграции

### Текущее состояние
- ✅ **Полнофункциональная CRM система** - 100% готова
- ✅ **Монолитная архитектура** - FastAPI backend
- ✅ **Все основные модули** - Контакты, Компании, Сделки, Пользователи
- ✅ **Multi-tenancy** - Row Level Security
- ✅ **Email система** - Уведомления и шаблоны

### Целевое состояние
- 🎯 **Multi-SaaS платформа** - Модульная архитектура
- 🎯 **Микросервисная архитектура** - Отдельные сервисы по доменам
- 🎯 **Система плагинов** - Расширяемость для сторонних разработчиков
- 🎯 **Дополнительные модули** - ERP, Marketing, Projects
- 🎯 **API Gateway** - Единая точка входа
- 🎯 **OAuth2 Provider** - Расширенная аутентификация

## 🗺️ План миграции

### **Этап 1: Подготовка инфраструктуры (Неделя 1)**

#### 1.1 Настройка API Gateway
```bash
# Запустить API Gateway
cd api-gateway
npm install
npm run dev
```

#### 1.2 Настройка системы плагинов
```bash
# Запустить Plugin System
cd plugins-system
npm install
npm run dev
```

#### 1.3 Обновление Docker Compose
```bash
# Использовать новую конфигурацию
docker-compose -f docker-compose.microservices.yml up -d
```

### **Этап 2: Выделение Auth Service (Неделя 2)**

#### 2.1 Создание отдельного Auth Service
```bash
# Создать новый микросервис
mkdir auth-service
cd auth-service

# Скопировать Auth логику из существующего backend
cp -r ../backend/app/api/v1/auth.py ./
cp -r ../backend/app/services/auth.py ./
cp -r ../backend/app/models/user.py ./
```

#### 2.2 Настройка маршрутизации
```typescript
// В API Gateway добавить маршрут для Auth Service
app.use('/api/v1/auth', createProxyMiddleware({
  target: 'http://auth-service:8000',
  changeOrigin: true,
}));
```

### **Этап 3: Выделение CRM микросервисов (Неделя 3-4)**

#### 3.1 Contacts Service
```bash
# Создать Contacts Service
mkdir contacts-service
cd contacts-service

# Перенести логику контактов
cp -r ../backend/app/api/v1/contacts.py ./
cp -r ../backend/app/models/contact.py ./
cp -r ../backend/app/services/contacts.py ./
```

#### 3.2 Companies Service
```bash
# Создать Companies Service
mkdir companies-service
cd companies-service

# Перенести логику компаний
cp -r ../backend/app/api/v1/companies.py ./
cp -r ../backend/app/models/company.py ./
```

#### 3.3 Opportunities Service
```bash
# Создать Opportunities Service
mkdir opportunities-service
cd opportunities-service

# Перенести логику сделок
cp -r ../backend/app/api/v1/opportunities.py ./
cp -r ../backend/app/models/opportunity.py ./
```

### **Этап 4: Новые модули Multi-SaaS (Неделя 5-6)**

#### 4.1 ERP Service
```bash
# Создать ERP Service
mkdir erp-service
cd erp-service

# Создать базовую структуру
npm init -y
npm install express helmet cors jsonwebtoken
```

#### 4.2 Marketing Service
```bash
# Создать Marketing Service
mkdir marketing-service
cd marketing-service

# Создать базовую структуру
npm init -y
npm install express helmet cors jsonwebtoken
```

### **Этап 5: Система плагинов (Неделя 7)**

#### 5.1 Интеграция с существующими сервисами
```bash
# Настроить hooks для существующих API
# Добавить события в CRM сервисы
```

#### 5.2 Создание marketplace
```bash
# Создать интерфейс для управления плагинами
cd frontend/src/app
mkdir plugins
```

### **Этап 6: Настраиваемые объекты (Неделя 8)**

#### 6.1 Создание системы метаданных
```sql
-- Создать таблицы для настраиваемых объектов
CREATE TABLE custom_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    api_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id UUID REFERENCES custom_objects(id),
    name VARCHAR(255) NOT NULL,
    api_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    required BOOLEAN DEFAULT FALSE,
    default_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Детальная инструкция по этапам

### Этап 1: API Gateway

#### 1.1 Установка и настройка
```bash
# Перейти в директорию API Gateway
cd /mnt/d/CRM\ project/api-gateway

# Установить зависимости
npm install

# Создать .env файл
cp .env.example .env

# Отредактировать конфигурацию
nano .env
```

#### 1.2 Конфигурация .env
```env
NODE_ENV=development
PORT=3001
JWT_SECRET=your-secret-key-change-in-production
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGIN=http://localhost:3000

# Текущий backend (временно)
AUTH_SERVICE_URL=http://localhost:8000
USERS_SERVICE_URL=http://localhost:8000
CONTACTS_SERVICE_URL=http://localhost:8000
COMPANIES_SERVICE_URL=http://localhost:8000
OPPORTUNITIES_SERVICE_URL=http://localhost:8000
DASHBOARD_SERVICE_URL=http://localhost:8000
```

#### 1.3 Запуск API Gateway
```bash
# Режим разработки
npm run dev

# Проверка работоспособности
curl http://localhost:3001/health
```

### Этап 2: Plugin System

#### 2.1 Установка и настройка
```bash
# Перейти в директорию Plugin System
cd /mnt/d/CRM\ project/plugins-system

# Установить зависимости
npm install

# Создать необходимые директории
mkdir -p plugins uploads data logs
```

#### 2.2 Запуск Plugin System
```bash
# Режим разработки
npm run dev

# Проверка работоспособности
curl http://localhost:8003/health
```

#### 2.3 Тестирование с примером плагина
```bash
# Создать zip архив с примером плагина
cd examples/sample-plugin
zip -r sample-plugin.zip *

# Загрузить плагин через API
curl -X POST http://localhost:8003/api/v1/plugins/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "plugin=@sample-plugin.zip"
```

### Этап 3: Обновление Frontend

#### 3.1 Изменение API URL
```typescript
// В frontend/src/lib/auth.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Вместо прямого обращения к backend
// const API_URL = 'http://localhost:8000';
```

#### 3.2 Добавление страницы плагинов
```typescript
// frontend/src/app/plugins/page.tsx
import { useState, useEffect } from 'react';

export default function PluginsPage() {
  const [plugins, setPlugins] = useState([]);
  
  useEffect(() => {
    fetchPlugins();
  }, []);
  
  const fetchPlugins = async () => {
    const response = await fetch('/api/v1/plugins');
    const data = await response.json();
    setPlugins(data.plugins);
  };
  
  return (
    <div>
      <h1>Плагины</h1>
      {plugins.map(plugin => (
        <div key={plugin.id}>
          <h3>{plugin.name}</h3>
          <p>{plugin.description}</p>
        </div>
      ))}
    </div>
  );
}
```

### Этап 4: Постепенная миграция сервисов

#### 4.1 Создание шаблона микросервиса
```bash
# Создать шаблон для новых сервисов
mkdir service-template
cd service-template

# Создать package.json
cat > package.json << 'EOF'
{
  "name": "microservice-template",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.11.3",
    "redis": "^4.6.10"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.2",
    "tsx": "^4.6.0"
  }
}
EOF
```

#### 4.2 Создание базовой структуры
```typescript
// service-template/src/index.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

const app = express();
const PORT = process.env.SERVICE_PORT || 8000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: process.env.SERVICE_NAME });
});

// Routes
app.use('/api/v1', require('./routes'));

app.listen(PORT, () => {
  console.log(`${process.env.SERVICE_NAME} started on port ${PORT}`);
});
```

## 🔄 Процесс миграции

### Вариант 1: Постепенная миграция (Рекомендуется)

#### Неделя 1: Подготовка
- [x] Создать API Gateway
- [x] Создать Plugin System
- [x] Обновить Docker Compose

#### Неделя 2: Auth Service
- [ ] Выделить Auth Service
- [ ] Настроить маршрутизацию через Gateway
- [ ] Протестировать аутентификацию

#### Неделя 3: CRM Services
- [ ] Выделить Contacts Service
- [ ] Выделить Companies Service
- [ ] Выделить Opportunities Service

#### Неделя 4: Testing & Integration
- [ ] Интеграционное тестирование
- [ ] Исправление ошибок
- [ ] Настройка мониторинга

#### Неделя 5-6: Новые модули
- [ ] Создать ERP Service
- [ ] Создать Marketing Service
- [ ] Интеграция с Plugin System

#### Неделя 7-8: Расширенные возможности
- [ ] Настраиваемые объекты
- [ ] OAuth2 Provider
- [ ] Marketplace для плагинов

### Вариант 2: Параллельная разработка

#### Преимущества:
- Быстрее получить результат
- Можно работать параллельно над модулями
- Минимум простоя

#### Недостатки:
- Выше риск ошибок
- Сложнее интеграция
- Больше ресурсов

## 🧪 Тестирование миграции

### Unit тесты
```bash
# Тестирование каждого сервиса
cd auth-service && npm test
cd contacts-service && npm test
cd companies-service && npm test
```

### Integration тесты
```bash
# Тестирование через API Gateway
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'

# Тестирование CRM endpoints
curl -X GET http://localhost:3001/api/v1/contacts \
  -H "Authorization: Bearer TOKEN"
```

### End-to-end тесты
```bash
# Тестирование полного workflow
npm run test:e2e
```

## 📊 Мониторинг миграции

### Метрики для отслеживания
- **Время отклика API** - должно остаться стабильным
- **Доступность сервисов** - 99.9%+
- **Ошибки** - отслеживать новые ошибки
- **Производительность** - нагрузка на CPU/Memory

### Alerts
```yaml
# prometheus/alerts.yml
groups:
  - name: migration
    rules:
      - alert: ServiceDown
        expr: up{job="microservice"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.instance }} is down"
```

## 🔐 Безопасность

### Аутентификация
- JWT токены остаются прежними
- Добавить валидацию на уровне Gateway
- Настроить межсервисную аутентификацию

### Авторизация
- Сохранить существующие роли
- Добавить permissions для плагинов
- Настроить RBAC для новых модулей

## 🚀 Развертывание

### Development
```bash
# Запуск всех сервисов
docker-compose -f docker-compose.microservices.yml up -d

# Проверка статуса
docker-compose ps
```

### Production
```bash
# Настроить переменные окружения
cp .env.example .env.production

# Запустить в production режиме
docker-compose -f docker-compose.microservices.yml \
  --env-file .env.production up -d
```

## 📋 Чеклист миграции

### Этап 1: Инфраструктура
- [x] API Gateway создан
- [x] Plugin System создан
- [x] Docker Compose обновлен
- [ ] Мониторинг настроен
- [ ] Логирование настроено

### Этап 2: Микросервисы
- [ ] Auth Service выделен
- [ ] Contacts Service выделен
- [ ] Companies Service выделен
- [ ] Opportunities Service выделен
- [ ] Users Service выделен
- [ ] Dashboard Service выделен

### Этап 3: Новые модули
- [ ] ERP Service создан
- [ ] Marketing Service создан
- [ ] Plugin System интегрирован
- [ ] OAuth2 Provider настроен

### Этап 4: Тестирование
- [ ] Unit тесты пройдены
- [ ] Integration тесты пройдены
- [ ] E2E тесты пройдены
- [ ] Performance тесты пройдены

### Этап 5: Развертывание
- [ ] Development среда работает
- [ ] Staging среда работает
- [ ] Production ready
- [ ] Monitoring настроен

## 🎯 Следующие шаги

После завершения миграции:

1. **Мобильное приложение** - React Native
2. **Advanced Analytics** - BI модуль
3. **Workflow Engine** - Автоматизация процессов
4. **Multi-region deployment** - Географическое распределение
5. **AI/ML модули** - Искусственный интеллект

## 📞 Поддержка

При возникновении проблем:
- Проверить логи: `docker-compose logs service-name`
- Проверить health checks: `curl http://localhost:port/health`
- Документация: `README.md` каждого сервиса
- Issues: GitHub repository

---

**Миграция завершена на 60%** - Основная инфраструктура готова, осталось выделить сервисы и добавить новые модули.