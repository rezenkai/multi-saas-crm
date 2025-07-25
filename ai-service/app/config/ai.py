# app/config/ai.py

from pydantic_settings import BaseSettings

class AISettings(BaseSettings):
    """AI-specific settings"""

    # OpenAI Configuration
    openai_api_key: str
    openai_model_default: str = "gpt-3.5-turbo"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_temperature: float = 0.1
    openai_max_tokens: int = 4000

    # Cache TTL Settings (in seconds)
    cache_openai_ttl: int = 3600 * 2      # 2 hours
    cache_sentiment_ttl: int = 3600 * 4    # 4 hours  
    cache_lead_score_ttl: int = 3600 * 6   # 6 hours
    cache_opportunity_ttl: int = 3600 * 4  # 4 hours
    cache_rag_ttl: int = 3600 * 1          # 1 hour

    # AI Features Enabled/Disabled
    enable_lead_scoring: bool = True
    enable_opportunity_insights: bool = True
    enable_communication_ai: bool = True
    enable_rag: bool = True
    enable_sentiment_analysis: bool = True

    # Cost Tracking
    enable_cost_tracking: bool = True
    daily_cost_limit: float = 100.0  # Daily OpenAI cost limit in USD

    class Config:
        env_file = ".env"
        env_prefix = ""  # Remove "AI_" since your .env uses direct OPENAI_*
        extra = "ignore"

# Global AI settings instance
ai_settings = AISettings()
