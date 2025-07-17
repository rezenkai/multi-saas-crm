"""
Зависимости для FastAPI
"""
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
import uuid

from .database import get_db, settings
from .security import verify_token
from ..models.user import User
from ..models.tenant import TenantUser
from ..schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    Получение текущего пользователя по JWT токену
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Проверяем токен
        payload = verify_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        
        # Получаем пользователя из базы данных с выбором нужных полей
        if settings.DATABASE_URL.startswith("sqlite"):
            user = db.query(User).filter(User.id == user_id).first()
        else:
            user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
            
        if user is None:
            raise credentials_exception
        
        # Принудительно загружаем атрибуты объекта для избежания DetachedInstanceError
        # при последующем доступе к атрибутам
        _ = user.email  # Принудительная загрузка атрибутов
        _ = user.first_name
        _ = user.last_name
        _ = user.is_active
        
        return user
        
    except JWTError:
        raise credentials_exception


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Проверка, что пользователь активен
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь неактивен"
        )
    return current_user


def get_current_active_user_db(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Получение текущего активного пользователя с сессией базы данных
    """
    # Получаем пользователя из базы данных
    if settings.DATABASE_URL.startswith("sqlite"):
        user = db.query(User).filter(User.id == str(current_user.id)).first()
    else:
        user = db.query(User).filter(User.id == current_user.id).first()
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    return user


def get_current_superuser(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Проверка, что пользователь является суперпользователем
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )
    return current_user


def get_current_tenant_id(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> str:
    """
    Получение tenant_id для текущего пользователя
    """
    tenant_user = db.query(TenantUser).filter(
        TenantUser.user_id == current_user.id,
        TenantUser.is_active == True
    ).first()
    
    if not tenant_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не привязан к tenant"
        )
    
    return str(tenant_user.tenant_id)
