# Update your existing app/services/openai_service.py file

from fastapi.concurrency import run_in_threadpool
from openai import OpenAI
from typing import List, Dict, Any, Optional
import structlog
import hashlib
import os
import json
from dotenv import load_dotenv

# Import your cache and config
from app.core.ai_cache import ai_cache
from app.config.ai import ai_settings

load_dotenv()
logger = structlog.get_logger()

class OpenAIService:
    def __init__(self):
        self.client = OpenAI(api_key=ai_settings.openai_api_key)
        self.default_model = ai_settings.openai_model_default
        self.embedding_model = ai_settings.openai_embedding_model
    
    def _create_cache_key(self, messages: List[Dict[str, str]], model: str, temperature: float) -> str:
        """Create a unique cache key for this OpenAI request"""
        # Convert messages to a string that's always the same for same inputs
        messages_str = json.dumps(messages, sort_keys=True)
        cache_data = f"{model}_{temperature}_{messages_str}"
        
        # Create a short hash
        return hashlib.md5(cache_data.encode()).hexdigest()
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get chat completion from OpenAI - NOW WITH CACHING!"""
        
        model = model or self.default_model
        temperature = temperature if temperature is not None else ai_settings.openai_temperature
        max_tokens = max_tokens or ai_settings.openai_max_tokens
        
        # Create prompt for caching
        prompt = json.dumps(messages, sort_keys=True) + f"_temp_{temperature}_max_{max_tokens}"
        
        try:
            # Step 1: Try to get from cache first
            cached_result = await ai_cache.get_openai_response(prompt, model)
            if cached_result:
                # Return the actual response from cache
                return cached_result["response"]
            
            # Step 2: Cache miss - make the expensive API call
            logger.info("💸 OpenAI cache miss - making API call", model=model, messages_count=len(messages))
            

            response = await run_in_threadpool(
                self.client.chat.completions.create,
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            # Step 3: Prepare the result
            result = {
                "content": response.choices[0].message.content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                "model": response.model,
                "finish_reason": response.choices[0].finish_reason
            }
            
            # Step 4: Cache the result for next time
            await ai_cache.cache_openai_response(prompt, result, model)
            
            logger.info("✅ OpenAI response cached for future use",
                       total_tokens=result["usage"]["total_tokens"])
            
            return result
            
        except Exception as e:
            logger.error("❌ OpenAI chat completion failed", error=str(e))
            raise
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment of text using OpenAI - NOW WITH CACHING!"""
        
        # Step 1: Check if we already analyzed this exact text
        cached_sentiment = await ai_cache.get_sentiment_analysis(text)
        if cached_sentiment:
            return cached_sentiment["sentiment"]
        
        # Step 2: Not in cache - analyze using our cached chat_completion
        messages = [
            {
                "role": "system",
                "content": """You are a sentiment analysis expert. Analyze the sentiment of the given text and respond in JSON format with:
                {
                    "sentiment": "positive|negative|neutral",
                    "confidence": 0.95,
                    "emotions": ["happy", "excited"],
                    "summary": "Brief explanation"
                }"""
            },
            {
                "role": "user",
                "content": f"Analyze the sentiment of this text: {text}"
            }
        ]
        
        # This will automatically use our caching from chat_completion above
        result = await self.chat_completion(messages, temperature=0.1)
        
        try:
            sentiment_data = json.loads(result["content"])
            
            # Step 3: Cache the sentiment result separately
            await ai_cache.cache_sentiment_analysis(text, sentiment_data)
            
            logger.info("✅ Sentiment analysis cached", sentiment=sentiment_data.get("sentiment", "unknown"))
            return sentiment_data
            
        except json.JSONDecodeError:
            logger.warning("Failed to parse sentiment JSON response")
            fallback_result = {
                "sentiment": "neutral",
                "confidence": 0.5,
                "emotions": [],
                "summary": "Could not analyze sentiment"
            }
            return fallback_result

# Global OpenAI service instance (same name as before - no changes needed elsewhere!)
openai_service = OpenAIService()