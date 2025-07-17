"""
Схемы для пользователей
"""
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from uuid import UUID


class UserBase(BaseModel):
    """Базовая схема пользователя"""
    email: EmailStr
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    title: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = None
    timezone: str = Field(default="UTC", max_length=50)
    locale: str = Field(default="ru", max_length=10)
    theme: str = Field(default="light", max_length=20)


class UserCreate(UserBase):
    """Схема для создания пользователя"""
    password: str = Field(..., min_length=8)
    role: str = Field(default="user")
    
    class Config:
        schema_extra = {
            "example": {
                "email": "user@example.com",
                "username": "ivanov",
                "first_name": "Иван",
                "last_name": "Иванов",
                "password": "SecurePassword123!",
                "phone": "+7 999 123-45-67",
                "title": "Менеджер по продажам",
                "department": "Отдел продаж",
                "role": "user"
            }
        }


class UserUpdate(BaseModel):
    """Схема для обновления пользователя"""
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    title: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = Field(None, max_length=50)
    locale: Optional[str] = Field(None, max_length=10)
    theme: Optional[str] = Field(None, max_length=20)
    
    class Config:
        schema_extra = {
            "example": {
                "first_name": "Иван",
                "last_name": "Иванов",
                "phone": "+7 999 123-45-67",
                "title": "Старший менеджер по продажам",
                "department": "Отдел продаж",
                "bio": "Опытный менеджер с 5-летним стажем"
            }
        }


class UserResponse(UserBase):
    """Схема ответа с информацией о пользователе"""
    id: UUID
    is_active: bool
    is_verified: bool
    is_superuser: bool
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "user@example.com",
                "username": "ivanov",
                "first_name": "Иван",
                "last_name": "Иванов",
                "is_active": True,
                "is_verified": True,
                "is_superuser": False,
                "phone": "+7 999 123-45-67",
                "title": "Менеджер по продажам",
                "department": "Отдел продаж",
                "timezone": "Europe/Moscow",
                "locale": "ru",
                "theme": "light",
                "created_at": "2024-01-01T00:00:00Z"
            }
        }


class UserWithTenant(UserResponse):
    """Схема пользователя с информацией о tenant"""
    tenant_id: UUID
    tenant_name: str
    role: str
    permissions: List[str] = []
    
    class Config:
        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "user@example.com",
                "username": "ivanov",
                "first_name": "Иван",
                "last_name": "Иванов",
                "is_active": True,
                "is_verified": True,
                "is_superuser": False,
                "tenant_id": "456e7890-e89b-12d3-a456-426614174000",
                "tenant_name": "Моя компания",
                "role": "manager",
                "permissions": ["read:contacts", "write:contacts", "read:deals", "write:deals"],
                "created_at": "2024-01-01T00:00:00Z"
            }
        }


class UserProfileUpdate(BaseModel):
    """Схема для обновления профиля пользователя"""
    company: Optional[str] = Field(None, max_length=255)
    position: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    facebook_url: Optional[str] = None
    email_notifications: Optional[bool] = None
    sms_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    
    class Config:
        schema_extra = {
            "example": {
                "company": "ООО Рога и Копыта",
                "position": "Старший менеджер",
                "address": "ул. Пушкина, д. 10",
                "city": "Москва",
                "country": "Россия",
                "postal_code": "123456",
                "linkedin_url": "https://linkedin.com/in/ivanov",
                "email_notifications": True,
                "sms_notifications": False,
                "push_notifications": True
            }
        }


class UserSettingsUpdate(BaseModel):
    """Схема для обновления настроек пользователя"""
    timezone: Optional[str] = Field(None, max_length=50)
    locale: Optional[str] = Field(None, max_length=10)
    theme: Optional[str] = Field(None, max_length=20)
    email_notifications: Optional[bool] = None
    sms_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    marketing_notifications: Optional[bool] = None
    
    class Config:
        schema_extra = {
            "example": {
                "timezone": "Europe/Moscow",
                "locale": "ru",
                "theme": "dark",
                "email_notifications": True,
                "sms_notifications": False,
                "push_notifications": True,
                "marketing_notifications": False
            }
        }


class ChangePasswordRequest(BaseModel):
    """Схема для смены пароля"""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    new_password_confirm: str = Field(..., min_length=8)
    
    class Config:
        schema_extra = {
            "example": {
                "current_password": "OldPassword123!",
                "new_password": "NewPassword123!",
                "new_password_confirm": "NewPassword123!"
            }
        }


class UserList(BaseModel):
    """Схема для списка пользователей"""
    items: List[UserWithTenant]
    total: int
    page: int
    size: int
    pages: int
    
    class Config:
        schema_extra = {
            "example": {
                "items": [],
                "total": 100,
                "page": 1,
                "size": 20,
                "pages": 5
            }
        }
