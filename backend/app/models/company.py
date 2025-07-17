"""
Модели компаний для CRM
"""
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from sqlalchemy.types import Numeric

from ..core.database import Base, settings


class CompanyType(enum.Enum):
    """Типы компаний"""
    CUSTOMER = "CUSTOMER"
    PARTNER = "PARTNER"
    VENDOR = "VENDOR"
    COMPETITOR = "COMPETITOR"
    PROSPECT = "PROSPECT"


class Company(Base):
    """
    Модель компании
    """
    __tablename__ = "companies"
    
    if settings.DATABASE_URL.startswith("sqlite"):
        id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
        tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)
        owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    else:
        from sqlalchemy.dialects.postgresql import UUID
        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
        owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Основная информация
    name = Column(String(255), nullable=False, index=True)
    legal_name = Column(String(255))  # Юридическое название
    description = Column(Text)
    
    # Тип компании
    company_type = Column(Enum(CompanyType), default=CompanyType.PROSPECT)
    
    # Контактная информация
    email = Column(String(255))
    phone = Column(String(20))
    website = Column(String(500))
    
    # Адрес
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100))
    postal_code = Column(String(20))
    
    # Дополнительная информация
    industry = Column(String(100))
    size = Column(String(50))  # small, medium, large
    company_size = Column(String(50))  # STARTUP, SMALL, MEDIUM, LARGE, ENTERPRISE
    annual_revenue = Column(Numeric(15, 2))  # Годовой доход как число
    
    # Социальные сети
    linkedin_url = Column(String(500))
    twitter_url = Column(String(500))
    facebook_url = Column(String(500))
    
    # Статус
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Источник
    source = Column(String(100))  # website, referral, cold_call, etc.
    notes = Column(Text)
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_contacted = Column(DateTime(timezone=True))
    
    # Связи
    # tenant = relationship("Tenant", back_populates="companies")
    # owner = relationship("User", back_populates="owned_companies")
    # contacts = relationship("Contact", back_populates="company")
    
    def __repr__(self):
        return f"<Company(id={self.id}, name='{self.name}', type='{self.company_type}')>"


class CompanyNote(Base):
    """
    Заметки о компании
    """
    __tablename__ = "company_notes"
    
    if settings.DATABASE_URL.startswith("sqlite"):
        id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
        company_id = Column(String, ForeignKey("companies.id"), nullable=False)
        author_id = Column(String, ForeignKey("users.id"), nullable=False)
    else:
        from sqlalchemy.dialects.postgresql import UUID
        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
        author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Содержание
    title = Column(String(255))
    content = Column(Text, nullable=False)
    
    # Тип заметки
    note_type = Column(String(50), default="general")  # general, call, meeting, email
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    # company = relationship("Company", back_populates="notes")
    # author = relationship("User", back_populates="company_notes")
    
    def __repr__(self):
        return f"<CompanyNote(id={self.id}, company_id={self.company_id}, type='{self.note_type}')>" 