"""
Схемы для сделок (opportunities)
"""
from typing import Optional, List, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from uuid import UUID


class OpportunityStage(str, Enum):
    """Стадии сделки"""
    PROSPECTING = "PROSPECTING"
    QUALIFICATION = "QUALIFICATION"
    PROPOSAL = "PROPOSAL"
    NEGOTIATION = "NEGOTIATION"
    CLOSED_WON = "CLOSED_WON"
    CLOSED_LOST = "CLOSED_LOST"


class OpportunityType(str, Enum):
    """Типы сделок"""
    NEW_BUSINESS = "NEW_BUSINESS"
    EXISTING_BUSINESS = "EXISTING_BUSINESS"
    RENEWAL = "RENEWAL"
    UPSELL = "UPSELL"
    CROSS_SELL = "CROSS_SELL"


class LeadSource(str, Enum):
    """Источники лидов"""
    WEBSITE = "WEBSITE"
    REFERRAL = "REFERRAL"
    COLD_CALL = "COLD_CALL"
    EMAIL = "EMAIL"
    SOCIAL_MEDIA = "SOCIAL_MEDIA"
    CONFERENCE = "CONFERENCE"
    PARTNER = "PARTNER"
    OTHER = "OTHER"


class OpportunityBase(BaseModel):
    """Базовая схема сделки"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    stage: OpportunityStage = OpportunityStage.PROSPECTING
    opportunity_type: OpportunityType = OpportunityType.NEW_BUSINESS
    lead_source: Optional[LeadSource] = None
    amount: Optional[Decimal] = Field(None, ge=0)
    probability: int = Field(0, ge=0, le=100)
    expected_revenue: Optional[Decimal] = Field(None, ge=0)
    close_date: Optional[date] = None
    next_step: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None
    company_id: Optional[str] = None
    contact_id: Optional[str] = None


class OpportunityCreate(OpportunityBase):
    """Схема для создания сделки"""
    pass


class OpportunityUpdate(BaseModel):
    """Схема для обновления сделки"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    stage: Optional[OpportunityStage] = None
    opportunity_type: Optional[OpportunityType] = None
    lead_source: Optional[LeadSource] = None
    amount: Optional[Decimal] = Field(None, ge=0)
    probability: Optional[int] = Field(None, ge=0, le=100)
    expected_revenue: Optional[Decimal] = Field(None, ge=0)
    close_date: Optional[date] = None
    actual_close_date: Optional[date] = None
    next_step: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    is_closed: Optional[bool] = None
    is_won: Optional[bool] = None


class OpportunityResponse(OpportunityBase):
    """Схема ответа с сделкой"""
    id: str
    tenant_id: str
    owner_id: str
    is_active: bool
    is_closed: bool
    is_won: bool
    actual_close_date: Optional[date] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_activity: Optional[datetime] = None
    
    # Связанные данные
    owner_name: Optional[str] = None
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    activities_count: int = 0
    
    @validator('id', 'tenant_id', 'owner_id', 'company_id', 'contact_id', pre=True)
    def convert_uuid_to_string(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True


class OpportunityListResponse(BaseModel):
    """Схема для списка сделок"""
    opportunities: List[OpportunityResponse]
    total: int
    page: int
    size: int
    pages: int


class OpportunityKanbanResponse(BaseModel):
    """Схема для канбан-доски сделок"""
    stage: OpportunityStage
    opportunities: List[OpportunityResponse]
    total: int


class OpportunityActivityBase(BaseModel):
    """Базовая схема активности по сделке"""
    activity_type: str = Field(..., max_length=50)
    subject: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    duration: Optional[int] = Field(None, ge=0)  # в минутах
    status: str = Field("pending", max_length=50)
    outcome: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class OpportunityActivityCreate(OpportunityActivityBase):
    """Схема для создания активности"""
    pass


class OpportunityActivityUpdate(BaseModel):
    """Схема для обновления активности"""
    activity_type: Optional[str] = Field(None, max_length=50)
    subject: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    duration: Optional[int] = Field(None, ge=0)
    status: Optional[str] = Field(None, max_length=50)
    outcome: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class OpportunityActivityResponse(OpportunityActivityBase):
    """Схема ответа с активностью"""
    id: str
    opportunity_id: str
    owner_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Связанные данные
    owner_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class OpportunityStats(BaseModel):
    """Статистика по сделкам"""
    total_opportunities: int
    total_amount: Decimal
    total_expected_revenue: Decimal
    won_opportunities: int
    won_amount: Decimal
    lost_opportunities: int
    lost_amount: Decimal
    active_opportunities: int
    active_amount: Decimal
    avg_probability: float
    avg_deal_size: Decimal
    conversion_rate: float  # процент выигранных сделок 