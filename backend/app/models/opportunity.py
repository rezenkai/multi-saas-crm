"""
Модели для сделок (opportunities) в CRM
"""
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, ForeignKey, Enum, Numeric, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum

from ..core.database import Base, settings


class OpportunityStage(enum.Enum):
    """Стадии сделки"""
    PROSPECTING = "PROSPECTING"
    QUALIFICATION = "QUALIFICATION"
    PROPOSAL = "PROPOSAL"
    NEGOTIATION = "NEGOTIATION"
    CLOSED_WON = "CLOSED_WON"
    CLOSED_LOST = "CLOSED_LOST"


class OpportunityType(enum.Enum):
    """Типы сделок"""
    NEW_BUSINESS = "NEW_BUSINESS"
    EXISTING_BUSINESS = "EXISTING_BUSINESS"
    RENEWAL = "RENEWAL"
    UPSELL = "UPSELL"
    CROSS_SELL = "CROSS_SELL"


class LeadSource(enum.Enum):
    """Источники лидов"""
    WEBSITE = "WEBSITE"
    REFERRAL = "REFERRAL"
    COLD_CALL = "COLD_CALL"
    EMAIL = "EMAIL"
    SOCIAL_MEDIA = "SOCIAL_MEDIA"
    CONFERENCE = "CONFERENCE"
    PARTNER = "PARTNER"
    OTHER = "OTHER"


class Opportunity(Base):
    """
    Модель сделки
    """
    __tablename__ = "opportunities"
    
    if settings.DATABASE_URL.startswith("sqlite"):
        id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
        tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)
        owner_id = Column(String, ForeignKey("users.id"), nullable=False)
        company_id = Column(String, ForeignKey("companies.id"), nullable=True)
        contact_id = Column(String, ForeignKey("contacts.id"), nullable=True)
    else:
        from sqlalchemy.dialects.postgresql import UUID
        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
        owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
        company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True)
        contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True)
    
    # Основная информация
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    
    # Стадия и тип
    stage = Column(Enum(OpportunityStage), default=OpportunityStage.PROSPECTING)
    opportunity_type = Column(Enum(OpportunityType), default=OpportunityType.NEW_BUSINESS)
    lead_source = Column(Enum(LeadSource), nullable=True)
    
    # Финансовая информация
    amount = Column(Numeric(15, 2), nullable=True)  # Сумма сделки
    probability = Column(Integer, default=0)  # Вероятность закрытия (0-100)
    expected_revenue = Column(Numeric(15, 2), nullable=True)  # Ожидаемая выручка
    
    # Даты
    close_date = Column(Date, nullable=True)  # Ожидаемая дата закрытия
    actual_close_date = Column(Date, nullable=True)  # Фактическая дата закрытия
    
    # Дополнительная информация
    next_step = Column(String(500))  # Следующий шаг
    notes = Column(Text)
    
    # Статус
    is_active = Column(Boolean, default=True)
    is_closed = Column(Boolean, default=False)
    is_won = Column(Boolean, default=False)
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_activity = Column(DateTime(timezone=True))
    
    # Связи
    # tenant = relationship("Tenant", back_populates="opportunities")
    # owner = relationship("User", back_populates="owned_opportunities")
    # company = relationship("Company", back_populates="opportunities")
    # contact = relationship("Contact", back_populates="opportunities")
    # activities = relationship("OpportunityActivity", back_populates="opportunity")
    
    def __repr__(self):
        return f"<Opportunity(id={self.id}, name='{self.name}', stage='{self.stage}')>"


class OpportunityActivity(Base):
    """
    Активности по сделке (звонки, встречи, задачи)
    """
    __tablename__ = "opportunity_activities"
    
    if settings.DATABASE_URL.startswith("sqlite"):
        id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
        opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=False)
        owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    else:
        from sqlalchemy.dialects.postgresql import UUID
        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id"), nullable=False)
        owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Тип активности
    activity_type = Column(String(50), nullable=False)  # call, meeting, email, task, note
    
    # Содержание
    subject = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Время
    scheduled_date = Column(DateTime(timezone=True), nullable=True)
    completed_date = Column(DateTime(timezone=True), nullable=True)
    duration = Column(Integer, nullable=True)  # в минутах
    
    # Статус
    status = Column(String(50), default="pending")  # pending, completed, cancelled
    
    # Результат
    outcome = Column(String(100))  # positive, negative, neutral
    notes = Column(Text)
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    # opportunity = relationship("Opportunity", back_populates="activities")
    # owner = relationship("User", back_populates="opportunity_activities")
    
    def __repr__(self):
        return f"<OpportunityActivity(id={self.id}, type='{self.activity_type}', subject='{self.subject}')>" 