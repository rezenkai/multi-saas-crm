package com.backend.core.security

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.time.Duration

@Service
class TokenBlacklistService(
    private val redisTemplate: StringRedisTemplate
) {

    fun blacklistToken(token: String, expiresInSeconds: Long) {
        val key = "blacklist:$token"
        redisTemplate.opsForValue().set(key, "blacklisted", Duration.ofSeconds(expiresInSeconds))
    }

    fun isTokenBlacklisted(token: String): Boolean {
        val key = "blacklist:$token"
        return redisTemplate.hasKey(key)
    }
}
