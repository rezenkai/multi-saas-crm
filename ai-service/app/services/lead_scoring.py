from typing import Dict, Any, List
import structlog
from datetime import datetime, timedelta
from app.services.openai_service import openai_service
from app.schemas.lead_score import LeadScoreRequest, LeadScoreResponse, LeadSource
import json

logger = structlog.get_logger()

class LeadScoringService:
    def __init__(self):
        self.model_version = "1.0"
        
        # Scoring weights
        self.demographic_weights = {
            "job_title": 10,
            "company_size": 8,
            "industry": 7,
            "annual_revenue": 5
        }
        
        self.behavioral_weights = {
            "website_visits": 8,
            "pages_viewed": 6,
            "time_on_site": 5,
            "downloads": 10,
            "recency": 11
        }
        
        self.engagement_weights = {
            "email_opens": 6,
            "email_clicks": 10,
            "source_quality": 8,
            "activity_consistency": 6
        }
    
    def _calculate_demographic_score(self, lead: LeadScoreRequest) -> int:
        """Calculate demographic-based score"""
        score = 0
        
        # Job title scoring
        if lead.job_title:
            high_value_titles = [
                "ceo", "cto", "cfo", "vp", "director", "head", "manager", 
                "founder", "owner", "president", "chief"
            ]
            if any(title in lead.job_title.lower() for title in high_value_titles):
                score += 10
            else:
                score += 5
        
        # Company size scoring
        if lead.company_size:
            size_scores = {
                "enterprise": 8,
                "large": 7,
                "medium": 6,
                "small": 4,
                "startup": 3
            }
            score += size_scores.get(lead.company_size.lower(), 2)
        
        # Industry scoring (customize based on your target industries)
        if lead.industry:
            high_value_industries = ["technology", "finance", "healthcare", "manufacturing"]
            if any(industry in lead.industry.lower() for industry in high_value_industries):
                score += 7
            else:
                score += 3
        
        # Revenue scoring
        if lead.annual_revenue:
            revenue_scores = {
                "10m+": 5,
                "1m-10m": 4,
                "500k-1m": 3,
                "100k-500k": 2,
                "<100k": 1
            }
            score += revenue_scores.get(lead.annual_revenue, 1)
        
        return min(score, 30)  # Cap at 30
    
    def _calculate_behavioral_score(self, lead: LeadScoreRequest) -> int:
        """Calculate behavior-based score"""
        score = 0
    
        # Website visits
        if lead.website_visits > 10:
            score += 8
        elif lead.website_visits > 5:
            score += 6
        elif lead.website_visits > 1:
            score += 4
        elif lead.website_visits == 1:
            score += 2
    
        # Pages viewed
        if lead.pages_viewed > 20:
            score += 6
        elif lead.pages_viewed > 10:
            score += 4
        elif lead.pages_viewed > 5:
            score += 2
    
        # Time on site
        if lead.time_on_site > 30:
            score += 5
        elif lead.time_on_site > 15:
            score += 3
        elif lead.time_on_site > 5:
            score += 1
    
        # Downloads (high intent)
        score += min(lead.downloads * 2, 10)
    
        # Recency bonus - Fixed datetime handling
        if lead.last_activity:
            # Make both datetimes timezone-aware or timezone-naive
            now = datetime.utcnow()
            last_activity = lead.last_activity
        
            # If last_activity has timezone info, remove it for comparison
            if last_activity.tzinfo is not None:
                last_activity = last_activity.replace(tzinfo=None)
        
            days_ago = (now - last_activity).days
            if days_ago <= 1:
                score += 11
            elif days_ago <= 7:
                score += 8
            elif days_ago <= 30:
                score += 5
            elif days_ago <= 90:
                score += 2
    
        return min(score, 40)  # Cap at 40
    
    def _calculate_engagement_score(self, lead: LeadScoreRequest) -> int:
        """Calculate engagement-based score"""
        score = 0
        
        # Email engagement
        if lead.email_opens > 10:
            score += 6
        elif lead.email_opens > 5:
            score += 4
        elif lead.email_opens > 0:
            score += 2
        
        if lead.email_clicks > 5:
            score += 10
        elif lead.email_clicks > 2:
            score += 7
        elif lead.email_clicks > 0:
            score += 4
        
        # Source quality
        source_scores = {
            LeadSource.REFERRAL: 8,
            LeadSource.WEBSITE: 6,
            LeadSource.EMAIL: 5,
            LeadSource.EVENT: 7,
            LeadSource.SOCIAL: 4,
            LeadSource.COLD_OUTREACH: 2,
            LeadSource.OTHER: 3
        }
        score += source_scores.get(lead.source, 3)
        
        return min(score, 30)  # Cap at 30
    
    async def _get_ai_insights(self, lead: LeadScoreRequest, total_score: int) -> Dict[str, Any]:
        """Get AI-powered insights about the lead"""
        
        lead_summary = f"""
Lead Information:
- Name: {lead.first_name or 'Unknown'} {lead.last_name or ''}
- Company: {lead.company or 'Unknown'}
- Job Title: {lead.job_title or 'Unknown'}
- Industry: {lead.industry or 'Unknown'}
- Source: {lead.source}
- Website Visits: {lead.website_visits}
- Downloads: {lead.downloads}
- Email Engagement: {lead.email_opens} opens, {lead.email_clicks} clicks
- Notes: {lead.notes or 'None'}
- Current Score: {total_score}/100
        """
        
        messages = [
            {
                "role": "system",
                "content": """You are a sales intelligence AI expert. Analyze the lead information and provide insights in JSON format:
                {
                    "key_strengths": ["strength1", "strength2"],
                    "concerns": ["concern1", "concern2"],
                    "buying_signals": ["signal1", "signal2"],
                    "recommended_approach": "personalized approach strategy",
                    "urgency_level": "high|medium|low",
                    "conversion_probability": 0.75
                }"""
            },
            {
                "role": "user",
                "content": f"Analyze this lead and provide insights: {lead_summary}"
            }
        ]
        
        try:
            result = await openai_service.chat_completion(messages, temperature=0.2)
            ai_insights = json.loads(result["content"])
            return ai_insights
        except Exception as e:
            logger.warning("Failed to get AI insights", error=str(e))
            return {
                "key_strengths": [],
                "concerns": [],
                "buying_signals": [],
                "recommended_approach": "Standard follow-up approach",
                "urgency_level": "medium",
                "conversion_probability": 0.5
            }
    
    def _generate_next_best_actions(self, lead: LeadScoreRequest, score: int, ai_insights: Dict[str, Any]) -> List[str]:
        """Generate recommended next actions based on lead score and insights"""
        actions = []
        
        if score >= 80:
            actions.extend([
                "Schedule immediate sales call",
                "Send personalized proposal",
                "Introduce to senior sales rep"
            ])
        elif score >= 60:
            actions.extend([
                "Send targeted case study",
                "Schedule product demo",
                "Add to high-priority nurture sequence"
            ])
        elif score >= 40:
            actions.extend([
                "Send educational content",
                "Add to nurture email sequence",
                "Schedule follow-up in 1 week"
            ])
        else:
            actions.extend([
                "Add to long-term nurture campaign",
                "Send industry newsletter",
                "Monitor for increased activity"
            ])
        
        # Add AI-driven specific actions
        urgency = ai_insights.get("urgency_level", "medium")
        if urgency == "high":
            actions.insert(0, "URGENT: Contact within 24 hours")
        
        buying_signals = ai_insights.get("buying_signals", [])
        if buying_signals:
            actions.append(f"Leverage buying signals: {', '.join(buying_signals[:2])}")
        
        return actions[:5]  # Limit to top 5 actions
    
    def _categorize_score(self, score: int) -> str:
        """Categorize lead score into Hot/Warm/Cold"""
        if score >= 70:
            return "Hot"
        elif score >= 40:
            return "Warm"
        else:
            return "Cold"
    
    async def score_lead(self, lead: LeadScoreRequest) -> LeadScoreResponse:
        """Score a lead using traditional scoring + AI insights"""
        
        logger.info("Scoring lead", email=lead.email, source=lead.source)
        
        try:
            # Calculate component scores
            demographic_score = self._calculate_demographic_score(lead)
            behavioral_score = self._calculate_behavioral_score(lead)
            engagement_score = self._calculate_engagement_score(lead)
            
            total_score = demographic_score + behavioral_score + engagement_score
            
            # Get AI insights
            ai_insights = await self._get_ai_insights(lead, total_score)
            
            # Generate recommended actions
            next_best_actions = self._generate_next_best_actions(lead, total_score, ai_insights)
            
            # Calculate confidence based on data completeness
            data_completeness = sum([
                1 if lead.job_title else 0,
                1 if lead.company else 0,
                1 if lead.industry else 0,
                1 if lead.website_visits > 0 else 0,
                1 if lead.email_opens > 0 else 0,
                1 if lead.last_activity else 0
            ]) / 6.0
            
            confidence = min(0.95, 0.6 + (data_completeness * 0.35))
            
            response = LeadScoreResponse(
                lead_id=f"lead_{hash(lead.email)}",
                email=lead.email,
                score=total_score,
                score_category=self._categorize_score(total_score),
                confidence=confidence,
                demographic_score=demographic_score,
                behavioral_score=behavioral_score,
                engagement_score=engagement_score,
                ai_insights=ai_insights,
                next_best_actions=next_best_actions,
                model_version=self.model_version
            )
            
            logger.info("Lead scored successfully", 
                       email=lead.email, 
                       score=total_score, 
                       category=response.score_category)
            
            return response
            
        except Exception as e:
            logger.error("Lead scoring failed", email=lead.email, error=str(e))
            raise

# Global lead scoring service instance
lead_scoring_service = LeadScoringService()