"""
Middleware для multi-tenancy и аутентификации
"""
from typing import Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
import logging
import time

from .database import set_tenant_context, get_current_tenant
from .config import settings

logger = logging.getLogger(__name__)


class TenantMiddleware:
    """
    Middleware для обработки multi-tenancy
    """
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            request = Request(scope, receive)
            
            # Получение tenant_id из заголовка или поддомена
            tenant_id = self._extract_tenant_id(request)
            
            if tenant_id:
                set_tenant_context(tenant_id)
                logger.info(f"Tenant context set: {tenant_id}")
            
            # Добавление tenant_id в scope для использования в других middleware
            scope["tenant_id"] = tenant_id
        
        await self.app(scope, receive, send)
    
    def _extract_tenant_id(self, request: Request) -> Optional[str]:
        """
        Извлечение tenant_id из запроса
        """
        # 1. Из заголовка X-Tenant-ID
        tenant_header = request.headers.get(settings.TENANT_HEADER)
        if tenant_header:
            return tenant_header
        
        # 2. Из поддомена
        host = request.headers.get("host", "")
        if "." in host:
            subdomain = host.split(".")[0]
            if subdomain and subdomain != "www":
                return subdomain
        
        # 3. Из query параметра
        tenant_query = request.query_params.get("tenant")
        if tenant_query:
            return tenant_query
        
        # 4. Дефолтный tenant
        return settings.DEFAULT_TENANT_ID


class AuthMiddleware:
    """
    Middleware для аутентификации
    """
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            request = Request(scope, receive)
            
            # Проверка аутентификации для защищенных маршрутов
            if self._is_protected_route(request.url.path):
                try:
                    # Здесь будет логика проверки JWT токена
                    user = await self._authenticate_user(request)
                    if user:
                        scope["user"] = user
                    else:
                        return await self._send_unauthorized_response(send)
                except Exception as e:
                    logger.error(f"Authentication error: {e}")
                    return await self._send_unauthorized_response(send)
        
        await self.app(scope, receive, send)
    
    def _is_protected_route(self, path: str) -> bool:
        """
        Проверка, является ли маршрут защищенным
        """
        # Публичные маршруты
        public_routes = [
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh",
            "/docs",
            "/openapi.json",
            "/health",
        ]
        
        return not any(path.startswith(route) for route in public_routes)
    
    async def _authenticate_user(self, request: Request):
        """
        Аутентификация пользователя по JWT токену
        """
        from .security import decode_token
        from jose import JWTError
        
        # Получение токена из заголовка Authorization
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header.split(" ")[1]
        
        try:
            # Декодирование токена
            payload = decode_token(token)
            
            # Проверка типа токена
            if payload.get("type") != "access":
                logger.warning("Invalid token type")
                return None
            
            # Возвращаем данные пользователя из токена
            return {
                "user_id": payload.get("sub"),
                "tenant_id": payload.get("tenant_id"),
                "role": payload.get("role")
            }
            
        except JWTError as e:
            logger.error(f"JWT validation error: {e}")
            return None
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return None
    
    async def _send_unauthorized_response(self, send):
        """
        Отправка ответа с ошибкой аутентификации
        """
        response = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Authentication required"}
        )
        await send(response.dict())


class LoggingMiddleware:
    """
    Middleware для логирования запросов
    """
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            request = Request(scope, receive)
            start_time = time.time()
            
            # Логирование входящего запроса
            tenant_id = get_current_tenant()
            logger.info(
                f"Request: {request.method} {request.url.path} "
                f"from {request.client.host} "
                f"tenant: {tenant_id}"
            )
            
            # Обработка запроса
            await self.app(scope, receive, send)
            
            # Логирование времени выполнения
            process_time = time.time() - start_time
            logger.info(f"Request processed in {process_time:.4f}s")
        else:
            await self.app(scope, receive, send)


class CORSMiddleware:
    """
    Middleware для CORS
    """
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            request = Request(scope, receive)
            
            # Проверка CORS
            origin = request.headers.get("origin")
            if origin and origin in settings.BACKEND_CORS_ORIGINS:
                # Добавление CORS заголовков
                scope["cors_headers"] = {
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
                    "Access-Control-Allow-Credentials": "true",
                }
        
        await self.app(scope, receive, send) 