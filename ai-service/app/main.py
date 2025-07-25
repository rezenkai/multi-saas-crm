# app/main.py - Updated with cache testing endpoints
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import os
import time
from dotenv import load_dotenv

# Import routers
from app.api.v1 import lead_scoring, opportunities, communication, knowledge

# Load environment variables
load_dotenv()

# Create FastAPI application
app = FastAPI(
    title="AI Service",
    version="1.0.0",
    description="AI/ML microservice for multi-SaaS CRM with OpenAI integration"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    lead_scoring.router,
    prefix="/api/v1/lead-scoring",
    tags=["Lead Scoring"]
)

app.include_router(
    opportunities.router,
    prefix="/api/v1/opportunities",
    tags=["Opportunity Insights"]
)

app.include_router(
    communication.router,
    prefix="/api/v1/communication",
    tags=["Communication AI"]
)

app.include_router(
    knowledge.router,
    prefix="/api/v1/knowledge",
    tags=["Knowledge & RAG"]
)

# ========== CACHE TESTING ENDPOINTS ==========

class TestCacheRequest(BaseModel):
    message: str

class TestCacheResponse(BaseModel):
    response: str
    response_time_ms: int
    cache_hit: bool
    tokens_used: int

@app.post("/api/v1/test/openai-cache", response_model=TestCacheResponse)
async def test_openai_cache(request: TestCacheRequest):
    """Test endpoint to verify OpenAI caching is working"""
    
    start_time = time.time()
    
    try:
        # Import here to avoid circular imports
        from app.services.openai_service import openai_service
        
        # Make the OpenAI call (will use cache if available)
        messages = [
            {"role": "user", "content": request.message}
        ]
        
        result = await openai_service.chat_completion(messages)
        
        end_time = time.time()
        response_time_ms = int((end_time - start_time) * 1000)
        
        return TestCacheResponse(
            response=result["content"],
            response_time_ms=response_time_ms,
            cache_hit=response_time_ms < 200,  # If super fast, probably cache hit
            tokens_used=result["usage"]["total_tokens"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI call failed: {str(e)}")

@app.get("/api/v1/test/cache-stats")
async def get_cache_test_stats():
    """Get basic cache statistics"""
    try:
        # Import here to avoid circular imports
        from app.core.ai_cache import ai_cache
        
        stats = await ai_cache.get_cache_stats()
        return stats
    except Exception as e:
        return {
            "error": str(e),
            "cache_connected": False,
            "timestamp": datetime.utcnow().isoformat()
        }

@app.post("/api/v1/test/sentiment")
async def test_sentiment_cache(request: TestCacheRequest):
    """Test sentiment analysis caching"""
    
    start_time = time.time()
    
    try:
        # Import here to avoid circular imports
        from app.services.openai_service import openai_service
        
        result = await openai_service.analyze_sentiment(request.message)
        
        end_time = time.time()
        response_time_ms = int((end_time - start_time) * 1000)
        
        return {
            "sentiment": result,
            "response_time_ms": response_time_ms,
            "cache_hit": response_time_ms < 200,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")

# ========== EXISTING ENDPOINTS ==========

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ai-service",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "features": {
            "lead_scoring": os.getenv("LEAD_SCORING_ENABLED", "true") == "true",
            "opportunity_insights": os.getenv("OPPORTUNITY_INSIGHTS_ENABLED", "true") == "true",
            "communication_ai": os.getenv("COMMUNICATION_AI_ENABLED", "true") == "true",
            "rag_system": os.getenv("RAG_SYSTEM_ENABLED", "true") == "true",
            "ai_caching": True  # New feature!
        },
        "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
        "endpoints": {
            "lead_scoring": "/api/v1/lead-scoring/score",
            "batch_lead_scoring": "/api/v1/lead-scoring/score/batch",
            "lead_model_info": "/api/v1/lead-scoring/model/info",
            "opportunity_analysis": "/api/v1/opportunities/analyze",
            "batch_opportunity_analysis": "/api/v1/opportunities/analyze/batch",
            "forecast_summary": "/api/v1/opportunities/forecast/summary",
            "opportunity_model_info": "/api/v1/opportunities/model/info",
            "communication_sentiment": "/api/v1/communication/sentiment/analyze",
            "email_draft": "/api/v1/communication/email/draft",
            "meeting_summary": "/api/v1/communication/meeting/summarize",
            "communication_templates": "/api/v1/communication/templates",
            "communication_model_info": "/api/v1/communication/model/info",
            "knowledge_query": "/api/v1/knowledge/query",
            "knowledge_search": "/api/v1/knowledge/search",
            "knowledge_add_document": "/api/v1/knowledge/documents",
            "customer_insights": "/api/v1/knowledge/customer-insights",
            "knowledge_stats": "/api/v1/knowledge/stats",
            "knowledge_model_info": "/api/v1/knowledge/model/info",
            # New cache testing endpoints
            "test_openai_cache": "/api/v1/test/openai-cache",
            "test_cache_stats": "/api/v1/test/cache-stats",
            "test_sentiment_cache": "/api/v1/test/sentiment"
        }
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AI Service API with Caching",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "features": {
            "lead_scoring": "/api/v1/lead-scoring",
            "opportunity_insights": "/api/v1/opportunities",
            "communication_ai": "/api/v1/communication",
            "knowledge_rag": "/api/v1/knowledge",
            "cache_testing": "/api/v1/test"  # New testing endpoints
        }
    }

# Test OpenAI connection endpoint
@app.get("/test/openai")
async def test_openai():
    """Test OpenAI connection"""
    openai_key = os.getenv("OPENAI_API_KEY")
    
    if not openai_key:
        return {"status": "error", "message": "OPENAI_API_KEY not configured"}
    
    if openai_key == "your_openai_api_key_here":
        return {"status": "error", "message": "Please set your actual OpenAI API key"}
    
    try:
        from openai import OpenAI
        client = OpenAI(api_key=openai_key)
        
        # Test with a simple completion
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Say 'AI service test successful'"}],
            max_tokens=10
        )
        
        return {
            "status": "success",
            "message": "OpenAI connection successful",
            "response": response.choices[0].message.content,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"OpenAI connection failed: {str(e)}"
        }

# Startup event to initialize cache
@app.on_event("startup")
async def startup_event():
    """Initialize cache and services on startup"""
    try:
        # Initialize cache if available
        try:
            from app.core.ai_cache import ai_cache
            stats = await ai_cache.get_cache_stats()
            print("✅ AI cache initialized successfully")
            print(f"📊 Cache stats: {stats}")
        except Exception as cache_error:
            print(f"⚠️  AI cache initialization failed: {cache_error}")
            print("🔄 AI service will work without caching")
        
        print("🚀 AI Service started successfully!")
        print("📖 API docs available at: http://localhost:8003/docs")
        print("🧪 Test cache at: http://localhost:8003/api/v1/test/cache-stats")
        
    except Exception as e:
        print(f"❌ Startup failed: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8003))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )