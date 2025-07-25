from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class LeadSource(str, Enum):
    WEBSITE = "website"
    EMAIL = "email"
    SOCIAL = "social"
    REFERRAL = "referral"
    COLD_OUTREACH = "cold_outreach"
    EVENT = "event"
    OTHER = "other"

class LeadScoreRequest(BaseModel):
    # Lead basic information
    email: str = Field(..., description="Lead email address")
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    
    # Lead source and behavior
    source: LeadSource = LeadSource.OTHER
    website_visits: int = Field(0, ge=0, description="Number of website visits")
    pages_viewed: int = Field(0, ge=0, description="Number of pages viewed")
    time_on_site: int = Field(0, ge=0, description="Time spent on site in minutes")
    downloads: int = Field(0, ge=0, description="Number of content downloads")
    email_opens: int = Field(0, ge=0, description="Number of email opens")
    email_clicks: int = Field(0, ge=0, description="Number of email clicks")
    
    # Company information
    company_size: Optional[str] = Field(None, description="Company size category")
    industry: Optional[str] = None
    annual_revenue: Optional[str] = Field(None, description="Annual revenue range")
    location: Optional[str] = None
    
    # Engagement data
    last_activity: Optional[datetime] = None
    notes: Optional[str] = Field(None, description="Additional notes about the lead")
    
    # Custom fields
    custom_fields: Optional[Dict[str, Any]] = Field(default_factory=dict)

class LeadScoreResponse(BaseModel):
    # Fix Pydantic warning by allowing protected namespaces
    model_config = ConfigDict(protected_namespaces=())
    
    lead_id: str
    email: str
    score: int = Field(..., ge=0, le=100, description="Lead score from 0-100")
    score_category: str = Field(..., description="Hot, Warm, Cold")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in score")
    
    # Score breakdown
    demographic_score: int = Field(..., ge=0, le=30)
    behavioral_score: int = Field(..., ge=0, le=40)
    engagement_score: int = Field(..., ge=0, le=30)
    
    # AI insights
    ai_insights: Dict[str, Any] = Field(default_factory=dict)
    next_best_actions: List[str] = Field(default_factory=list)
    
    # Metadata
    scored_at: datetime = Field(default_factory=datetime.utcnow)
    model_version: str = "1.0"