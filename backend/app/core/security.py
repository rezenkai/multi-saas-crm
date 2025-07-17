"""
Утилиты безопасности для JWT и хеширования паролей
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
import secrets
import logging

from .config import settings

logger = logging.getLogger(__name__)

# Контекст для хеширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Создание JWT access токена
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode.update({
        "exp": expire,
        "type": "access"
    })
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Создание JWT refresh токена
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
    
    to_encode.update({
        "exp": expire,
        "type": "refresh",
        "jti": secrets.token_urlsafe(32)  # JWT ID для отзыва токенов
    })
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """
    Декодирование JWT токена
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        raise


def verify_token(token: str) -> Dict[str, Any]:
    """
    Проверка JWT токена
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        
        if payload.get("type") != "access":
            raise JWTError("Invalid token type")
            
        return payload
        
    except JWTError as e:
        logger.error(f"JWT verification error: {e}")
        raise


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверка пароля
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Хеширование пароля
    """
    return pwd_context.hash(password)


def generate_password() -> str:
    """
    Генерация случайного пароля
    """
    return secrets.token_urlsafe(16)


def generate_verification_token() -> str:
    """
    Генерация токена для верификации email
    """
    return secrets.token_urlsafe(32)


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Проверка надежности пароля
    """
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        return False, f"Пароль должен содержать минимум {settings.PASSWORD_MIN_LENGTH} символов"
    
    if not any(char.isdigit() for char in password):
        return False, "Пароль должен содержать хотя бы одну цифру"
    
    if not any(char.isupper() for char in password):
        return False, "Пароль должен содержать хотя бы одну заглавную букву"
    
    if not any(char.islower() for char in password):
        return False, "Пароль должен содержать хотя бы одну строчную букву"
    
    if not any(char in "!@#$%^&*()_+-=[]{}|;:,.<>?" for char in password):
        return False, "Пароль должен содержать хотя бы один специальный символ"
    
    return True, "Пароль соответствует требованиям"


def create_token_pair(user_id: str, tenant_id: str, role: str) -> Dict[str, str]:
    """
    Создание пары токенов (access + refresh)
    """
    token_data = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "role": role
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
