package com.backend.core.security

import com.backend.core.config.JwtConfig
import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.stereotype.Service
import java.util.*
import javax.crypto.SecretKey

@Service
class JwtService(
    private val jwtConfig: JwtConfig
) {

    private val signInKey: SecretKey by lazy {
        Keys.hmacShaKeyFor(jwtConfig.secret.toByteArray())
    }

    fun generateAccessToken(userDetails: UserDetails, tenantId: String, role: String): String {
        val claims = hashMapOf<String, Any>(
            "sub" to userDetails.username,
            "tenant_id" to tenantId,
            "role" to role,
            "type" to "access"
        )

        return buildToken(claims, jwtConfig.accessTokenExpiration)
    }

    fun generateRefreshToken(userDetails: UserDetails, tenantId: String, role: String): String {
        val claims = hashMapOf<String, Any>(
            "sub" to userDetails.username,
            "tenant_id" to tenantId,
            "role" to role,
            "type" to "refresh",
            "jti" to UUID.randomUUID().toString()
        )

        return buildToken(claims, jwtConfig.refreshTokenExpiration)
    }

    fun generateTokenPair(userDetails: UserDetails, tenantId: String, role: String): TokenPair {
        return TokenPair(
            accessToken = generateAccessToken(userDetails, tenantId, role),
            refreshToken = generateRefreshToken(userDetails, tenantId, role),
            tokenType = "bearer",
            expiresIn = jwtConfig.accessTokenExpiration / 1000
        )
    }

    private fun buildToken(extraClaims: Map<String, Any>, expiration: Long): String {
        return Jwts.builder()
            .claims(extraClaims)
            .issuedAt(Date(System.currentTimeMillis()))
            .expiration(Date(System.currentTimeMillis() + expiration))
            .signWith(signInKey)
            .compact()
    }

    fun extractUsername(token: String): String {
        return extractClaim(token, Claims::getSubject)
    }

    fun extractTenantId(token: String): String {
        return extractClaim(token) { claims -> claims["tenant_id"] as String }
    }

    fun extractRole(token: String): String {
        return extractClaim(token) { claims -> claims["role"] as String }
    }

    fun extractTokenType(token: String): String {
        return extractClaim(token) { claims -> claims["type"] as String }
    }

    fun <T> extractClaim(token: String, claimsResolver: (Claims) -> T): T {
        val claims = extractAllClaims(token)
        return claimsResolver(claims)
    }

    private fun extractAllClaims(token: String): Claims {
        return Jwts.parser()
            .verifyWith(signInKey)
            .build()
            .parseSignedClaims(token)
            .payload
    }

    fun isTokenValid(token: String, userDetails: UserDetails): Boolean {
        val username = extractUsername(token)
        return username == userDetails.username && !isTokenExpired(token)
    }

    fun isAccessToken(token: String): Boolean {
        return extractTokenType(token) == "access"
    }

    fun isRefreshToken(token: String): Boolean {
        return extractTokenType(token) == "refresh"
    }

    private fun isTokenExpired(token: String): Boolean {
        return extractExpiration(token).before(Date())
    }

    private fun extractExpiration(token: String): Date {
        return extractClaim(token, Claims::getExpiration)
    }

    fun getExpiration(token: String): Date {
        return extractExpiration(token)
    }
}

data class TokenPair(
    val accessToken: String,
    val refreshToken: String,
    val tokenType: String,
    val expiresIn: Long
)