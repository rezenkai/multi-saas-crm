@echo off
chcp 65001 >nul

echo 🚀 Запуск Salesforce Clone...

REM Проверка наличия Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker не установлен. Пожалуйста, установите Docker.
    pause
    exit /b 1
)

REM Проверка наличия Docker Compose
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose не установлен. Пожалуйста, установите Docker Compose.
    pause
    exit /b 1
)

echo 📦 Создание необходимых директорий...
if not exist "infrastructure\monitoring\grafana\dashboards" mkdir "infrastructure\monitoring\grafana\dashboards"
if not exist "infrastructure\monitoring\grafana\datasources" mkdir "infrastructure\monitoring\grafana\datasources"

echo 🔧 Создание .env файла...
if not exist ".env" (
    (
        echo # Salesforce Clone Environment Variables
        echo DEBUG=true
        echo DATABASE_URL=postgresql://postgres:password@localhost:5432/salesforce_clone
        echo REDIS_URL=redis://localhost:6379/0
        echo ELASTICSEARCH_URL=http://localhost:9200
        echo KAFKA_BOOTSTRAP_SERVERS=localhost:9092
        echo.
        echo # JWT Settings
        echo SECRET_KEY=your-secret-key-change-in-production
        echo ALGORITHM=HS256
        echo ACCESS_TOKEN_EXPIRE_MINUTES=30
        echo REFRESH_TOKEN_EXPIRE_DAYS=7
        echo.
        echo # CORS
        echo BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8080"]
        echo.
        echo # Multi-tenancy
        echo DEFAULT_TENANT_ID=default
        echo TENANT_HEADER=X-Tenant-ID
        echo.
        echo # Logging
        echo LOG_LEVEL=INFO
        echo LOG_FORMAT=json
        echo.
        echo # Monitoring
        echo ENABLE_METRICS=true
        echo METRICS_PORT=9090
    ) > .env
    echo ✅ .env файл создан
) else (
    echo ✅ .env файл уже существует
)

echo 🐳 Запуск Docker контейнеров...
docker-compose up -d

echo ⏳ Ожидание запуска сервисов...
timeout /t 30 /nobreak >nul

echo 🔍 Проверка статуса сервисов...

REM Проверка PostgreSQL
docker-compose exec -T postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo ❌ PostgreSQL не запущен
) else (
    echo ✅ PostgreSQL запущен
)

REM Проверка Redis
docker-compose exec -T redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo ❌ Redis не запущен
) else (
    echo ✅ Redis запущен
)

REM Проверка Backend
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo ❌ Backend API не запущен
) else (
    echo ✅ Backend API запущен
)

echo.
echo 🎉 Salesforce Clone запущен!
echo.
echo 📊 Доступные сервисы:
echo    🌐 Frontend: http://localhost:3000
echo    🔧 Backend API: http://localhost:8000
echo    📚 API Docs: http://localhost:8000/docs
echo    📈 Grafana: http://localhost:3001 (admin/admin)
echo    📊 Prometheus: http://localhost:9090
echo    🗄️  PostgreSQL: localhost:5432
echo    🔴 Redis: localhost:6379
echo    🔍 Elasticsearch: http://localhost:9200
echo.
echo 🔑 Дефолтные учетные данные:
echo    Email: admin@salesforce-clone.com
echo    Password: admin123
echo.
echo 🛑 Для остановки используйте: docker-compose down
echo 📝 Для просмотра логов используйте: docker-compose logs -f
echo.
pause 