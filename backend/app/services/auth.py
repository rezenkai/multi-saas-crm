"""
Сервис аутентификации
"""
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from fastapi import HTTPException, status, Request
import logging
from uuid import UUID

from ..models.user import User, UserSession
from ..models.tenant import Tenant, TenantUser
from ..core.security import (
    verify_password,
    get_password_hash,
    create_token_pair,
    decode_token,
    validate_password_strength,
    generate_verification_token
)
from ..schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    AuthUserResponse
)
from ..core.config import settings

logger = logging.getLogger(__name__)


class AuthService:
    """Сервис для работы с аутентификацией"""
    
    @staticmethod
    async def register(
        db: Session,
        request: RegisterRequest
    ) -> Dict[str, Any]:
        """
        Регистрация нового пользователя
        """
        # Проверка надежности пароля
        is_valid, message = validate_password_strength(request.password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
        
        # Проверка существования пользователя
        existing_user = db.query(User).filter(
            User.email == request.email
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
        
        # Создание нового tenant если указан
        tenant = None
        if request.tenant_name:
            # Проверка уникальности имени tenant
            existing_tenant = db.query(Tenant).filter(
                Tenant.name == request.tenant_name
            ).first()
            
            if existing_tenant:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Компания с таким названием уже существует"
                )
            
            # Создание tenant
            tenant = Tenant(
                name=request.tenant_name,
                subdomain=request.tenant_name.lower().replace(" ", "-"),
                is_active=True
            )
            db.add(tenant)
            db.flush()
        else:
            # Использование дефолтного tenant
            tenant = db.query(Tenant).filter(
                Tenant.id == settings.DEFAULT_TENANT_ID
            ).first()
            
            if not tenant:
                # Создание дефолтного tenant если не существует
                tenant = Tenant(
                    id=settings.DEFAULT_TENANT_ID,
                    name="Default",
                    subdomain="default",
                    is_active=True
                )
                db.add(tenant)
                db.flush()
        
        # Создание пользователя
        user = User(
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name,
            hashed_password=get_password_hash(request.password),
            is_active=True,
            is_verified=False
        )
        db.add(user)
        db.flush()
        
        # Связывание пользователя с tenant
        tenant_user = TenantUser(
            tenant_id=tenant.id,
            user_id=user.id,
            role="admin" if request.tenant_name else "user",
            is_active=True
        )
        db.add(tenant_user)
        
        # Создание токена верификации
        from ..models.token import VerificationToken
        from ..services.email import EmailService
        
        verification_token = generate_verification_token()
        verification_token_obj = VerificationToken.create_email_verification_token(
            user.id, verification_token
        )
        db.add(verification_token_obj)
        db.flush()
        
        # Отправка email верификации
        try:
            await EmailService.send_verification_email(
                user.email, 
                verification_token, 
                user.full_name
            )
        except Exception as e:
            logger.error(f"Failed to send verification email: {e}")
        
        db.commit()
        
        logger.info(f"New user registered: {user.email}")
        
        return {
            "user": user,
            "tenant": tenant,
            "verification_token": verification_token
        }
    
    @staticmethod
    async def login(
        db: Session,
        request: LoginRequest,
        req: Request = None
    ) -> TokenResponse:
        """
        Вход пользователя
        """
        # Поиск пользователя
        user = db.query(User).filter(
            User.email == request.email
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль"
            )
        
        # Проверка пароля
        
        if not verify_password(request.password, user.hashed_password):
            # Увеличение счетчика неудачных попыток
            if user.failed_login_attempts is None:
                user.failed_login_attempts = 0
            user.failed_login_attempts += 1
            
            # Блокировка после 5 неудачных попыток
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.utcnow() + timedelta(minutes=30)
                user.is_active = False
                db.commit()
                
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Аккаунт заблокирован из-за множественных неудачных попыток входа"
                )
            
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль"
            )
        
        # Проверка блокировки
        if user.locked_until and user.locked_until > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Аккаунт временно заблокирован"
            )
        
        # Проверка активности
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Аккаунт деактивирован"
            )
        
        # Определение tenant
        tenant_id = request.tenant_id
        if not tenant_id:
            # Получение первого активного tenant пользователя
            tenant_user = db.query(TenantUser).filter(
                and_(
                    TenantUser.user_id == user.id,
                    TenantUser.is_active == True
                )
            ).first()
            
            if not tenant_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="У пользователя нет доступа ни к одной компании"
                )
            
            tenant_id = str(tenant_user.tenant_id)
        else:
            # Проверка доступа к указанному tenant
            tenant_user = db.query(TenantUser).filter(
                and_(
                    TenantUser.user_id == user.id,
                    TenantUser.tenant_id == tenant_id,
                    TenantUser.is_active == True
                )
            ).first()
            
            if not tenant_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="У пользователя нет доступа к указанной компании"
                )
        
        # Сброс счетчика неудачных попыток
        user.failed_login_attempts = 0
        user.last_login = datetime.utcnow()
        
        # Создание токенов
        tokens = create_token_pair(
            user_id=str(user.id),
            tenant_id=tenant_id,
            role=tenant_user.role
        )
        
        # Создание сессии
        headers = req.headers if req else {}
        session = UserSession(
            user_id=user.id,
            session_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            expires_at=datetime.utcnow() + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            ),
            ip_address=headers.get("X-Forwarded-For", "unknown"),
            user_agent=headers.get("User-Agent", "unknown")
        )
        db.add(session)
        db.commit()
        
        logger.info(f"User logged in: {user.email}")
        
        return TokenResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    @staticmethod
    async def refresh_token(
        db: Session,
        refresh_token: str
    ) -> TokenResponse:
        """
        Обновление access токена
        """
        try:
            # Декодирование refresh токена
            payload = decode_token(refresh_token)
            
            if payload.get("type") != "refresh":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Неверный тип токена"
                )
            
            # Проверка сессии
            session = db.query(UserSession).filter(
                and_(
                    UserSession.refresh_token == refresh_token,
                    UserSession.is_active == True
                )
            ).first()
            
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Сессия не найдена или неактивна"
                )
            
            # Проверка пользователя
            user = db.query(User).filter(
                User.id == session.user_id
            ).first()
            
            if not user or not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Пользователь не найден или неактивен"
                )
            
            # Создание новых токенов
            tokens = create_token_pair(
                user_id=payload["sub"],
                tenant_id=payload["tenant_id"],
                role=payload["role"]
            )
            
            # Обновление сессии
            session.session_token = tokens["access_token"]
            session.refresh_token = tokens["refresh_token"]
            session.expires_at = datetime.utcnow() + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
            session.last_activity = datetime.utcnow()
            
            db.commit()
            
            return TokenResponse(
                access_token=tokens["access_token"],
                refresh_token=tokens["refresh_token"],
                token_type="bearer",
                expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
            )
            
        except Exception as e:
            logger.error(f"Token refresh error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Не удалось обновить токен"
            )
    
    @staticmethod
    async def logout(
        db: Session,
        user_id: str,
        session_token: str
    ) -> Dict[str, str]:
        """
        Выход пользователя
        """
        # Деактивация сессии
        from uuid import UUID
        user_uuid = UUID(user_id)
        session = db.query(UserSession).filter(
            and_(
                UserSession.user_id == user_uuid,
                UserSession.session_token == session_token,
                UserSession.is_active == True
            )
        ).first()
        
        if session:
            session.is_active = False
            db.commit()
        
        logger.info(f"User logged out: {user_id}")
        
        return {"message": "Выход выполнен успешно"}
    
    @staticmethod
    async def get_current_user(
        db: Session,
        user_id: str,
        tenant_id: str
    ) -> AuthUserResponse:
        """
        Получение текущего пользователя
        """
        # Получение пользователя с информацией о tenant
        from uuid import UUID
        user_uuid = UUID(user_id)
        tenant_uuid = UUID(tenant_id)
        
        user = db.query(User).filter(
            User.id == user_uuid
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        # Получение информации о tenant и роли
        tenant_user = db.query(TenantUser).filter(
            and_(
                TenantUser.user_id == user_uuid,
                TenantUser.tenant_id == tenant_uuid
            )
        ).first()
        
        if not tenant_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Связь пользователя с компанией не найдена"
            )
        
        tenant = db.query(Tenant).filter(
            Tenant.id == tenant_uuid
        ).first()
        
        # Получение разрешений на основе роли
        permissions = AuthService._get_role_permissions(tenant_user.role)
        
        return AuthUserResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            is_active=user.is_active,
            is_verified=user.is_verified,
            tenant_id=str(tenant.id),
            tenant_name=tenant.name,
            role=tenant_user.role,
            permissions=permissions,
            created_at=user.created_at
        )
    
    @staticmethod
    def _get_role_permissions(role: str) -> list[str]:
        """
        Получение разрешений для роли
        """
        role_permissions = {
            "admin": [
                "read:all",
                "write:all",
                "delete:all",
                "manage:users",
                "manage:settings"
            ],
            "manager": [
                "read:contacts",
                "write:contacts",
                "read:companies",
                "write:companies",
                "read:deals",
                "write:deals",
                "read:tasks",
                "write:tasks"
            ],
            "user": [
                "read:contacts",
                "write:contacts:own",
                "read:companies",
                "read:deals",
                "write:deals:own",
                "read:tasks:own",
                "write:tasks:own"
            ]
        }
        
        return role_permissions.get(role, [])
