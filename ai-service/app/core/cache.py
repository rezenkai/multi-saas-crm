"""
Enhanced AI Cache Manager - extends your existing CacheManager with AI-specific caching
"""

import redis.asyncio as redis
from typing import Optional, Any, List, Dict, Union
import json
import structlog
import hashlib
import pickle
import numpy as np
from datetime import datetime, timedelta
from dataclasses import dataclass
from app.config.settings import settings

logger = structlog.get_logger()

@dataclass
class AICacheConfig:
    """AI-specific cache configuration"""
    openai_api_ttl: int = 3600 * 2  # 2 hours for OpenAI responses
    embedding_ttl: int = 86400 * 7  # 1 week for embeddings
    lead_score_ttl: int = 3600 * 6  # 6 hours for lead scores
    opportunity_forecast_ttl: int = 3600 * 4  # 4 hours for forecasts
    sentiment_analysis_ttl: int = 3600 * 2  # 2 hours for sentiment
    rag_context_ttl: int = 3600 * 1  # 1 hour for RAG context

class EnhancedCacheManager:
    """Enhanced cache manager with AI-specific optimizations"""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.ai_config = AICacheConfig()
    
    async def init_redis(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            # Test connection
            await self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error("Failed to connect to Redis", error=str(e))
            raise
    
    def _generate_cache_key(self, prefix: str, data: Union[str, Dict, List]) -> str:
        """Generate consistent cache key from data"""
        if isinstance(data, (dict, list)):
            data_str = json.dumps(data, sort_keys=True)
        else:
            data_str = str(data)
        
        hash_object = hashlib.md5(data_str.encode())
        return f"{prefix}:{hash_object.hexdigest()}"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache (original method)"""
        if not self.redis_client:
            return None
        try:
            value = await self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.warning("Cache get failed", key=key, error=str(e))
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache (original method)"""
        if not self.redis_client:
            return False
        try:
            ttl = ttl or settings.redis_cache_ttl
            await self.redis_client.setex(
                key,
                ttl,
                json.dumps(value, default=str)
            )
            return True
        except Exception as e:
            logger.warning("Cache set failed", key=key, error=str(e))
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache (original method)"""
        if not self.redis_client:
            return False
        try:
            await self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.warning("Cache delete failed", key=key, error=str(e))
            return False
    
    # ========== AI-SPECIFIC CACHING METHODS ==========
    
    async def cache_openai_response(self, prompt: str, response: Dict[str, Any], 
                                  model: str = "gpt-4", ttl: Optional[int] = None) -> bool:
        """Cache OpenAI API response with cost tracking"""
        cache_key = self._generate_cache_key(f"openai:{model}", prompt)
        ttl = ttl or self.ai_config.openai_api_ttl
        
        cache_data = {
            "response": response,
            "cached_at": datetime.utcnow().isoformat(),
            "model": model,
            "prompt_hash": hashlib.md5(prompt.encode()).hexdigest(),
            "tokens_used": response.get("usage", {}).get("total_tokens", 0),
            "cost_estimate": self._estimate_cost(response.get("usage", {}), model)
        }
        
        try:
            await self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(cache_data, default=str)
            )
            logger.info("Cached OpenAI response", model=model, tokens=cache_data["tokens_used"])
            return True
        except Exception as e:
            logger.warning("Failed to cache OpenAI response", error=str(e))
            return False
    
    async def get_openai_response(self, prompt: str, model: str = "gpt-4") -> Optional[Dict[str, Any]]:
        """Retrieve cached OpenAI response"""
        cache_key = self._generate_cache_key(f"openai:{model}", prompt)
        cached_data = await self.get(cache_key)
        
        if cached_data:
            logger.info("OpenAI cache hit", model=model)
            return cached_data
        
        logger.info("OpenAI cache miss", model=model)
        return None
    
    async def cache_embedding(self, text: str, embedding: List[float], 
                            model: str = "text-embedding-ada-002", ttl: Optional[int] = None) -> bool:
        """Cache text embedding with binary storage for efficiency"""
        cache_key = self._generate_cache_key(f"embedding:{model}", text)
        ttl = ttl or self.ai_config.embedding_ttl
        
        try:
            # Store embedding as compressed binary data for space efficiency
            embedding_bytes = pickle.dumps(np.array(embedding, dtype=np.float32))
            
            embedding_data = {
                "embedding_hex": embedding_bytes.hex(),
                "text_hash": hashlib.md5(text.encode()).hexdigest(),
                "model": model,
                "dimension": len(embedding),
                "cached_at": datetime.utcnow().isoformat()
            }
            
            await self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(embedding_data)
            )
            logger.debug("Cached embedding", model=model, dimension=len(embedding))
            return True
        except Exception as e:
            logger.warning("Failed to cache embedding", error=str(e))
            return False
    
    async def get_embedding(self, text: str, model: str = "text-embedding-ada-002") -> Optional[np.ndarray]:
        """Retrieve cached embedding"""
        cache_key = self._generate_cache_key(f"embedding:{model}", text)
        cached_data = await self.get(cache_key)
        
        if cached_data:
            try:
                embedding_bytes = bytes.fromhex(cached_data["embedding_hex"])
                embedding = pickle.loads(embedding_bytes)
                logger.debug("Embedding cache hit", model=model)
                return embedding
            except Exception as e:
                logger.warning("Failed to deserialize cached embedding", error=str(e))
                return None
        
        logger.debug("Embedding cache miss", model=model)
        return None
    
    async def cache_lead_score(self, lead_id: int, score_data: Dict[str, Any], 
                             ttl: Optional[int] = None) -> bool:
        """Cache lead AI score and components"""
        cache_key = f"lead_score:{lead_id}"
        ttl = ttl or self.ai_config.lead_score_ttl
        
        cache_data = {
            "score": score_data,
            "cached_at": datetime.utcnow().isoformat(),
            "lead_id": lead_id,
            "expires_at": (datetime.utcnow() + timedelta(seconds=ttl)).isoformat()
        }
        
        try:
            await self.redis_client.setex(cache_key, ttl, json.dumps(cache_data, default=str))
            logger.info("Cached lead score", lead_id=lead_id, score=score_data.get("ai_score"))
            return True
        except Exception as e:
            logger.warning("Failed to cache lead score", lead_id=lead_id, error=str(e))
            return False
    
    async def get_lead_score(self, lead_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve cached lead score"""
        cache_key = f"lead_score:{lead_id}"
        cached_data = await self.get(cache_key)
        
        if cached_data:
            logger.info("Lead score cache hit", lead_id=lead_id)
            return cached_data
        
        logger.info("Lead score cache miss", lead_id=lead_id)
        return None
    
    async def cache_opportunity_forecast(self, opportunity_id: int, forecast_data: Dict[str, Any], 
                                       ttl: Optional[int] = None) -> bool:
        """Cache opportunity forecast data"""
        cache_key = f"opportunity_forecast:{opportunity_id}"
        ttl = ttl or self.ai_config.opportunity_forecast_ttl
        
        cache_data = {
            "forecast": forecast_data,
            "cached_at": datetime.utcnow().isoformat(),
            "opportunity_id": opportunity_id
        }
        
        try:
            await self.redis_client.setex(cache_key, ttl, json.dumps(cache_data, default=str))
            logger.info("Cached opportunity forecast", 
                       opportunity_id=opportunity_id, 
                       probability=forecast_data.get("close_probability"))
            return True
        except Exception as e:
            logger.warning("Failed to cache opportunity forecast", 
                          opportunity_id=opportunity_id, error=str(e))
            return False
    
    async def get_opportunity_forecast(self, opportunity_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve cached opportunity forecast"""
        cache_key = f"opportunity_forecast:{opportunity_id}"
        cached_data = await self.get(cache_key)
        
        if cached_data:
            logger.info("Opportunity forecast cache hit", opportunity_id=opportunity_id)
            return cached_data
        
        logger.info("Opportunity forecast cache miss", opportunity_id=opportunity_id)
        return None
    
    async def cache_sentiment_analysis(self, text: str, sentiment_data: Dict[str, Any], 
                                     model: str = "aws_comprehend", ttl: Optional[int] = None) -> bool:
        """Cache sentiment analysis results"""
        cache_key = self._generate_cache_key(f"sentiment:{model}", text)
        ttl = ttl or self.ai_config.sentiment_analysis_ttl
        
        cache_data = {
            "sentiment": sentiment_data,
            "text_hash": hashlib.md5(text.encode()).hexdigest(),
            "model": model,
            "cached_at": datetime.utcnow().isoformat()
        }
        
        try:
            await self.redis_client.setex(cache_key, ttl, json.dumps(cache_data, default=str))
            logger.debug("Cached sentiment analysis", 
                        model=model, 
                        sentiment=sentiment_data.get("sentiment", "unknown"))
            return True
        except Exception as e:
            logger.warning("Failed to cache sentiment analysis", error=str(e))
            return False
    
    async def get_sentiment_analysis(self, text: str, model: str = "aws_comprehend") -> Optional[Dict[str, Any]]:
        """Retrieve cached sentiment analysis"""
        cache_key = self._generate_cache_key(f"sentiment:{model}", text)
        cached_data = await self.get(cache_key)
        
        if cached_data:
            logger.debug("Sentiment analysis cache hit", model=model)
            return cached_data
        
        logger.debug("Sentiment analysis cache miss", model=model)
        return None
    
    async def cache_rag_context(self, query: str, context: Dict[str, Any], 
                              ttl: Optional[int] = None) -> bool:
        """Cache RAG system context for queries"""
        cache_key = self._generate_cache_key("rag_context", query)
        ttl = ttl or self.ai_config.rag_context_ttl
        
        cache_data = {
            "context": context,
            "query_hash": hashlib.md5(query.encode()).hexdigest(),
            "cached_at": datetime.utcnow().isoformat(),
            "document_count": len(context.get("documents", []))
        }
        
        try:
            await self.redis_client.setex(cache_key, ttl, json.dumps(cache_data, default=str))
            logger.debug("Cached RAG context", document_count=cache_data["document_count"])
            return True
        except Exception as e:
            logger.warning("Failed to cache RAG context", error=str(e))
            return False
    
    async def get_rag_context(self, query: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached RAG context"""
        cache_key = self._generate_cache_key("rag_context", query)
        cached_data = await self.get(cache_key)
        
        if cached_data:
            logger.debug("RAG context cache hit")
            return cached_data
        
        logger.debug("RAG context cache miss")
        return None
    
    # ========== BATCH OPERATIONS ==========
    
    async def cache_multiple_lead_scores(self, scores: Dict[int, Dict[str, Any]], 
                                       ttl: Optional[int] = None) -> bool:
        """Cache multiple lead scores efficiently using pipeline"""
        ttl = ttl or self.ai_config.lead_score_ttl
        
        try:
            pipe = self.redis_client.pipeline()
            
            for lead_id, score_data in scores.items():
                cache_key = f"lead_score:{lead_id}"
                cache_data = {
                    "score": score_data,
                    "cached_at": datetime.utcnow().isoformat(),
                    "lead_id": lead_id
                }
                pipe.setex(cache_key, ttl, json.dumps(cache_data, default=str))
            
            await pipe.execute()
            logger.info("Cached multiple lead scores", count=len(scores))
            return True
        except Exception as e:
            logger.warning("Failed to cache multiple lead scores", error=str(e))
            return False
    
    # ========== CACHE MANAGEMENT ==========
    
    async def invalidate_lead_cache(self, lead_id: int) -> bool:
        """Invalidate all cache entries for a specific lead"""
        try:
            patterns = [
                f"lead_score:{lead_id}",
                f"lead_*:{lead_id}:*"
            ]
            
            for pattern in patterns:
                keys = await self.redis_client.keys(pattern)
                if keys:
                    await self.redis_client.delete(*keys)
            
            logger.info("Invalidated lead cache", lead_id=lead_id)
            return True
        except Exception as e:
            logger.warning("Failed to invalidate lead cache", lead_id=lead_id, error=str(e))
            return False
    
    async def get_ai_cache_stats(self) -> Dict[str, Any]:
        """Get AI cache statistics"""
        try:
            info = await self.redis_client.info("memory")
            
            # Count keys by type
            key_counts = {}
            for prefix in ["openai", "embedding", "lead_score", "opportunity_forecast", 
                          "rag_context", "sentiment"]:
                keys = await self.redis_client.keys(f"{prefix}:*")
                key_counts[prefix] = len(keys)
            
            return {
                "memory_usage": info.get("used_memory_human", "unknown"),
                "total_keys": sum(key_counts.values()),
                "key_counts": key_counts,
                "cache_hit_savings": await self._calculate_cost_savings()
            }
        except Exception as e:
            logger.warning("Failed to get cache stats", error=str(e))
            return {"error": str(e)}
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics - alias for get_ai_cache_stats"""
        try:
            # First test if Redis is connected
            if not self.redis_client:
                await self.init_redis()
        
            if not self.redis_client:
                return {
                    "cache_connected": False,
                    "error": "Redis not connected",
                    "timestamp": datetime.utcnow().isoformat()
                }
        
            # Test basic connection
            await self.redis_client.ping()
        
            # Return basic stats
            return {
                "cache_connected": True,
                "ai_cache_ready": True,
                "redis_connected": True,
                "timestamp": datetime.utcnow().isoformat(),
                "cache_type": "EnhancedCacheManager"
            }
        except Exception as e:
            return {
                "cache_connected": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    def _estimate_cost(self, usage: Dict[str, int], model: str) -> float:
        """Estimate API call cost based on usage"""
        # OpenAI pricing (approximate, update with current rates)
        pricing = {
            "gpt-4": {"input": 0.00003, "output": 0.00006},  # per token
            "gpt-3.5-turbo": {"input": 0.0000015, "output": 0.000002},
            "text-embedding-ada-002": {"input": 0.0000001, "output": 0}
        }
        
        if model not in pricing:
            return 0.0
        
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        
        cost = (input_tokens * pricing[model]["input"] + 
                output_tokens * pricing[model]["output"])
        
        return round(cost, 6)
    
    async def _calculate_cost_savings(self) -> Dict[str, float]:
        """Calculate estimated cost savings from cache hits"""
        try:
            # This would track cache hits vs misses over time
            # For now, return placeholder data
            return {
                "estimated_daily_savings": 25.50,
                "total_cache_hits_today": 150,
                "avg_cost_per_api_call": 0.17
            }
        except:
            return {}

# Enhanced global cache instance
ai_cache_manager = EnhancedCacheManager()

async def init_ai_redis():
    """Initialize enhanced AI Redis cache"""
    await ai_cache_manager.init_redis()

# Decorator for automatic AI response caching
def cache_ai_call(cache_type: str, ttl: Optional[int] = None):
    """Decorator to automatically cache AI API responses"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key = f"{cache_type}:{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Try to get from cache first
            cached_result = await ai_cache_manager.get(cache_key)
            if cached_result:
                logger.info("Cache hit for AI call", function=func.__name__)
                return cached_result
            
            # Call original function
            result = await func(*args, **kwargs)
            
            # Cache the result
            await ai_cache_manager.set(cache_key, result, ttl)
            logger.info("Cached AI call result", function=func.__name__)
            
            return result
        return wrapper
    return decorator