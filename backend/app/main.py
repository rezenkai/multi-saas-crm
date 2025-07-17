"""
Основной файл FastAPI приложения
"""
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import logging
import time
from pathlib import Path

from .core.config import settings
from .core.database import create_tables
from .core.middleware import TenantMiddleware, AuthMiddleware, LoggingMiddleware

# Импорт моделей для создания таблиц
from .models import user, tenant, company, opportunity

# Настройка логирования
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Создание FastAPI приложения
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise CRM Platform - Salesforce Clone",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Добавление middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Кастомные middleware
# app = TenantMiddleware(app)
# app = AuthMiddleware(app)
# app = LoggingMiddleware(app)


@app.on_event("startup")
async def startup_event():
    """
    Событие запуска приложения
    """
    logger.info("Starting Salesforce Clone application...")
    
    # Создание таблиц в базе данных
    try:
        create_tables()
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
    
    logger.info("Application started successfully")


@app.on_event("shutdown")
async def shutdown_event():
    """
    Событие остановки приложения
    """
    logger.info("Shutting down Salesforce Clone application...")


@app.get("/")
async def root():
    """
    Корневой endpoint
    """
    return {
        "message": "Salesforce Clone API",
        "version": settings.VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """
    Проверка здоровья приложения
    """
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": settings.VERSION
    }


@app.get("/api/v1/status")
async def api_status():
    """
    Статус API
    """
    return {
        "api_version": "v1",
        "status": "operational",
        "features": [
            "multi-tenancy",
            "authentication",
            "user-management",
            "crm-modules"
        ]
    }


# Обработка ошибок
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Глобальный обработчик исключений
    """
    logger.error(f"Global exception: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error": str(exc) if settings.DEBUG else "Something went wrong"
        }
    )


# Импорт и подключение роутеров
from .api.v1.auth import router as auth_router
from .api.v1.contacts import router as contacts_router
from .api.v1.companies import router as companies_router
from .api.v1.opportunities import router as opportunities_router
from .api.v1.users import router as users_router
from .api.v1.dashboard import router as dashboard_router

app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(contacts_router, prefix=f"{settings.API_V1_STR}/contacts", tags=["Contacts"])
app.include_router(companies_router, prefix=f"{settings.API_V1_STR}/companies", tags=["Companies"])
app.include_router(opportunities_router, prefix=f"{settings.API_V1_STR}/opportunities", tags=["Opportunities"])
app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["Users"])
app.include_router(dashboard_router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["Dashboard"])

# Настройка статических файлов
static_dir = Path("static")
static_dir.mkdir(exist_ok=True)
avatars_dir = static_dir / "avatars"
avatars_dir.mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    ) 