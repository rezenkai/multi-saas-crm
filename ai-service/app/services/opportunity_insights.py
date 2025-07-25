from typing import Dict, Any, List
import structlog
from datetime import datetime, timedelta
from app.services.openai_service import openai_service
from app.schemas.opportunity import OpportunityInsightRequest, OpportunityInsightResponse, OpportunityStage
import json

logger = structlog.get_logger()

class OpportunityInsightsService:
    def __init__(self):
        self.model_version = "1.0"
        
        # Stage-based win probability baselines
        self.stage_probabilities = {
            OpportunityStage.PROSPECTING: 10,
            OpportunityStage.QUALIFICATION: 25,
            OpportunityStage.PROPOSAL: 50,
            OpportunityStage.NEGOTIATION: 75,
            OpportunityStage.CLOSED_WON: 100,
            OpportunityStage.CLOSED_LOST: 0
        }
        
        # Risk factors and their impact
        self.risk_factors = {
            "long_sales_cycle": -15,
            "no_budget_confirmed": -20,
            "multiple_competitors": -10,
            "no_decision_maker_access": -25,
            "delayed_responses": -15,
            "price_sensitivity": -10
        }
    
    def _calculate_base_probability(self, opp: OpportunityInsightRequest) -> float:
        """Calculate base win probability using traditional factors"""
        
        # Start with stage-based probability
        base_prob = self.stage_probabilities.get(opp.stage, 50)
        
        # Adjust based on sales activities
        activity_score = 0
        
        # Meeting engagement
        if opp.meetings_count > 3:
            activity_score += 10
        elif opp.meetings_count > 1:
            activity_score += 5
        
        # Email engagement
        if opp.emails_opened > 0 and opp.emails_sent > 0:
            open_rate = opp.emails_opened / opp.emails_sent
            if open_rate > 0.5:
                activity_score += 8
            elif open_rate > 0.2:
                activity_score += 4
        
        # Key milestones
        if opp.demo_completed:
            activity_score += 15
        if opp.proposal_sent:
            activity_score += 10
        if opp.budget_confirmed:
            activity_score += 20
        
        # Time in stage (longer = higher risk)
        if opp.days_in_current_stage > 30:
            activity_score -= 10
        elif opp.days_in_current_stage > 60:
            activity_score -= 20
        
        # Competition impact
        if len(opp.competitors) > 2:
            activity_score -= 15
        elif len(opp.competitors) > 0:
            activity_score -= 8
        
        # Historical success rate
        if opp.similar_deals_won + opp.similar_deals_lost > 0:
            historical_rate = opp.similar_deals_won / (opp.similar_deals_won + opp.similar_deals_lost)
            activity_score += (historical_rate - 0.5) * 20
        
        return max(0, min(100, base_prob + activity_score))
    
    def _calculate_risk_score(self, opp: OpportunityInsightRequest) -> float:
        """Calculate deal risk score"""
        risk_score = 0
        
        # Time-based risks
        if opp.close_date:
            days_to_close = (opp.close_date.replace(tzinfo=None) - datetime.utcnow()).days
            if days_to_close < 7:
                risk_score += 30  # Rushing to close
            elif days_to_close > 180:
                risk_score += 20  # Too far out
        
        # Activity risks
        if opp.last_activity_date:
            last_activity = opp.last_activity_date.replace(tzinfo=None) if opp.last_activity_date.tzinfo else opp.last_activity_date
            days_since_activity = (datetime.utcnow() - last_activity).days
            if days_since_activity > 14:
                risk_score += 25
            elif days_since_activity > 7:
                risk_score += 15
        
        # Qualification risks
        if not opp.budget_confirmed:
            risk_score += 20
        if not opp.decision_maker_title:
            risk_score += 15
        if len(opp.competitors) > 2:
            risk_score += 20
        
        # Stage-time risk
        stage_time_limits = {
            OpportunityStage.PROSPECTING: 30,
            OpportunityStage.QUALIFICATION: 21,
            OpportunityStage.PROPOSAL: 14,
            OpportunityStage.NEGOTIATION: 7
        }
        
        limit = stage_time_limits.get(opp.stage, 30)
        if opp.days_in_current_stage > limit:
            risk_score += 25
        
        return min(100, risk_score)
    
    async def _get_ai_insights(self, opp: OpportunityInsightRequest, win_prob: float, risk_score: float) -> Dict[str, Any]:
        """Get AI-powered insights about the opportunity"""
        
        opp_summary = f"""
Opportunity Analysis:
- Name: {opp.name}
- Value: ${opp.value:,.2f}
- Stage: {opp.stage}
- Current Probability: {opp.probability}%
- Account: {opp.account_name}
- Industry: {opp.industry or 'Unknown'}
- Days in Stage: {opp.days_in_current_stage}
- Meetings: {opp.meetings_count}
- Demo Completed: {opp.demo_completed}
- Proposal Sent: {opp.proposal_sent}
- Budget Confirmed: {opp.budget_confirmed}
- Competitors: {', '.join(opp.competitors) if opp.competitors else 'None known'}
- Pain Points: {', '.join(opp.pain_points) if opp.pain_points else 'None identified'}
- Notes: {opp.notes or 'None'}
- Calculated Win Probability: {win_prob:.1f}%
- Risk Score: {risk_score:.1f}%
        """
        
        messages = [
            {
                "role": "system", 
                "content": """You are a sales intelligence AI expert specializing in deal analysis and forecasting. 
                Analyze the opportunity and provide insights in JSON format:
                {
                    "key_success_factors": ["factor1", "factor2"],
                    "risk_factors": ["risk1", "risk2"], 
                    "competitive_threats": ["threat1", "threat2"],
                    "next_best_actions": ["action1", "action2", "action3"],
                    "urgency_level": "low|medium|high|critical",
                    "coaching_tips": ["tip1", "tip2"],
                    "forecast_category": "commit|best_case|pipeline|omit",
                    "similar_deals_strategy": "strategy for similar deals"
                }"""
            },
            {
                "role": "user",
                "content": f"Analyze this sales opportunity: {opp_summary}"
            }
        ]
        
        try:
            result = await openai_service.chat_completion(messages, temperature=0.2)
            ai_insights = json.loads(result["content"])
            return ai_insights
        except Exception as e:
            logger.warning("Failed to get AI insights for opportunity", error=str(e))
            return {
                "key_success_factors": ["Strong product fit", "Engaged stakeholders"],
                "risk_factors": ["Timeline pressure", "Budget constraints"],
                "competitive_threats": ["Price competition"],
                "next_best_actions": ["Schedule follow-up", "Send proposal", "Identify decision maker"],
                "urgency_level": "medium",
                "coaching_tips": ["Focus on value proposition", "Address objections proactively"],
                "forecast_category": "pipeline",
                "similar_deals_strategy": "Follow standard sales process"
            }
    
    def _forecast_close_date(self, opp: OpportunityInsightRequest, risk_score: float) -> datetime:
        """Forecast realistic close date based on stage and risk"""
        
        # Average days per stage
        stage_durations = {
            OpportunityStage.PROSPECTING: 21,
            OpportunityStage.QUALIFICATION: 14,
            OpportunityStage.PROPOSAL: 10,
            OpportunityStage.NEGOTIATION: 7
        }
        
        if opp.stage in [OpportunityStage.CLOSED_WON, OpportunityStage.CLOSED_LOST]:
            return opp.close_date or datetime.utcnow()
        
        # Adjust based on risk
        base_days = stage_durations.get(opp.stage, 14)
        risk_multiplier = 1 + (risk_score / 100)  # Higher risk = longer timeline
        
        adjusted_days = int(base_days * risk_multiplier)
        return datetime.utcnow() + timedelta(days=adjusted_days)
    
    async def analyze_opportunity(self, opp: OpportunityInsightRequest) -> OpportunityInsightResponse:
        """Analyze opportunity and provide AI-powered insights"""
        
        logger.info("Analyzing opportunity", opportunity_id=opp.opportunity_id, value=opp.value)
        
        try:
            # Calculate predictions
            win_probability = self._calculate_base_probability(opp)
            risk_score = self._calculate_risk_score(opp)
            forecasted_close_date = self._forecast_close_date(opp, risk_score)
            
            # Get AI insights
            ai_insights = await self._get_ai_insights(opp, win_probability, risk_score)
            
            # Calculate confidence based on data quality
            data_completeness = sum([
                1 if opp.industry else 0,
                1 if opp.decision_maker_title else 0,
                1 if opp.budget_confirmed else 0,
                1 if opp.demo_completed else 0,
                1 if opp.meetings_count > 0 else 0,
                1 if opp.last_activity_date else 0,
                1 if opp.pain_points else 0
            ]) / 7.0
            
            confidence = min(0.95, 0.5 + (data_completeness * 0.45))
            
            # Determine forecast category
            forecast_category = ai_insights.get("forecast_category", "pipeline")
            if win_probability >= 80 and risk_score < 30:
                forecast_category = "commit"
            elif win_probability >= 60:
                forecast_category = "best_case"
            elif win_probability < 20 or risk_score > 80:
                forecast_category = "omit"
            
            response = OpportunityInsightResponse(
                opportunity_id=opp.opportunity_id,
                name=opp.name,
                win_probability=win_probability,
                risk_score=risk_score,
                forecasted_close_date=forecasted_close_date,
                confidence_level=confidence,
                key_success_factors=ai_insights.get("key_success_factors", []),
                risk_factors=ai_insights.get("risk_factors", []),
                competitive_threats=ai_insights.get("competitive_threats", []),
                next_best_actions=ai_insights.get("next_best_actions", []),
                urgency_level=ai_insights.get("urgency_level", "medium"),
                coaching_tips=ai_insights.get("coaching_tips", []),
                similar_deals_analysis={
                    "strategy": ai_insights.get("similar_deals_strategy", ""),
                    "win_rate": opp.similar_deals_won / max(1, opp.similar_deals_won + opp.similar_deals_lost)
                },
                forecast_category=forecast_category,
                revenue_impact=opp.value * (win_probability / 100),
                model_version=self.model_version
            )
            
            logger.info("Opportunity analysis completed", 
                       opportunity_id=opp.opportunity_id,
                       win_probability=win_probability,
                       risk_score=risk_score,
                       forecast_category=forecast_category)
            
            return response
            
        except Exception as e:
            logger.error("Opportunity analysis failed", opportunity_id=opp.opportunity_id, error=str(e))
            raise

# Global opportunity insights service instance
opportunity_insights_service = OpportunityInsightsService()