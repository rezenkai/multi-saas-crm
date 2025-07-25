from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.schemas.lead_score import LeadScoreRequest, LeadScoreResponse
from app.services.lead_scoring import lead_scoring_service
from app.api.dependencies import get_current_user
import structlog

logger = structlog.get_logger()
router = APIRouter()

@router.post("/score", response_model=LeadScoreResponse)
async def score_lead(
    lead_data: LeadScoreRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Score a single lead using AI-powered lead scoring
    
    This endpoint combines traditional lead scoring metrics with AI insights
    to provide a comprehensive lead score and recommended actions.
    """
    try:
        result = await lead_scoring_service.score_lead(lead_data)
        return result
    except Exception as e:
        logger.error("Lead scoring endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Lead scoring failed: {str(e)}")

@router.post("/score/batch", response_model=List[LeadScoreResponse])
async def score_leads_batch(
    leads_data: List[LeadScoreRequest],
    current_user: dict = Depends(get_current_user)
):
    """
    Score multiple leads in batch
    
    Efficiently processes multiple leads and returns their scores.
    Limited to 50 leads per batch to prevent timeout.
    """
    if len(leads_data) > 50:
        raise HTTPException(
            status_code=400, 
            detail="Batch size limited to 50 leads. Please split into smaller batches."
        )
    
    try:
        results = []
        for lead_data in leads_data:
            result = await lead_scoring_service.score_lead(lead_data)
            results.append(result)
        
        logger.info("Batch lead scoring completed", count=len(results))
        return results
        
    except Exception as e:
        logger.error("Batch lead scoring failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Batch lead scoring failed: {str(e)}")

@router.get("/model/info")
async def get_model_info(current_user: dict = Depends(get_current_user)):
    """
    Get information about the current lead scoring model
    """
    return {
        "model_version": lead_scoring_service.model_version,
        "scoring_components": {
            "demographic": {
                "max_score": 30,
                "factors": ["job_title", "company_size", "industry", "annual_revenue"]
            },
            "behavioral": {
                "max_score": 40,
                "factors": ["website_visits", "pages_viewed", "time_on_site", "downloads", "recency"]
            },
            "engagement": {
                "max_score": 30,
                "factors": ["email_opens", "email_clicks", "source_quality"]
            }
        },
        "ai_features": {
            "insights": "OpenAI-powered lead analysis",
            "next_best_actions": "AI-generated recommended actions",
            "buying_signals": "Automatic buying signal detection"
        },
        "score_categories": {
            "hot": "70-100 points",
            "warm": "40-69 points", 
            "cold": "0-39 points"
        }
    }