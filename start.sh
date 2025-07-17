#!/bin/bash

# Скрипт для запуска Salesforce Clone в режиме разработки

echo "🚀 Запуск Salesforce Clone..."

# Проверка наличия Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Пожалуйста, установите Docker."
    exit 1
fi

# Проверка наличия Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Пожалуйста, установите Docker Compose."
    exit 1
fi

echo "📦 Создание необходимых директорий..."
mkdir -p infrastructure/monitoring/grafana/dashboards
mkdir -p infrastructure/monitoring/grafana/datasources

echo "🔧 Создание .env файла..."
if [ ! -f .env ]; then
    cat > .env << EOF
# Salesforce Clone Environment Variables
DEBUG=true
DATABASE_URL=postgresql://postgres:password@localhost:5432/salesforce_clone
REDIS_URL=redis://localhost:6379/0
ELASTICSEARCH_URL=http://localhost:9200
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# JWT Settings
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8080"]

# Multi-tenancy
DEFAULT_TENANT_ID=default
TENANT_HEADER=X-Tenant-ID

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
EOF
    echo "✅ .env файл создан"
else
    echo "✅ .env файл уже существует"
fi

echo "🐳 Запуск Docker контейнеров..."
docker-compose up -d

echo "⏳ Ожидание запуска сервисов..."
sleep 30

echo "🔍 Проверка статуса сервисов..."

# Проверка PostgreSQL
if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL запущен"
else
    echo "❌ PostgreSQL не запущен"
fi

# Проверка Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis запущен"
else
    echo "❌ Redis не запущен"
fi

# Проверка Elasticsearch
if curl -s http://localhost:9200/_cluster/health > /dev/null 2>&1; then
    echo "✅ Elasticsearch запущен"
else
    echo "❌ Elasticsearch не запущен"
fi

# Проверка Backend
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend API запущен"
else
    echo "❌ Backend API не запущен"
fi

echo ""
echo "🎉 Salesforce Clone запущен!"
echo ""
echo "📊 Доступные сервисы:"
echo "   🌐 Frontend: http://localhost:3000"
echo "   🔧 Backend API: http://localhost:8000"
echo "   📚 API Docs: http://localhost:8000/docs"
echo "   📈 Grafana: http://localhost:3001 (admin/admin)"
echo "   📊 Prometheus: http://localhost:9090"
echo "   🗄️  PostgreSQL: localhost:5432"
echo "   🔴 Redis: localhost:6379"
echo "   🔍 Elasticsearch: http://localhost:9200"
echo ""
echo "🔑 Дефолтные учетные данные:"
echo "   Email: admin@salesforce-clone.com"
echo "   Password: admin123"
echo ""
echo "🛑 Для остановки используйте: docker-compose down"
echo "📝 Для просмотра логов используйте: docker-compose logs -f" 