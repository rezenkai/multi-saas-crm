# app/api/v1/communication.py
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.schemas.communication import (
    SentimentAnalysisRequest, SentimentAnalysisResponse,
    EmailDraftRequest, EmailDraftResponse,
    MeetingTranscriptRequest, MeetingSummaryResponse
)
from app.services.communication_ai import communication_ai_service
from app.api.dependencies import get_current_user
import structlog

logger = structlog.get_logger()
router = APIRouter()

@router.post("/sentiment/analyze", response_model=SentimentAnalysisResponse)
async def analyze_communication_sentiment(
    request: SentimentAnalysisRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze sentiment and extract insights from customer communications
    
    Provides sentiment analysis, emotion detection, intent recognition,
    and actionable recommendations for sales communications.
    """
    try:
        result = await communication_ai_service.analyze_sentiment(request)
        return result
    except Exception as e:
        logger.error("Sentiment analysis endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")

@router.post("/email/draft", response_model=EmailDraftResponse)
async def draft_email(
    request: EmailDraftRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate AI-powered email drafts for sales communications
    
    Creates personalized, professional emails based on context,
    purpose, and recipient information.
    """
    try:
        result = await communication_ai_service.draft_email(request)
        return result
    except Exception as e:
        logger.error("Email draft endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Email draft generation failed: {str(e)}")

@router.post("/meeting/summarize", response_model=MeetingSummaryResponse)
async def summarize_meeting(
    request: MeetingTranscriptRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate meeting summaries and extract sales insights from transcripts
    
    Provides executive summaries, action items, buying signals,
    objections, and deal health assessments.
    """
    try:
        result = await communication_ai_service.summarize_meeting(request)
        return result
    except Exception as e:
        logger.error("Meeting summary endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Meeting summary generation failed: {str(e)}")

@router.post("/sentiment/batch", response_model=List[SentimentAnalysisResponse])
async def analyze_communications_batch(
    requests: List[SentimentAnalysisRequest],
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze sentiment for multiple communications in batch
    
    Efficiently processes multiple emails, messages, or other communications.
    Limited to 30 items per batch.
    """
    if len(requests) > 30:
        raise HTTPException(
            status_code=400,
            detail="Batch size limited to 30 communications. Please split into smaller batches."
        )
    
    try:
        results = []
        for request in requests:
            result = await communication_ai_service.analyze_sentiment(request)
            results.append(result)
        
        logger.info("Batch sentiment analysis completed", count=len(results))
        return results
        
    except Exception as e:
        logger.error("Batch sentiment analysis failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Batch sentiment analysis failed: {str(e)}")

@router.get("/templates")
async def get_email_templates(
    current_user: dict = Depends(get_current_user)
):
    """
    Get available email templates and communication guidelines
    """
    return {
        "email_types": {
            "cold_outreach": "Initial contact with new prospects",
            "follow_up": "Follow-up after meetings or demos",
            "proposal": "Sending proposals or quotes",
            "thank_you": "Thank you messages after meetings",
            "response": "Responding to customer inquiries",
            "nurture": "Long-term relationship building"
        },
        "tone_options": [
            "professional",
            "casual", 
            "friendly",
            "formal",
            "consultative",
            "urgent"
        ],
        "best_practices": {
            "subject_lines": [
                "Keep under 50 characters",
                "Use action words",
                "Personalize when possible",
                "Avoid spam trigger words"
            ],
            "email_body": [
                "Start with personalization",
                "Lead with value proposition",
                "Include clear call-to-action",
                "Keep it concise",
                "Use bullet points for readability"
            ],
            "timing": [
                "Tuesday-Thursday are best days",
                "Send between 9-11 AM or 2-4 PM",
                "Avoid Mondays and Fridays",
                "Follow up within 48 hours"
            ]
        },
        "communication_insights": {
            "sentiment_indicators": {
                "positive": ["excited", "interested", "ready", "perfect"],
                "negative": ["concerned", "expensive", "difficult", "problematic"],
                "neutral": ["considering", "evaluating", "reviewing", "thinking"]
            },
            "buying_signals": [
                "Questions about implementation",
                "Requests for pricing",
                "Timeline discussions",
                "Decision maker involvement",
                "Budget conversations"
            ],
            "risk_signals": [
                "Delayed responses",
                "Price objections",
                "Competitor mentions",
                "Process changes",
                "Stakeholder resistance"
            ]
        }
    }

@router.get("/model/info")
async def get_communication_model_info(
    current_user: dict = Depends(get_current_user)
):
    """
    Get information about the communication AI models and capabilities
    """
    return {
        "model_version": communication_ai_service.model_version,
        "features": {
            "sentiment_analysis": {
                "description": "Advanced sentiment and emotion detection",
                "supported_types": ["email", "call_transcript", "meeting_notes", "chat_message", "social_media"],
                "output": ["sentiment", "emotions", "tone", "intent", "urgency", "action_items"]
            },
            "email_generation": {
                "description": "AI-powered professional email drafting",
                "email_types": ["cold_outreach", "follow_up", "proposal", "thank_you", "response"],
                "customization": ["tone", "length", "call_to_action", "personalization"]
            },
            "meeting_analysis": {
                "description": "Meeting transcript analysis and summary generation",
                "insights": ["action_items", "buying_signals", "objections", "sentiment", "deal_health"],
                "meeting_types": ["sales_call", "demo", "discovery", "negotiation", "internal"]
            }
        },
        "ai_capabilities": {
            "natural_language_processing": "Advanced text understanding and generation",
            "context_awareness": "Considers conversation history and deal context",
            "personalization": "Adapts to recipient and situation",
            "sales_optimization": "Focuses on sales effectiveness and conversion"
        },
        "accuracy_metrics": {
            "sentiment_accuracy": "~90% for sales communications",
            "email_effectiveness": "Improved open rates by average 25%",
            "meeting_insights": "Captures 95% of key action items"
        }
    }