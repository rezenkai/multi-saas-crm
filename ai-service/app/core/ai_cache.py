# Replace your entire app/core/ai_cache.py with this simple version:

"""
AI Cache - Simple alias to your existing enhanced cache manager
"""

# Import the enhanced cache manager from cache.py
from app.core.cache import ai_cache_manager, init_ai_redis

# Create aliases for backward compatibility
ai_cache = ai_cache_manager
EnhancedCacheManager = ai_cache_manager.__class__

# Export everything your OpenAI service needs
__all__ = ['ai_cache_manager', 'ai_cache', 'init_ai_redis', 'EnhancedCacheManager']