from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class OpportunityStage(str, Enum):
    PROSPECTING = "prospecting"
    QUALIFICATION = "qualification"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"

class OpportunityPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class OpportunityInsightRequest(BaseModel):
    # Opportunity basic info
    opportunity_id: str
    name: str
    value: float = Field(..., gt=0, description="Deal value in USD")
    stage: OpportunityStage
    probability: float = Field(..., ge=0, le=100, description="Current probability %")
    close_date: datetime = Field(..., description="Expected close date")
    
    # Customer info
    account_name: str
    industry: Optional[str] = None
    company_size: Optional[str] = None
    decision_maker_title: Optional[str] = None
    
    # Sales activity data
    days_in_current_stage: int = Field(0, ge=0)
    last_activity_date: Optional[datetime] = None
    meetings_count: int = Field(0, ge=0)
    emails_sent: int = Field(0, ge=0)
    emails_opened: int = Field(0, ge=0)
    proposal_sent: bool = False
    demo_completed: bool = False
    
    # Competitive & context
    competitors: List[str] = Field(default_factory=list)
    pain_points: List[str] = Field(default_factory=list)
    budget_confirmed: bool = False
    decision_timeline: Optional[str] = None
    
    # Historical context
    similar_deals_won: int = Field(0, ge=0)
    similar_deals_lost: int = Field(0, ge=0)
    
    # Notes and context
    notes: Optional[str] = None

class OpportunityInsightResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    opportunity_id: str
    name: str
    
    # AI-powered predictions
    win_probability: float = Field(..., ge=0, le=100, description="AI-predicted win probability")
    risk_score: float = Field(..., ge=0, le=100, description="Risk of losing the deal")
    forecasted_close_date: datetime
    confidence_level: float = Field(..., ge=0, le=1, description="Prediction confidence")
    
    # Deal insights
    key_success_factors: List[str] = Field(default_factory=list)
    risk_factors: List[str] = Field(default_factory=list)
    competitive_threats: List[str] = Field(default_factory=list)
    
    # Recommended actions
    next_best_actions: List[str] = Field(default_factory=list)
    urgency_level: str = Field(..., description="low|medium|high|critical")
    
    # Sales coaching
    coaching_tips: List[str] = Field(default_factory=list)
    similar_deals_analysis: Dict[str, Any] = Field(default_factory=dict)
    
    # Forecasting data
    forecast_category: str = Field(..., description="commit|best_case|pipeline|omit")
    revenue_impact: float
    
    # Metadata
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)
    model_version: str = "1.0"