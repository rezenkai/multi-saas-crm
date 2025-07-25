from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.schemas.opportunity import OpportunityInsightRequest, OpportunityInsightResponse
from app.services.opportunity_insights import opportunity_insights_service
from app.api.dependencies import get_current_user
import structlog

logger = structlog.get_logger()
router = APIRouter()

@router.post("/analyze", response_model=OpportunityInsightResponse)
async def analyze_opportunity(
    opportunity_data: OpportunityInsightRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze a sales opportunity using AI-powered insights
    
    Provides win probability, risk assessment, forecasting, and next best actions
    using machine learning and AI analysis.
    """
    try:
        result = await opportunity_insights_service.analyze_opportunity(opportunity_data)
        return result
    except Exception as e:
        logger.error("Opportunity analysis endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Opportunity analysis failed: {str(e)}")

@router.post("/analyze/batch", response_model=List[OpportunityInsightResponse])
async def analyze_opportunities_batch(
    opportunities_data: List[OpportunityInsightRequest],
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze multiple opportunities in batch
    
    Efficiently processes multiple opportunities and returns their insights.
    Limited to 20 opportunities per batch to prevent timeout.
    """
    if len(opportunities_data) > 20:
        raise HTTPException(
            status_code=400, 
            detail="Batch size limited to 20 opportunities. Please split into smaller batches."
        )
    
    try:
        results = []
        for opportunity_data in opportunities_data:
            result = await opportunity_insights_service.analyze_opportunity(opportunity_data)
            results.append(result)
        
        logger.info("Batch opportunity analysis completed", count=len(results))
        return results
        
    except Exception as e:
        logger.error("Batch opportunity analysis failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Batch opportunity analysis failed: {str(e)}")

@router.get("/forecast/summary")
async def get_forecast_summary(
    current_user: dict = Depends(get_current_user)
):
    """
    Get sales forecast summary and pipeline insights
    
    This would typically aggregate data from your CRM system.
    For now, returns model information and forecast categories.
    """
    return {
        "model_version": opportunity_insights_service.model_version,
        "forecast_categories": {
            "commit": "High confidence deals (80%+ win probability, low risk)",
            "best_case": "Optimistic scenario deals (60%+ win probability)",
            "pipeline": "Standard pipeline deals (20-60% win probability)",
            "omit": "Low probability or high risk deals (<20% or high risk)"
        },
        "stage_probabilities": {
            "prospecting": "10% baseline",
            "qualification": "25% baseline", 
            "proposal": "50% baseline",
            "negotiation": "75% baseline"
        },
        "risk_factors": [
            "Long sales cycle (>60 days in stage)",
            "No budget confirmation",
            "Multiple competitors",
            "Limited decision maker access",
            "Delayed responses",
            "Price sensitivity"
        ],
        "success_indicators": [
            "Frequent stakeholder engagement",
            "Demo completion",
            "Proposal acceptance",
            "Budget confirmation",
            "Clear timeline",
            "Champion identification"
        ]
    }

@router.get("/model/info")
async def get_opportunity_model_info(
    current_user: dict = Depends(get_current_user)
):
    """
    Get information about the opportunity insights model
    """
    return {
        "model_version": opportunity_insights_service.model_version,
        "features": {
            "win_probability": "AI-powered probability prediction",
            "risk_assessment": "Multi-factor risk scoring",
            "forecast_categorization": "Commit/Best Case/Pipeline/Omit",
            "next_best_actions": "AI-generated recommendations",
            "sales_coaching": "Personalized coaching tips",
            "competitive_analysis": "Threat identification",
            "timeline_forecasting": "Realistic close date prediction"
        },
        "input_factors": {
            "deal_characteristics": ["value", "stage", "days_in_stage"],
            "customer_profile": ["industry", "company_size", "decision_maker"],
            "sales_activities": ["meetings", "emails", "demos", "proposals"],
            "qualification": ["budget_confirmed", "timeline", "pain_points"],
            "competitive": ["competitors", "differentiation"],
            "historical": ["similar_deals_won", "similar_deals_lost"]
        },
        "output_insights": {
            "predictions": ["win_probability", "risk_score", "forecasted_close_date"],
            "recommendations": ["next_best_actions", "coaching_tips"],
            "categorization": ["forecast_category", "urgency_level"],
            "analysis": ["success_factors", "risk_factors", "competitive_threats"]
        }
    }