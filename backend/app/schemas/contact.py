"""
Схемы для контактов
"""
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from enum import Enum


class ContactType(str, Enum):
    LEAD = "LEAD"
    CUSTOMER = "CUSTOMER"
    PARTNER = "PARTNER"
    VENDOR = "VENDOR"
    EMPLOYEE = "EMPLOYEE"


class ContactBase(BaseModel):
    """Базовая схема контакта"""
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    mobile: Optional[str] = Field(None, max_length=20)
    contact_type: ContactType = ContactType.LEAD
    title: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    twitter_url: Optional[str] = Field(None, max_length=500)
    facebook_url: Optional[str] = Field(None, max_length=500)
    source: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    company_id: Optional[str] = None


class ContactCreate(ContactBase):
    """Схема для создания контакта"""
    pass


class ContactUpdate(BaseModel):
    """Схема для обновления контакта"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    mobile: Optional[str] = Field(None, max_length=20)
    contact_type: Optional[ContactType] = None
    title: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    twitter_url: Optional[str] = Field(None, max_length=500)
    facebook_url: Optional[str] = Field(None, max_length=500)
    source: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    company_id: Optional[str] = None


class ContactResponse(ContactBase):
    """Схема ответа с контактом"""
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
    company_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class ContactListResponse(BaseModel):
    """Схема для списка контактов"""
    contacts: List[ContactResponse]
    total: int
    page: int
    size: int
    pages: int


class ContactNoteBase(BaseModel):
    """Базовая схема заметки о контакте"""
    title: Optional[str] = Field(None, max_length=255)
    content: str = Field(..., min_length=1)
    note_type: str = Field("general", max_length=50)


class ContactNoteCreate(ContactNoteBase):
    """Схема для создания заметки о контакте"""
    pass


class ContactNoteUpdate(BaseModel):
    """Схема для обновления заметки о контакте"""
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    note_type: Optional[str] = Field(None, max_length=50)


class ContactNoteResponse(ContactNoteBase):
    """Схема ответа с заметкой о контакте"""
    id: str
    contact_id: str
    author_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Связанные данные
    author_name: Optional[str] = None
    
    class Config:
        from_attributes = True 