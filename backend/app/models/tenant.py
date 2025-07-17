"""
Модели для multi-tenancy
"""
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from ..core.database import Base, settings

# Условный импорт для UUID в зависимости от типа БД
if settings.DATABASE_URL.startswith("sqlite"):
    UUIDType = String
    UUID_KWARGS = {"default": lambda: str(uuid.uuid4())}
else:
    from sqlalchemy.dialects.postgresql import UUID as UUIDType
    UUID_KWARGS = {"as_uuid": True, "default": uuid.uuid4}


class Tenant(Base):
    """
    Модель арендатора (tenant) для multi-tenancy
    """
    __tablename__ = "tenants"
    
    # ID арендатора
    id = Column(UUIDType, primary_key=True, **UUID_KWARGS)
    name = Column(String(255), nullable=False, unique=True)
    domain = Column(String(255), unique=True)
    subdomain = Column(String(100), unique=True)
    
    # Настройки арендатора
    is_active = Column(Boolean, default=True)
    max_users = Column(Integer, default=100)
    max_storage_gb = Column(Integer, default=10)
    
    # Конфигурация
    settings = Column(Text)  # JSON строка с настройками
    theme = Column(String(50), default="light")
    timezone = Column(String(50), default="UTC")
    locale = Column(String(10), default="en")
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    tenant_users = relationship("TenantUser", back_populates="tenant")
    
    def __repr__(self):
        return f"<Tenant(id={self.id}, name='{self.name}')>"


class TenantUser(Base):
    """
    Связь пользователей с арендаторами
    """
    __tablename__ = "tenant_users"
    
    # ID связи
    id = Column(UUIDType, primary_key=True, **UUID_KWARGS)
    tenant_id = Column(UUIDType, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    
    # Роли в рамках арендатора
    role = Column(String(50), default="user")  # admin, manager, user
    permissions = Column(Text)  # JSON строка с правами
    
    # Статус
    is_active = Column(Boolean, default=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Связи
    tenant = relationship("Tenant", back_populates="tenant_users")
    user = relationship("User", back_populates="tenant_users")
    
    def __repr__(self):
        return f"<TenantUser(tenant_id={self.tenant_id}, user_id={self.user_id})>"
