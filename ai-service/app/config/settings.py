from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Application Settings
    app_name: str = "AI Service"
    app_version: str = "1.0.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8003
    
    # OpenAI Configuration
    openai_api_key: str
    openai_model_default: str = "gpt-4"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_max_tokens: int = 4000
    openai_temperature: float = 0.1
    
    # Database Configuration (PostgreSQL with pgvector)
    database_url: str
    database_pool_size: int = 10
    database_max_overflow: int = 20
    
    # Redis Configuration
    redis_url: str = "redis://localhost:6379"
    redis_cache_ttl: int = 3600  # 1 hour
    
    # Identity Service Integration
    identity_service_url: str = "http://localhost:3002"
    identity_service_api_key: Optional[str] = None
    jwt_secret: str  # Same as identity service for token verification
    
    # Core Service Integration
    core_service_url: str = "http://localhost:3001"
    
    # AI Feature Configuration
    lead_scoring_enabled: bool = True
    opportunity_insights_enabled: bool = True
    communication_ai_enabled: bool = True
    rag_system_enabled: bool = True
    
    # Rate Limiting
    rate_limit_requests_per_minute: int = 100
    
    # Monitoring
    enable_metrics: bool = True
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Global settings instance
settings = Settings()
