from typing import Dict, Any, List
import structlog
from datetime import datetime
from app.services.openai_service import openai_service
from app.schemas.communication import (
    SentimentAnalysisRequest, SentimentAnalysisResponse, CommunicationType,
    EmailDraftRequest, EmailDraftResponse,
    MeetingTranscriptRequest, MeetingSummaryResponse
)
import json
import re

logger = structlog.get_logger()

class CommunicationAIService:
    def __init__(self):
        self.model_version = "1.0"
    
    async def analyze_sentiment(self, request: SentimentAnalysisRequest) -> SentimentAnalysisResponse:
        """Analyze sentiment and extract insights from communication"""
        
        logger.info("Analyzing communication sentiment", type=request.communication_type)
        
        analysis_prompt = f"""
        Analyze this {request.communication_type.value} communication and provide detailed insights in JSON format:
        
        Text: "{request.text}"
        
        Provide analysis in this exact JSON structure:
        {{
            "sentiment": "positive|negative|neutral",
            "confidence": 0.85,
            "emotions": ["excited", "concerned"],
            "tone": "professional|casual|urgent|friendly|aggressive",
            "intent": "question|request|complaint|praise|information",
            "urgency_level": "low|medium|high|critical",
            "key_topics": ["pricing", "timeline"],
            "action_items": ["follow up on pricing", "schedule demo"],
            "concerns_raised": ["budget constraints"],
            "positive_signals": ["interested in enterprise features"],
            "suggested_response_tone": "empathetic and solution-focused",
            "next_best_actions": ["address pricing concerns", "provide ROI analysis"],
            "escalation_needed": false
        }}
        """
        
        try:
            result = await openai_service.chat_completion([
                {"role": "system", "content": "You are an expert communication analyst specializing in sales and customer communications."},
                {"role": "user", "content": analysis_prompt}
            ], temperature=0.1)
            
            analysis = json.loads(result["content"])
            
            return SentimentAnalysisResponse(
                text=request.text,
                communication_type=request.communication_type,
                sentiment=analysis.get("sentiment", "neutral"),
                confidence=analysis.get("confidence", 0.5),
                emotions=analysis.get("emotions", []),
                tone=analysis.get("tone", "professional"),
                intent=analysis.get("intent", "information"),
                urgency_level=analysis.get("urgency_level", "medium"),
                key_topics=analysis.get("key_topics", []),
                action_items=analysis.get("action_items", []),
                concerns_raised=analysis.get("concerns_raised", []),
                positive_signals=analysis.get("positive_signals", []),
                suggested_response_tone=analysis.get("suggested_response_tone", "professional"),
                next_best_actions=analysis.get("next_best_actions", []),
                escalation_needed=analysis.get("escalation_needed", False)
            )
            
        except Exception as e:
            logger.error("Sentiment analysis failed", error=str(e))
            # Return fallback analysis
            return SentimentAnalysisResponse(
                text=request.text,
                communication_type=request.communication_type,
                sentiment="neutral",
                confidence=0.5,
                emotions=[],
                tone="professional",
                intent="information",
                urgency_level="medium",
                key_topics=[],
                action_items=[],
                concerns_raised=[],
                positive_signals=[],
                suggested_response_tone="professional",
                next_best_actions=["Follow up appropriately"],
                escalation_needed=False
            )
    
    async def draft_email(self, request: EmailDraftRequest) -> EmailDraftResponse:
        """Generate AI-powered email draft"""
        
        logger.info("Generating email draft", email_type=request.email_type)
        
        context_info = ""
        if request.previous_conversation:
            context_info += f"Previous conversation context: {request.previous_conversation}\n"
        if request.meeting_context:
            context_info += f"Meeting context: {request.meeting_context}\n"
        if request.deal_context:
            context_info += f"Deal context: {request.deal_context}\n"
        
        email_prompt = f"""
        Generate a professional {request.email_type} email with the following requirements:
        
        Recipient: {request.recipient_name or 'Valued Contact'} 
        Company: {request.recipient_company or 'their company'}
        Role: {request.recipient_role or 'their role'}
        Purpose: {request.purpose}
        Key points to include: {', '.join(request.key_points)}
        Tone: {request.tone}
        Call to action: {request.call_to_action or 'None specified'}
        Max length: {request.max_length} words
        
        {context_info}
        
        Provide response in JSON format:
        {{
            "subject_line": "Clear, compelling subject line",
            "email_body": "Professional email body without signature",
            "tone_used": "actual tone applied",
            "estimated_reading_time": "30 seconds",
            "key_messages": ["message1", "message2"],
            "persuasion_techniques": ["technique1", "technique2"],
            "suggestions": ["improvement1", "improvement2"],
            "alternative_subject_lines": ["alt1", "alt2", "alt3"]
        }}
        """
        
        try:
            result = await openai_service.chat_completion([
                {"role": "system", "content": "You are an expert sales copywriter and email marketing specialist."},
                {"role": "user", "content": email_prompt}
            ], temperature=0.3)
            
            email_data = json.loads(result["content"])
            
            return EmailDraftResponse(
                subject_line=email_data.get("subject_line", "Follow Up"),
                email_body=email_data.get("email_body", ""),
                tone_used=email_data.get("tone_used", request.tone),
                estimated_reading_time=email_data.get("estimated_reading_time", "1 minute"),
                key_messages=email_data.get("key_messages", []),
                persuasion_techniques=email_data.get("persuasion_techniques", []),
                suggestions=email_data.get("suggestions", []),
                alternative_subject_lines=email_data.get("alternative_subject_lines", []),
                model_version=self.model_version
            )
            
        except Exception as e:
            logger.error("Email draft generation failed", error=str(e))
            raise
    
    async def summarize_meeting(self, request: MeetingTranscriptRequest) -> MeetingSummaryResponse:
        """Generate meeting summary and extract sales insights"""
        
        logger.info("Summarizing meeting transcript", meeting_type=request.meeting_type)
        
        summary_prompt = f"""
        Analyze this {request.meeting_type} meeting transcript and provide a comprehensive summary:
        
        Meeting: {request.meeting_title or 'Sales Meeting'}
        Participants: {', '.join(request.participants) if request.participants else 'Not specified'}
        Duration: {request.meeting_duration or 'Not specified'} minutes
        
        Transcript:
        {request.transcript}
        
        Provide analysis in JSON format:
        {{
            "executive_summary": "Concise 2-3 sentence summary",
            "key_decisions": ["decision1", "decision2"],
            "action_items": [
                {{"task": "task description", "owner": "person", "due_date": "date or timeframe"}}
            ],
            "customer_pain_points": ["pain1", "pain2"],
            "buying_signals": ["signal1", "signal2"],
            "objections_raised": ["objection1", "objection2"],
            "next_steps": ["step1", "step2"],
            "overall_sentiment": "positive|negative|neutral",
            "engagement_level": "high|medium|low",
            "key_quotes": ["quote1", "quote2"],
            "recommended_follow_up": "specific follow-up recommendation",
            "urgency_level": "low|medium|high|critical",
            "deal_health_score": 75
        }}
        """
        
        try:
            result = await openai_service.chat_completion([
                {"role": "system", "content": "You are an expert sales analyst and meeting facilitator."},
                {"role": "user", "content": summary_prompt}
            ], temperature=0.2)
            
            summary_data = json.loads(result["content"])
            
            return MeetingSummaryResponse(
                executive_summary=summary_data.get("executive_summary", "Meeting summary not available"),
                key_decisions=summary_data.get("key_decisions", []),
                action_items=summary_data.get("action_items", []),
                customer_pain_points=summary_data.get("customer_pain_points", []),
                buying_signals=summary_data.get("buying_signals", []),
                objections_raised=summary_data.get("objections_raised", []),
                next_steps=summary_data.get("next_steps", []),
                overall_sentiment=summary_data.get("overall_sentiment", "neutral"),
                engagement_level=summary_data.get("engagement_level", "medium"),
                key_quotes=summary_data.get("key_quotes", []),
                recommended_follow_up=summary_data.get("recommended_follow_up", "Schedule follow-up meeting"),
                urgency_level=summary_data.get("urgency_level", "medium"),
                deal_health_score=summary_data.get("deal_health_score", 50),
                participants=request.participants,
                model_version=self.model_version
            )
            
        except Exception as e:
            logger.error("Meeting summary generation failed", error=str(e))
            raise

# Global communication AI service instance
communication_ai_service = CommunicationAIService()