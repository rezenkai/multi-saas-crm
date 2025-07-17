"""
Модели пользователей с поддержкой multi-tenancy
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


class User(Base):
    """
    Модель пользователя
    """
    __tablename__ = "users"
    
    # ID пользователя
    id = Column(UUIDType, primary_key=True, **UUID_KWARGS)
    
    # Основная информация
    email = Column(String(255), nullable=False, unique=True, index=True)
    username = Column(String(100), unique=True, index=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    
    # Аутентификация
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    
    # Профиль
    avatar_url = Column(String(500))
    phone = Column(String(20))
    title = Column(String(100))
    department = Column(String(100))
    bio = Column(Text)
    
    # Настройки
    timezone = Column(String(50), default="UTC")
    locale = Column(String(10), default="en")
    theme = Column(String(20), default="light")
    email_notifications = Column(Boolean, default=False)
    sms_notifications = Column(Boolean, default=False)
    push_notifications = Column(Boolean, default=False)
    marketing_notifications = Column(Boolean, default=False)
    
    # Безопасность
    last_login = Column(DateTime(timezone=True))
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True))
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    tenant_users = relationship("TenantUser", back_populates="user")
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    
    @property
    def full_name(self) -> str:
        """Полное имя пользователя"""
        return f"{self.first_name} {self.last_name}".strip()
    
    def __repr__(self):
        try:
            return f"<User(id={self.id}, email='{self.email}')>"
        except Exception:
            return f"<User at {hex(id(self))}>"


class UserProfile(Base):
    """
    Расширенный профиль пользователя
    """
    __tablename__ = "user_profiles"
    
    # ID профиля
    id = Column(UUIDType, primary_key=True, **UUID_KWARGS)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    
    # Дополнительная информация
    company = Column(String(255))
    position = Column(String(255))
    address = Column(Text)
    city = Column(String(100))
    country = Column(String(100))
    postal_code = Column(String(20))
    
    # Социальные сети
    linkedin_url = Column(String(500))
    twitter_url = Column(String(500))
    facebook_url = Column(String(500))
    
    # Настройки уведомлений
    email_notifications = Column(Boolean, default=True)
    sms_notifications = Column(Boolean, default=False)
    push_notifications = Column(Boolean, default=True)
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    user = relationship("User", back_populates="profile")
    
    def __repr__(self):
        return f"<UserProfile(user_id={self.user_id})>"


class UserSession(Base):
    """
    Сессии пользователей
    """
    __tablename__ = "user_sessions"
    
    # ID сессии
    id = Column(UUIDType, primary_key=True, **UUID_KWARGS)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    
    # Информация о сессии
    session_token = Column(Text, nullable=False, unique=True, index=True)
    refresh_token = Column(Text, unique=True, index=True)
    
    # Информация о клиенте
    ip_address = Column(String(45))
    user_agent = Column(Text)
    device_type = Column(String(50))  # desktop, mobile, tablet
    
    # Статус
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<UserSession(user_id={self.user_id}, token='{self.session_token[:10]}...')" 