"""
Схемы для компаний
"""
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from enum import Enum


class CompanyType(str, Enum):
    """Типы компаний"""
    CUSTOMER = "CUSTOMER"
    PARTNER = "PARTNER"
    VENDOR = "VENDOR"
    COMPETITOR = "COMPETITOR"
    PROSPECT = "PROSPECT"


class CompanyBase(BaseModel):
    """Базовая схема компании"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    company_type: CompanyType = CompanyType.PROSPECT
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    website: Optional[str] = Field(None, max_length=500)
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    industry: Optional[str] = Field(None, max_length=100)
    size: Optional[str] = Field(None, max_length=50)
    company_size: Optional[str] = Field(None, max_length=50)
    legal_name: Optional[str] = Field(None, max_length=255)
    annual_revenue: Optional[float] = None
    linkedin_url: Optional[str] = Field(None, max_length=500)
    twitter_url: Optional[str] = Field(None, max_length=500)
    facebook_url: Optional[str] = Field(None, max_length=500)
    source: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class CompanyCreate(CompanyBase):
    """Схема для создания компании"""
    pass


class CompanyUpdate(BaseModel):
    """Схема для обновления компании"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    company_type: Optional[CompanyType] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    website: Optional[str] = Field(None, max_length=500)
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    industry: Optional[str] = Field(None, max_length=100)
    size: Optional[str] = Field(None, max_length=50)
    annual_revenue: Optional[str] = Field(None, max_length=100)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    twitter_url: Optional[str] = Field(None, max_length=500)
    facebook_url: Optional[str] = Field(None, max_length=500)
    source: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class CompanyResponse(CompanyBase):
    """Схема ответа с компанией"""
    id: str
    tenant_id: str
    owner_id: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_contacted: Optional[datetime] = None
    
    # Связанные данные
    owner_name: Optional[str] = None
    contacts_count: int = 0
    
    class Config:
        from_attributes = True


class CompanyListResponse(BaseModel):
    """Схема для списка компаний"""
    companies: List[CompanyResponse]
    total: int
    page: int
    size: int
    pages: int


class CompanyNoteBase(BaseModel):
    """Базовая схема заметки о компании"""
    title: Optional[str] = Field(None, max_length=255)
    content: str = Field(..., min_length=1)
    note_type: str = Field("general", max_length=50)


class CompanyNoteCreate(CompanyNoteBase):
    """Схема для создания заметки о компании"""
    pass


class CompanyNoteUpdate(BaseModel):
    """Схема для обновления заметки о компании"""
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    note_type: Optional[str] = Field(None, max_length=50)


class CompanyNoteResponse(CompanyNoteBase):
    """Схема ответа с заметкой о компании"""
    id: str
    company_id: str
    author_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Связанные данные
    author_name: Optional[str] = None
    
    class Config:
        from_attributes = True 