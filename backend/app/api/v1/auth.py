"""
API endpoints для аутентификации
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from ...core.database import get_db
from ...core.deps import get_current_user, get_current_active_user
from ...schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    RefreshTokenRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
    AuthUserResponse
)
from ...services.auth import AuthService
from ...models.user import User
from ...models.tenant import Tenant, TenantUser

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Регистрация нового пользователя
    
    - **email**: Email пользователя (уникальный)
    - **password**: Пароль (минимум 8 символов)
    - **password_confirm**: Подтверждение пароля
    - **first_name**: Имя
    - **last_name**: Фамилия
    - **tenant_name**: Название компании (опционально, создаст новый tenant)
    """
    try:
        result = await AuthService.register(db, request)
        
        return {
            "message": "Регистрация успешна. Проверьте email для подтверждения.",
            "user_id": str(result["user"].id),
            "tenant_id": str(result["tenant"].id),
            "verification_token": result["verification_token"]  # В продакшене отправлять по email
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        import traceback
        logger.error(f"Registration traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при регистрации: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    req: Request,
    db: Session = Depends(get_db)
):
    """
    Вход пользователя
    
    - **email**: Email пользователя
    - **password**: Пароль
    - **tenant_id**: ID компании (опционально)
    
    Возвращает JWT токены для доступа к API
    """
    try:
        return await AuthService.login(db, request, req)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при входе"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Обновление access токена
    
    - **refresh_token**: Refresh токен
    
    Возвращает новую пару токенов
    """
    try:
        return await AuthService.refresh_token(db, request.refresh_token)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при обновлении токена"
        )


@router.post("/logout", response_model=dict)
async def logout(
    current_user: AuthUserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Выход пользователя
    
    Деактивирует текущую сессию
    """
    try:
        # Получаем токен из текущего запроса
        # В реальном приложении нужно получить токен из заголовка
        result = await AuthService.logout(
            db,
            user_id=current_user.id,
            session_token=""  # TODO: получить из заголовка
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при выходе"
        )


@router.get("/me", response_model=AuthUserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Получение информации о текущем пользователе
    
    Требует валидный access токен
    """
    # Получаем информацию о tenant пользователя
    tenant_user = db.query(TenantUser).filter(
        TenantUser.user_id == current_user.id
    ).first()
    
    if not tenant_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Информация о tenant не найдена"
        )
    
    tenant = db.query(Tenant).filter(Tenant.id == tenant_user.tenant_id).first()
    
    return AuthUserResponse(
        id=str(current_user.id),
        email=current_user.email,
        first_name=current_user.first_name or "",
        last_name=current_user.last_name or "",
        is_active=current_user.is_active,
        is_verified=current_user.is_verified or False,
        tenant_id=str(tenant_user.tenant_id),
        tenant_name=tenant.name if tenant else "",
        role=tenant_user.role or "user",
        permissions=[],
        created_at=current_user.created_at
    )


@router.post("/change-password", response_model=dict)
async def change_password(
    request: ChangePasswordRequest,
    current_user: AuthUserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Смена пароля пользователя
    
    - **current_password**: Текущий пароль
    - **new_password**: Новый пароль
    - **new_password_confirm**: Подтверждение нового пароля
    """
    try:
        from ...core.security import verify_password, get_password_hash
        from ...models.user import User
        
        # Получаем полный объект пользователя из БД
        user = db.query(User).filter(User.id == current_user.id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        # Проверяем подтверждение пароля
        if request.new_password != request.new_password_confirm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Новые пароли не совпадают"
            )
        
        # Проверяем текущий пароль
        if not verify_password(request.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный текущий пароль"
            )
        
        # Проверяем, что новый пароль отличается от старого
        if verify_password(request.new_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Новый пароль должен отличаться от текущего"
            )
        
        # Обновляем пароль
        user.hashed_password = get_password_hash(request.new_password)
        user.failed_login_attempts = 0  # Сбрасываем счетчик неудачных попыток
        
        db.commit()
        
        logger.info(f"Password changed for user: {user.id}")
        return {
            "message": "Пароль успешно изменен",
            "user_id": str(user.id)
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




@router.post("/forgot-password", response_model=dict)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Запрос на восстановление пароля
    
    - **email**: Email пользователя
    
    Отправляет ссылку для сброса пароля на email
    """
    try:
        from ...models.token import VerificationToken
        from ...models.user import User
        from ...services.email import EmailService
        from ...core.security import generate_verification_token
        
        # Поиск пользователя
        user = db.query(User).filter(User.email == request.email).first()
        
        # Всегда возвращаем успех для безопасности (не раскрываем существование email)
        if not user:
            return {"message": "Если email существует, инструкции отправлены"}
        
        # Деактивируем старые токены сброса пароля
        old_tokens = db.query(VerificationToken).filter(
            VerificationToken.user_id == user.id,
            VerificationToken.token_type == "password_reset",
            VerificationToken.used == False
        ).all()
        
        for token in old_tokens:
            token.used = True
        
        # Создание нового токена
        reset_token = generate_verification_token()
        reset_token_obj = VerificationToken.create_password_reset_token(
            user.id, reset_token
        )
        db.add(reset_token_obj)
        db.commit()
        
        # Отправка email
        try:
            await EmailService.send_password_reset_email(
                user.email,
                reset_token,
                user.full_name
            )
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
        
        return {"message": "Если email существует, инструкции отправлены"}
        
    except Exception as e:
        logger.error(f"Password reset error: {e}")
        return {"message": "Если email существует, инструкции отправлены"}


@router.post("/reset-password", response_model=dict)
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Сброс пароля
    
    - **token**: Токен сброса пароля
    - **new_password**: Новый пароль
    - **new_password_confirm**: Подтверждение нового пароля
    """
    try:
        from ...models.token import VerificationToken
        from ...models.user import User
        from ...core.security import get_password_hash, validate_password_strength
        
        # Проверка совпадения паролей
        if request.new_password != request.new_password_confirm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пароли не совпадают"
            )
        
        # Проверка надежности пароля
        is_valid, message = validate_password_strength(request.new_password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
        
        # Поиск токена
        token_obj = db.query(VerificationToken).filter(
            VerificationToken.token == request.token,
            VerificationToken.token_type == "password_reset"
        ).first()
        
        if not token_obj or not token_obj.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недействительный или истекший токен"
            )
        
        # Получение пользователя
        user = db.query(User).filter(User.id == token_obj.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        # Обновление пароля
        user.hashed_password = get_password_hash(request.new_password)
        user.failed_login_attempts = 0  # Сброс счетчика неудачных попыток
        user.locked_until = None  # Разблокировка аккаунта
        
        # Отметка токена как использованного
        token_obj.used = True
        token_obj.used_at = datetime.utcnow()
        
        db.commit()
        
        return {"message": "Пароль успешно сброшен"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при сбросе пароля"
        )


@router.post("/verify-email", response_model=dict)
async def verify_email(
    request: VerifyEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Подтверждение email
    
    - **token**: Токен подтверждения
    """
    try:
        from ...models.token import VerificationToken
        from ...models.user import User
        from ...services.email import EmailService
        
        # Поиск токена
        token_obj = db.query(VerificationToken).filter(
            VerificationToken.token == request.token,
            VerificationToken.token_type == "email_verification"
        ).first()
        
        if not token_obj or not token_obj.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недействительный или истекший токен"
            )
        
        # Получение пользователя
        user = db.query(User).filter(User.id == token_obj.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        # Подтверждение email
        user.is_verified = True
        token_obj.used = True
        token_obj.used_at = datetime.utcnow()
        
        db.commit()
        
        # Отправка приветственного email
        try:
            tenant_name = "Salesforce Clone"  # Можно получить из связи
            await EmailService.send_welcome_email(
                user.email,
                user.full_name,
                tenant_name
            )
        except Exception as e:
            logger.error(f"Failed to send welcome email: {e}")
        
        return {"message": "Email успешно подтвержден"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при подтверждении email"
        )


@router.get("/check-email/{email}", response_model=dict)
async def check_email_availability(
    email: str,
    db: Session = Depends(get_db)
):
    """
    Проверка доступности email
    
    - **email**: Email для проверки
    """
    from ...models.user import User
    
    exists = db.query(User).filter(User.email == email).first() is not None
    
    return {
        "email": email,
        "available": not exists
    }
