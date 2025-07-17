"""
Модели контактов для CRM
"""
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum

from ..core.database import Base, settings


class ContactType(enum.Enum):
    LEAD = "LEAD"
    CUSTOMER = "CUSTOMER"
    PARTNER = "PARTNER"
    VENDOR = "VENDOR"
    EMPLOYEE = "EMPLOYEE"


class Contact(Base):
    """
    Модель контакта
    """
    __tablename__ = "contacts"
    
    if settings.DATABASE_URL.startswith("sqlite"):
        id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
        tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)
        owner_id = Column(String, ForeignKey("users.id"), nullable=False)
        company_id = Column(String, nullable=True)  # Временно убираем ForeignKey
    else:
        from sqlalchemy.dialects.postgresql import UUID
        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
        owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
        company_id = Column(UUID(as_uuid=True), nullable=True)  # Временно убираем ForeignKey
    
    # Основная информация
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(20))
    mobile = Column(String(20))
    
    # Тип контакта
    contact_type = Column(Enum(ContactType), default=ContactType.LEAD)
    
    # Дополнительная информация
    title = Column(String(100))
    department = Column(String(100))
    position = Column(String(100))
    
    # Адрес
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100))
    postal_code = Column(String(20))
    
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
    # tenant = relationship("Tenant", back_populates="contacts")
    # owner = relationship("User", back_populates="owned_contacts")
    # company = relationship("Company", back_populates="contacts")
    
    @property
    def full_name(self) -> str:
        """Полное имя контакта"""
        return f"{self.first_name} {self.last_name}".strip()
    
    def __repr__(self):
        return f"<Contact(id={self.id}, name='{self.full_name}', email='{self.email}')>"


class ContactNote(Base):
    """
    Заметки о контакте
    """
    __tablename__ = "contact_notes"
    
    if settings.DATABASE_URL.startswith("sqlite"):
        id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
        contact_id = Column(String, ForeignKey("contacts.id"), nullable=False)
        author_id = Column(String, ForeignKey("users.id"), nullable=False)
    else:
        from sqlalchemy.dialects.postgresql import UUID
        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False)
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
    # contact = relationship("Contact", back_populates="notes")
    # author = relationship("User", back_populates="contact_notes")
    
    def __repr__(self):
        return f"<ContactNote(id={self.id}, contact_id={self.contact_id}, type='{self.note_type}')>" 