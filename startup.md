# 🚀 Запуск Salesforce Clone CRM

## Быстрый старт через npm

### 1. Установка зависимостей
```bash
npm run install:all
```

### 2. Запуск в режиме разработки
```bash
npm run dev
```

Или отдельно:
```bash
npm run dev:backend   # Только backend (localhost:8000)
npm run dev:frontend  # Только frontend (localhost:3000)
```

### 3. Запуск через Docker
```bash
# Полная инфраструктура
npm run start:production

# Режим разработки
npm run start:dev  

# Минимальная версия
npm run start:minimal
```

### 4. Доступные команды

#### Разработка
- `npm run dev` - Запуск backend + frontend
- `npm run setup` - Полная установка и запуск
- `npm run test` - Тестирование backend
- `npm run lint` - Проверка кода
- `npm run typecheck` - Проверка типов TypeScript

#### Производство
- `npm run build` - Сборка frontend
- `npm run start` - Запуск production версии
- `npm run stop` - Остановка Docker контейнеров

#### Логи и отладка
- `npm run logs` - Логи всех сервисов
- `npm run logs:backend` - Логи backend
- `npm run logs:frontend` - Логи frontend
- `npm run clean` - Очистка Docker

### 5. Доступ к приложению

После запуска:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Grafana (мониторинг)**: http://localhost:3001

### 6. Тестовые данные

**Пользователь:** demo@example.com  
**Пароль:** DemoPassword123!

## Требования

- Node.js 18+
- Python 3.11+
- Docker (для полной инфраструктуры)
- PostgreSQL (автоматически в Docker)

## Статус проекта

✅ **MVP завершен на 100%**
- Аутентификация с JWT
- Управление контактами
- Управление компаниями (полный CRUD)
- Сделки с канбан-доской
- Аналитический dashboard
- Multi-tenant архитектура

Система готова к использованию!