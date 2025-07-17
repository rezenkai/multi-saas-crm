"""
Схемы для аутентификации
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime


class TokenData(BaseModel):
    """Данные JWT токена"""
    sub: str
    exp: Optional[datetime] = None
    type: Optional[str] = None
    tenant_id: Optional[str] = None
    role: Optional[str] = None
    jti: Optional[str] = None


class LoginRequest(BaseModel):
    """Запрос на вход"""
    email: EmailStr
    password: str = Field(..., min_length=1)
    tenant_id: Optional[str] = None
    
    class Config:
        schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "SecurePassword123!",
                "tenant_id": "company-abc"
            }
        }


class RegisterRequest(BaseModel):
    """Запрос на регистрацию"""
    email: EmailStr
    password: str = Field(..., min_length=8)
    password_confirm: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    tenant_name: Optional[str] = Field(None, min_length=3, max_length=255)
    
    @validator('password_confirm')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Пароли не совпадают')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "SecurePassword123!",
                "password_confirm": "SecurePassword123!",
                "first_name": "Иван",
                "last_name": "Иванов",
                "tenant_name": "Моя компания"
            }
        }


class TokenResponse(BaseModel):
    """Ответ с токенами"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Время жизни access токена в секундах")
    
    class Config:
        schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "expires_in": 1800
            }
        }


class RefreshTokenRequest(BaseModel):
    """Запрос на обновление токена"""
    refresh_token: str
    
    class Config:
        schema_extra = {
            "example": {
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
        }


class ChangePasswordRequest(BaseModel):
    """Запрос на смену пароля"""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    new_password_confirm: str = Field(..., min_length=8)
    
    @validator('new_password_confirm')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Новые пароли не совпадают')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "current_password": "OldPassword123!",
                "new_password": "NewSecurePassword123!",
                "new_password_confirm": "NewSecurePassword123!"
            }
        }


class ForgotPasswordRequest(BaseModel):
    """Запрос на восстановление пароля"""
    email: EmailStr
    
    class Config:
        schema_extra = {
            "example": {
                "email": "user@example.com"
            }
        }


class ResetPasswordRequest(BaseModel):
    """Запрос на сброс пароля"""
    token: str
    new_password: str = Field(..., min_length=8)
    new_password_confirm: str = Field(..., min_length=8)
    
    @validator('new_password_confirm')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Пароли не совпадают')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "token": "reset-token-here",
                "new_password": "NewSecurePassword123!",
                "new_password_confirm": "NewSecurePassword123!"
            }
        }


class VerifyEmailRequest(BaseModel):
    """Запрос на подтверждение email"""
    token: str
    
    class Config:
        schema_extra = {
            "example": {
                "token": "verification-token-here"
            }
        }


class AuthUserResponse(BaseModel):
    """Ответ с информацией о пользователе после аутентификации"""
    id: str
    email: str
    first_name: str
    last_name: str
    is_active: bool
    is_verified: bool
    tenant_id: str
    tenant_name: str
    role: str
    permissions: list[str] = []
    created_at: datetime
    
    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "user@example.com",
                "first_name": "Иван",
                "last_name": "Иванов",
                "is_active": True,
                "is_verified": True,
                "tenant_id": "company-abc",
                "tenant_name": "Моя компания",
                "role": "user",
                "permissions": ["read:contacts", "write:contacts"],
                "created_at": "2024-01-01T00:00:00Z"
            }
        }
