"""
Настройки базы данных с поддержкой multi-tenancy
"""
from typing import Generator, Optional
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from contextvars import ContextVar
import logging

from .config import settings

# Context variable для хранения tenant_id
tenant_context: ContextVar[Optional[str]] = ContextVar("tenant_id", default=None)

# Настройка логирования
logger = logging.getLogger(__name__)

# Создание движка базы данных
if settings.DATABASE_URL.startswith("sqlite"):
    # Специальные настройки для SQLite
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=settings.DEBUG,
    )
else:
    # Настройки для PostgreSQL и других БД
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )

# Создание сессии
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для моделей
Base = declarative_base()

# Метаданные для управления схемой
metadata = MetaData()


def get_db() -> Generator[Session, None, None]:
    """
    Генератор для получения сессии базы данных
    """
    db = SessionLocal()
    try:
        # Установка tenant_id в контекст сессии
        tenant_id = tenant_context.get()
        if tenant_id and not settings.DATABASE_URL.startswith("sqlite"):
            # Только для PostgreSQL
            db.execute(f"SET app.tenant_id = '{tenant_id}'")
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def set_tenant_context(tenant_id: str) -> None:
    """
    Установка tenant_id в контекст
    """
    tenant_context.set(tenant_id)


def get_current_tenant() -> Optional[str]:
    """
    Получение текущего tenant_id
    """
    return tenant_context.get()


# Функция для создания таблиц
def create_tables():
    """
    Создание всех таблиц в базе данных
    """
    Base.metadata.create_all(bind=engine)


# Функция для удаления таблиц (только для разработки)
def drop_tables():
    """
    Удаление всех таблиц (только для разработки)
    """
    Base.metadata.drop_all(bind=engine) 