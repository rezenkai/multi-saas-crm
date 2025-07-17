"""
API endpoints для управления пользователями
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
import logging
import uuid
import os
from pathlib import Path
import traceback

from ...core.database import get_db
from ...core.deps import get_current_user, get_current_tenant_id, get_current_active_user, get_current_active_user_db
from ...schemas.user import (
    UserResponse,
    UserUpdate,
    UserSettingsUpdate,
    ChangePasswordRequest
)
from ...models.user import User
from ...core.security import get_password_hash, verify_password
from ...services.auth import AuthService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение профиля текущего пользователя
    """
    # Получаем полную информацию о пользователе из базы данных
    user = db.query(User).filter(User.id == str(current_user.id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        is_verified=user.is_verified,
        is_superuser=user.is_superuser,
        phone=user.phone,
        title=user.title,
        department=user.department,
        bio=user.bio,
        avatar_url=user.avatar_url,
        timezone=user.timezone,
        locale=user.locale,
        theme=user.theme,
        last_login=user.last_login,
        created_at=user.created_at,
        updated_at=user.updated_at
    )


@router.get("/settings", response_model=UserSettingsUpdate)
async def get_user_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение настроек пользователя
    """
    try:
        # Получаем пользователя из базы данных
        user = db.query(User).filter(User.id == str(current_user.id)).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        return UserSettingsUpdate(
            timezone=user.timezone,
            locale=user.locale,
            theme=user.theme,
            email_notifications=user.email_notifications,
            sms_notifications=user.sms_notifications,
            push_notifications=user.push_notifications,
            marketing_notifications=user.marketing_notifications
        )
    except Exception as e:
        logger.error(f"Error getting user settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при получении настроек"
        )


@router.put("/settings", response_model=UserSettingsUpdate)
async def update_user_settings(
    settings: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Обновление настроек пользователя
    """
    try:
        logger.info(f"Updating settings for user {str(current_user.id)}")
        logger.info(f"Received settings: {settings.dict()}")
        
        update_data = settings.dict(exclude_unset=True)
        logger.info(f"Update data after exclude_unset: {update_data}")
        
        # Проверяем, что хотя бы одно поле передано
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Необходимо указать хотя бы одну настройку для обновления"
            )
        
        # Получаем пользователя из базы данных
        user = db.query(User).filter(User.id == str(current_user.id)).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        # Обновляем только переданные поля
        for field, value in update_data.items():
            if hasattr(user, field):
                logger.info(f"Updating field {field} with value {value}")
                setattr(user, field, value)
            else:
                logger.warning(f"Field {field} not found in user model")
        
        try:
            db.commit()
            logger.info("Database commit successful")
        except Exception as commit_error:
            logger.error(f"Database commit error: {commit_error}")
            raise
            
        db.refresh(user)
        logger.info("User refreshed from database")
        
        # Возвращаем обновленные настройки
        response = UserSettingsUpdate(
            timezone=user.timezone,
            locale=user.locale,
            theme=user.theme,
            email_notifications=user.email_notifications,
            sms_notifications=user.sms_notifications,
            push_notifications=user.push_notifications,
            marketing_notifications=user.marketing_notifications
        )
        logger.info(f"Returning response: {response.dict()}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user settings: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Traceback:\n{traceback.format_exc()}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении настроек: {str(e)}"
        )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user_profile(
    user_id: str,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user_db)
):
    """
    Обновление профиля пользователя
    """
    try:
        # Проверяем, что пользователь обновляет свой собственный профиль
        # или является суперпользователем
        if str(str(current_user.id)) != user_id and not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для обновления этого профиля"
            )
        
        # Находим пользователя
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        # Обновляем поля пользователя
        update_data = user_update.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            if hasattr(user, field):
                setattr(user, field, value)
        
        db.commit()
        db.refresh(user)
        
        logger.info(f"User profile updated: {user.id}")
        return user
        
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат ID пользователя"
        )
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при обновлении профиля"
        )


@router.post("/change-password", response_model=dict)
async def change_password(
    password_data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Смена пароля пользователя
    """
    try:
        # Проверяем текущий пароль
        if not verify_password(password_data.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный текущий пароль"
            )
        
        # Проверяем, что новый пароль отличается от старого
        if verify_password(password_data.new_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Новый пароль должен отличаться от текущего"
            )
        
        # Обновляем пароль
        current_user.hashed_password = get_password_hash(password_data.new_password)
        current_user.failed_login_attempts = 0  # Сбрасываем счетчик неудачных попыток
        
        db.commit()
        
        logger.info(f"Password changed for user: {str(current_user.id)}")
        return {
            "message": "Пароль успешно изменен",
            "user_id": str(str(current_user.id))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при смене пароля"
        )


@router.delete("/delete", response_model=dict)
async def delete_user_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Удаление аккаунта пользователя (мягкое удаление)
    """
    try:
        # Мягкое удаление - деактивируем аккаунт
        current_user.is_active = False
        current_user.email = f"deleted_{uuid.uuid4()}_{current_user.email}"
        
        db.commit()
        
        logger.info(f"User account deleted: {str(current_user.id)}")
        return {
            "message": "Аккаунт успешно удален",
            "user_id": str(str(current_user.id))
        }
        
    except Exception as e:
        logger.error(f"Error deleting user account: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при удалении аккаунта"
        )


@router.post("/avatar", response_model=dict)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Загрузка аватара пользователя
    """
    try:
        # Проверяем тип файла
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Файл должен быть изображением"
            )
        
        # Проверяем размер файла (макс 5MB)
        if file.size > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Размер файла не должен превышать 5MB"
            )
        
        # Создаем директорию для аватаров если её нет
        upload_dir = Path("static/avatars")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Генерируем уникальное имя файла
        file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{str(current_user.id)}_{uuid.uuid4()}.{file_extension}"
        file_path = upload_dir / filename
        
        # Сохраняем файл
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Обновляем URL аватара в базе данных
        avatar_url = f"/static/avatars/{filename}"
        current_user.avatar_url = avatar_url
        
        db.commit()
        
        logger.info(f"Avatar uploaded for user: {str(current_user.id)}")
        return {
            "message": "Аватар успешно загружен",
            "avatar_url": avatar_url,
            "user_id": str(str(current_user.id))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading avatar: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при загрузке аватара"
        )


@router.delete("/avatar", response_model=dict)
async def delete_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Удаление аватара пользователя
    """
    try:
        if current_user.avatar_url:
            # Удаляем файл с диска
            if current_user.avatar_url.startswith("/static/avatars/"):
                filename = current_user.avatar_url.replace("/static/avatars/", "")
                file_path = Path("static/avatars") / filename
                if file_path.exists():
                    file_path.unlink()
            
            # Удаляем URL из базы данных
            current_user.avatar_url = None
            db.commit()
            
            logger.info(f"Avatar deleted for user: {str(current_user.id)}")
            return {
                "message": "Аватар успешно удален",
                "user_id": str(str(current_user.id))
            }
        else:
            return {
                "message": "Аватар не установлен",
                "user_id": str(str(current_user.id))
            }
        
    except Exception as e:
        logger.error(f"Error deleting avatar: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при удалении аватара"
        )


