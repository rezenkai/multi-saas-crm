# Analytics Service Dockerfile
FROM node:18-alpine

# Установка рабочей директории
WORKDIR /app

# Копирование package.json и установка зависимостей
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Копирование исходного кода и конфигурации
COPY src/ ./src/
COPY tsconfig.json ./
COPY database/ ./database/

# Сборка TypeScript
RUN npm install typescript --no-save && npm run build && npm uninstall typescript

# Создание пользователя без root прав
RUN addgroup -g 1001 -S nodejs && \
    adduser -S analytics -u 1001 -G nodejs

# Создание директорий для логов
RUN mkdir -p /app/logs && chown -R analytics:nodejs /app

# Смена пользователя
USER analytics

# Открытие порта
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Запуск сервиса
CMD ["npm", "start"]