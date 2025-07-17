"""
Модели для токенов верификации и сброса пароля
"""
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timedelta

from ..core.database import Base, settings

# Условный импорт для UUID в зависимости от типа БД
if settings.DATABASE_URL.startswith("sqlite"):
    UUIDType = String
    UUID_KWARGS = {"default": lambda: str(uuid.uuid4())}
else:
    from sqlalchemy.dialects.postgresql import UUID as UUIDType
    UUID_KWARGS = {"as_uuid": True, "default": uuid.uuid4}


class VerificationToken(Base):
    """
    Модель токена верификации email
    """
    __tablename__ = "verification_tokens"
    
    # ID токена
    id = Column(UUIDType, primary_key=True, **UUID_KWARGS)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    
    # Токен и его тип
    token = Column(String(255), nullable=False, unique=True, index=True)
    token_type = Column(String(50), nullable=False)  # email_verification, password_reset
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    used_at = Column(DateTime(timezone=True))
    
    # Связи
    user = relationship("User")
    
    def is_expired(self) -> bool:
        """Проверка истечения токена"""
        return datetime.utcnow() > self.expires_at.replace(tzinfo=None)
    
    def is_valid(self) -> bool:
        """Проверка валидности токена"""
        return not self.used and not self.is_expired()
    
    @classmethod
    def create_email_verification_token(cls, user_id: str, token: str) -> "VerificationToken":
        """Создание токена подтверждения email"""
        return cls(
            user_id=user_id,
            token=token,
            token_type="email_verification",
            expires_at=datetime.utcnow() + timedelta(days=7)  # 7 дней
        )
    
    @classmethod
    def create_password_reset_token(cls, user_id: str, token: str) -> "VerificationToken":
        """Создание токена сброса пароля"""
        return cls(
            user_id=user_id,
            token=token,
            token_type="password_reset",
            expires_at=datetime.utcnow() + timedelta(hours=1)  # 1 час
        )
    
    def __repr__(self):
        return f"<VerificationToken(user_id={self.user_id}, type='{self.token_type}')>"


class EmailLog(Base):
    """
    Модель для логирования отправленных email
    """
    __tablename__ = "email_logs"
    
    # ID записи
    id = Column(UUIDType, primary_key=True, **UUID_KWARGS)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    
    # Информация о письме
    email_type = Column(String(50), nullable=False)  # welcome, password_reset, etc.
    recipient = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text)
    
    # Статус отправки
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(50), nullable=False)  # sent, failed
    error = Column(Text)
    
    def __repr__(self):
        return f"<EmailLog(user_id={self.user_id}, type='{self.email_type}')>"