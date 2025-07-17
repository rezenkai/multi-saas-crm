# Plugin Development Guide

Руководство по разработке плагинов для Multi-SaaS платформы.

## Содержание

1. [Введение](#введение)
2. [Структура плагина](#структура-плагина)
3. [Манифест плагина](#манифест-плагина)
4. [Основной код плагина](#основной-код-плагина)
5. [Hooks (Хуки)](#hooks-хуки)
6. [API Endpoints](#api-endpoints)
7. [Настройки плагина](#настройки-плагина)
8. [Безопасность](#безопасность)
9. [Тестирование](#тестирование)
10. [Развертывание](#развертывание)

## Введение

Система плагинов позволяет сторонним разработчикам расширять функциональность Multi-SaaS платформы без изменения основного кода. Плагины работают в изолированной среде (sandbox) и взаимодействуют с системой через определенные API и хуки.

## Структура плагина

```
my-plugin/
├── manifest.json          # Манифест плагина (обязательно)
├── index.js              # Основной код плагина (обязательно)
├── styles.css            # Стили (опционально)
├── dashboard-widget.html # HTML шаблоны (опционально)
├── icon.png              # Иконка плагина (опционально)
├── screenshots/          # Скриншоты (опционально)
├── README.md             # Документация (рекомендуется)
└── package.json          # NPM зависимости (опционально)
```

## Манифест плагина

Файл `manifest.json` содержит метаданные о плагине:

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Описание плагина",
  "author": "Ваше имя",
  "email": "your@email.com",
  "website": "https://yourwebsite.com",
  "license": "MIT",
  "main": "index.js",
  "platformVersion": "^1.0.0",
  "dependencies": {
    "other-plugin": "^1.0.0"
  },
  "permissions": [
    "read:contacts",
    "write:contacts",
    "send:email"
  ],
  "hooks": [
    "after:create:contact",
    "dashboard:render"
  ],
  "api": {
    "/my-endpoint": {
      "method": "GET",
      "handler": "myHandler",
      "permissions": ["read:contacts"]
    }
  },
  "settings": [
    {
      "key": "apiKey",
      "type": "string",
      "label": "API Key",
      "required": true
    }
  ],
  "tags": ["crm", "analytics"],
  "category": "productivity"
}
```

### Поля манифеста

- **id**: Уникальный идентификатор плагина
- **name**: Название плагина
- **version**: Версия (семантическое версионирование)
- **description**: Описание функциональности
- **author**: Автор плагина
- **main**: Главный файл плагина (по умолчанию index.js)
- **platformVersion**: Совместимость с платформой
- **dependencies**: Зависимости от других плагинов
- **permissions**: Требуемые разрешения
- **hooks**: Хуки, которые слушает плагин
- **api**: Пользовательские API endpoints
- **settings**: Настройки плагина

## Основной код плагина

Файл `index.js` содержит основную логику плагина:

```javascript
// Инициализация плагина
const plugin = {
  name: 'My Awesome Plugin',
  version: '1.0.0',
  
  // Инициализация
  async init() {
    console.log('Plugin initialized');
    this.registerHooks();
  },
  
  // Регистрация хуков
  registerHooks() {
    registerHook('after:create:contact', this.onContactCreated);
    registerHook('dashboard:render', this.renderDashboard);
  },
  
  // Обработчики хуков
  async onContactCreated(context) {
    const { contact, user, tenant } = context;
    // Логика обработки создания контакта
    return { processed: true };
  },
  
  async renderDashboard(context) {
    // Рендер виджета для дашборда
    return {
      widget: {
        id: 'my-widget',
        title: 'My Widget',
        template: 'dashboard-widget.html'
      }
    };
  },
  
  // API обработчики
  async myHandler(user, tenant, payload) {
    // Логика API endpoint
    return { success: true, data: [] };
  }
};

// Инициализация
plugin.init();
```

## Hooks (Хуки)

Хуки позволяют плагинам реагировать на события в системе:

### Доступные хуки

#### CRM хуки
- `before:create:contact` - Перед созданием контакта
- `after:create:contact` - После создания контакта
- `before:update:contact` - Перед обновлением контакта
- `after:update:contact` - После обновления контакта
- `before:delete:contact` - Перед удалением контакта
- `after:delete:contact` - После удаления контакта

#### Компании
- `before:create:company` - Перед созданием компании
- `after:create:company` - После создания компании
- `before:update:company` - Перед обновлением компании
- `after:update:company` - После обновления компании

#### Возможности
- `before:create:opportunity` - Перед созданием сделки
- `after:create:opportunity` - После создания сделки
- `before:update:opportunity` - Перед обновлением сделки
- `after:update:opportunity` - После обновления сделки

#### Пользователи
- `user:login` - Вход пользователя
- `user:logout` - Выход пользователя

#### UI хуки
- `dashboard:render` - Рендеринг дашборда
- `page:render` - Рендеринг страницы

### Регистрация хуков

```javascript
registerHook('after:create:contact', async (context) => {
  const { contact, user, tenant } = context;
  
  // Ваша логика
  console.log(`New contact: ${contact.name}`);
  
  // Можете отправить уведомление
  await this.sendNotification({
    type: 'contact_created',
    message: `New contact ${contact.name} created`,
    user: user.id
  });
  
  // Вернуть результат
  return { processed: true, contactId: contact.id };
});
```

## API Endpoints

Плагины могут предоставлять собственные API endpoints:

### Определение в манифесте

```json
{
  "api": {
    "/analytics": {
      "method": "GET",
      "handler": "getAnalytics",
      "permissions": ["read:dashboard"]
    },
    "/sync": {
      "method": "POST",
      "handler": "syncData",
      "permissions": ["write:contacts"]
    }
  }
}
```

### Реализация обработчиков

```javascript
async getAnalytics(user, tenant, payload) {
  try {
    const data = await this.calculateAnalytics(tenant.id);
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async syncData(user, tenant, payload) {
  const { type, data } = payload;
  
  // Валидация данных
  if (!type || !data) {
    return {
      success: false,
      error: 'Missing type or data'
    };
  }
  
  // Обработка синхронизации
  await this.performSync(type, data);
  
  return {
    success: true,
    message: 'Data synchronized successfully'
  };
}
```

### Вызов API

```javascript
// GET /api/v1/plugins/my-plugin/analytics
const response = await fetch('/api/v1/plugins/my-plugin/analytics', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

// POST /api/v1/plugins/my-plugin/sync
const response = await fetch('/api/v1/plugins/my-plugin/sync', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    type: 'contacts',
    data: contactsData
  })
});
```

## Настройки плагина

Плагины могут иметь настраиваемые параметры:

### Определение настроек

```json
{
  "settings": [
    {
      "key": "apiKey",
      "type": "string",
      "label": "API Key",
      "description": "Your external service API key",
      "required": true
    },
    {
      "key": "enableNotifications",
      "type": "boolean",
      "label": "Enable Notifications",
      "default": true
    },
    {
      "key": "syncInterval",
      "type": "select",
      "label": "Sync Interval",
      "default": "hourly",
      "options": [
        { "value": "realtime", "label": "Real-time" },
        { "value": "hourly", "label": "Every hour" },
        { "value": "daily", "label": "Daily" }
      ]
    }
  ]
}
```

### Использование настроек

```javascript
// Получение настроек
const settings = await this.getSettings();

if (settings.enableNotifications) {
  await this.sendNotification(...);
}

// Сохранение настроек
await this.saveSettings({
  apiKey: 'new-api-key',
  enableNotifications: false
});
```

## Безопасность

### Sandbox окружение

Плагины выполняются в изолированной среде с ограниченным доступом:

```javascript
// Разрешено
const _ = require('lodash');
const uuid = require('uuid');
const moment = require('moment');

// Запрещено
const fs = require('fs');        // Ошибка!
const child_process = require('child_process'); // Ошибка!
```

### Доступные модули

- `lodash` - Утилиты для работы с данными
- `uuid` - Генерация UUID
- `moment` - Работа с датами
- `axios` - HTTP клиент (ограниченный)

### Доступные API

```javascript
// HTTP запросы (ограниченные)
const response = await http.get('https://api.example.com/data');
const result = await http.post('https://api.example.com/data', data);

// Хранилище (scoped к плагину)
await storage.set('key', value);
const value = await storage.get('key');
await storage.delete('key');

// События
events.emit('custom:event', data);
events.on('custom:event', handler);

// Уведомления
await this.sendNotification({
  type: 'info',
  message: 'Hello from plugin!'
});
```

### Разрешения

Плагины должны запрашивать необходимые разрешения:

```json
{
  "permissions": [
    "read:contacts",     // Чтение контактов
    "write:contacts",    // Запись контактов
    "read:companies",    // Чтение компаний
    "write:companies",   // Запись компаний
    "read:opportunities", // Чтение сделок
    "write:opportunities", // Запись сделок
    "send:email",        // Отправка email
    "send:sms",          // Отправка SMS
    "access:api",        // Доступ к API
    "access:hooks",      // Доступ к хукам
    "access:storage",    // Доступ к хранилищу
    "access:events"      // Доступ к событиям
  ]
}
```

## Тестирование

### Локальное тестирование

```javascript
// test/plugin.test.js
const plugin = require('../index.js');

describe('My Plugin', () => {
  test('should initialize correctly', async () => {
    await plugin.init();
    expect(plugin.name).toBe('My Awesome Plugin');
  });
  
  test('should handle contact creation', async () => {
    const context = {
      contact: { id: '123', name: 'John Doe' },
      user: { id: 'user1' },
      tenant: { id: 'tenant1' }
    };
    
    const result = await plugin.onContactCreated(context);
    expect(result.processed).toBe(true);
  });
});
```

### Интеграционное тестирование

```bash
# Установка плагина для тестирования
curl -X POST http://localhost:8003/api/v1/plugins/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "plugin=@my-plugin.zip"

# Активация плагина
curl -X POST http://localhost:8003/api/v1/plugins/my-plugin/activate \
  -H "Authorization: Bearer YOUR_TOKEN"

# Тестирование API
curl -X GET http://localhost:8003/api/v1/plugins/my-plugin/analytics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Развертывание

### Упаковка плагина

```bash
# Создание zip архива
zip -r my-plugin.zip my-plugin/

# Или с исключениями
zip -r my-plugin.zip my-plugin/ -x "*.test.js" "node_modules/*"
```

### Загрузка плагина

```bash
# Через API
curl -X POST http://localhost:8003/api/v1/plugins/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "plugin=@my-plugin.zip"

# Через веб-интерфейс (планируется)
# - Перейти в раздел "Плагины"
# - Нажать "Загрузить плагин"
# - Выбрать zip файл
# - Настроить параметры
# - Активировать
```

### Управление плагином

```bash
# Список плагинов
curl -X GET http://localhost:8003/api/v1/plugins \
  -H "Authorization: Bearer YOUR_TOKEN"

# Информация о плагине
curl -X GET http://localhost:8003/api/v1/plugins/my-plugin \
  -H "Authorization: Bearer YOUR_TOKEN"

# Активация
curl -X POST http://localhost:8003/api/v1/plugins/my-plugin/activate \
  -H "Authorization: Bearer YOUR_TOKEN"

# Деактивация
curl -X POST http://localhost:8003/api/v1/plugins/my-plugin/deactivate \
  -H "Authorization: Bearer YOUR_TOKEN"

# Удаление
curl -X DELETE http://localhost:8003/api/v1/plugins/my-plugin \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Лучшие практики

### 1. Безопасность

- Всегда валидируйте входные данные
- Не храните секреты в коде
- Используйте настройки для конфиденциальных данных
- Обрабатывайте ошибки корректно

### 2. Производительность

- Избегайте блокирующих операций
- Используйте асинхронный код
- Кешируйте результаты где возможно
- Ограничивайте количество HTTP запросов

### 3. Пользовательский опыт

- Предоставляйте понятные сообщения об ошибках
- Добавляйте индикаторы загрузки
- Делайте настройки интуитивными
- Тестируйте на разных устройствах

### 4. Совместимость

- Указывайте правильную версию платформы
- Проверяйте зависимости
- Тестируйте с разными версиями
- Документируйте изменения

### 5. Документация

- Добавляйте README.md
- Документируйте API endpoints
- Приводите примеры использования
- Описывайте настройки

## Примеры плагинов

### Простой плагин уведомлений

```javascript
const plugin = {
  name: 'Notification Plugin',
  
  registerHooks() {
    registerHook('after:create:contact', async (context) => {
      await this.sendSlackNotification(
        `New contact: ${context.contact.name}`
      );
    });
  },
  
  async sendSlackNotification(message) {
    const settings = await this.getSettings();
    
    if (settings.slackWebhook) {
      await http.post(settings.slackWebhook, {
        text: message
      });
    }
  }
};
```

### Плагин аналитики

```javascript
const plugin = {
  name: 'Analytics Plugin',
  
  async getAnalytics(user, tenant) {
    const data = await this.fetchAnalyticsData(tenant.id);
    
    return {
      success: true,
      data: {
        totalContacts: data.contacts,
        conversionRate: data.conversion,
        revenue: data.revenue
      }
    };
  },
  
  async fetchAnalyticsData(tenantId) {
    // Получение данных из внешнего сервиса
    const response = await http.get(`https://analytics.example.com/api/data/${tenantId}`);
    return response.data;
  }
};
```

## Поддержка

- Документация: https://docs.multi-saas.com/plugins
- GitHub: https://github.com/multi-saas/plugins
- Сообщество: https://community.multi-saas.com/plugins
- Email: plugins@multi-saas.com