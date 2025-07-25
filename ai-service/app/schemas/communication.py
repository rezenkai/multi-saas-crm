from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class CommunicationType(str, Enum):
    EMAIL = "email"
    CALL_TRANSCRIPT = "call_transcript"
    MEETING_NOTES = "meeting_notes"
    CHAT_MESSAGE = "chat_message"
    SOCIAL_MEDIA = "social_media"

class SentimentAnalysisRequest(BaseModel):
    text: str = Field(..., description="Text content to analyze")
    communication_type: CommunicationType = CommunicationType.EMAIL
    sender: Optional[str] = None
    recipient: Optional[str] = None
    context: Optional[str] = Field(None, description="Additional context about the communication")

class SentimentAnalysisResponse(BaseModel):
    text: str
    communication_type: CommunicationType
    
    # Sentiment analysis
    sentiment: str = Field(..., description="positive|negative|neutral")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in sentiment prediction")
    emotions: List[str] = Field(default_factory=list, description="Detected emotions")
    
    # Communication insights
    tone: str = Field(..., description="professional|casual|urgent|friendly|aggressive")
    intent: str = Field(..., description="question|request|complaint|praise|information")
    urgency_level: str = Field(..., description="low|medium|high|critical")
    
    # Key insights
    key_topics: List[str] = Field(default_factory=list)
    action_items: List[str] = Field(default_factory=list)
    concerns_raised: List[str] = Field(default_factory=list)
    positive_signals: List[str] = Field(default_factory=list)
    
    # Recommendations
    suggested_response_tone: str
    next_best_actions: List[str] = Field(default_factory=list)
    escalation_needed: bool = False
    
    # Metadata
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)

class EmailDraftRequest(BaseModel):
    # Email context
    email_type: str = Field(..., description="follow_up|proposal|cold_outreach|response|thank_you")
    recipient_name: Optional[str] = None
    recipient_company: Optional[str] = None
    recipient_role: Optional[str] = None
    
    # Content requirements
    purpose: str = Field(..., description="Main purpose of the email")
    key_points: List[str] = Field(default_factory=list, description="Key points to include")
    tone: str = Field("professional", description="professional|casual|friendly|formal")
    call_to_action: Optional[str] = None
    
    # Context
    previous_conversation: Optional[str] = None
    meeting_context: Optional[str] = None
    deal_context: Optional[Dict[str, Any]] = None
    
    # Preferences
    max_length: int = Field(300, description="Maximum length in words")
    include_signature: bool = True

class EmailDraftResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    # Generated email
    subject_line: str
    email_body: str
    tone_used: str
    
    # Analysis
    estimated_reading_time: str
    key_messages: List[str] = Field(default_factory=list)
    persuasion_techniques: List[str] = Field(default_factory=list)
    
    # Improvements
    suggestions: List[str] = Field(default_factory=list)
    alternative_subject_lines: List[str] = Field(default_factory=list)
    
    # Metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    model_version: str = "1.0"

class MeetingTranscriptRequest(BaseModel):
    transcript: str = Field(..., description="Meeting transcript text")
    meeting_title: Optional[str] = None
    participants: List[str] = Field(default_factory=list)
    meeting_date: Optional[datetime] = None
    meeting_duration: Optional[int] = Field(None, description="Duration in minutes")
    meeting_type: str = Field("sales_call", description="sales_call|demo|discovery|negotiation|internal")

class MeetingSummaryResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    # Summary
    executive_summary: str
    key_decisions: List[str] = Field(default_factory=list)
    action_items: List[Dict[str, str]] = Field(default_factory=list)  # {"task": "...", "owner": "...", "due_date": "..."}
    
    # Sales insights
    customer_pain_points: List[str] = Field(default_factory=list)
    buying_signals: List[str] = Field(default_factory=list)
    objections_raised: List[str] = Field(default_factory=list)
    next_steps: List[str] = Field(default_factory=list)
    
    # Sentiment & engagement
    overall_sentiment: str
    engagement_level: str = Field(..., description="high|medium|low")
    key_quotes: List[str] = Field(default_factory=list)
    
    # Follow-up recommendations
    recommended_follow_up: str
    urgency_level: str = Field(..., description="low|medium|high|critical")
    deal_health_score: int = Field(..., ge=0, le=100)
    
    # Metadata
    participants: List[str] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    model_version: str = "1.0"
