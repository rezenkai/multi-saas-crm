package com.backend.core.security

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class JwtAuthenticationFilter(
    private val jwtService: JwtService,
    private val userDetailsService: UserDetailsService,
    private val tokenBlacklistService: TokenBlacklistService
) : OncePerRequestFilter() {

    private val logger = LoggerFactory.getLogger(JwtAuthenticationFilter::class.java)

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val authHeader = request.getHeader("Authorization")

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response)
            return
        }

        try {
            val jwt = authHeader.substring(7)

            if (tokenBlacklistService.isTokenBlacklisted(jwt)) {
                logger.warn("Blocked request with blacklisted token")
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token is blacklisted")
                return
            }

            val userEmail = jwtService.extractUsername(jwt)

            if (userEmail.isNotEmpty() && SecurityContextHolder.getContext().authentication == null) {
                val userDetails = userDetailsService.loadUserByUsername(userEmail)

                if (jwtService.isTokenValid(jwt, userDetails) && jwtService.isAccessToken(jwt)) {
                    val tenantId = jwtService.extractTenantId(jwt)
                    val role = jwtService.extractRole(jwt)

                    request.setAttribute("tenantId", tenantId)
                    request.setAttribute("userRole", role)

                    val authToken = UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.authorities
                    )
                    authToken.details = WebAuthenticationDetailsSource().buildDetails(request)
                    SecurityContextHolder.getContext().authentication = authToken
                }
            }
        } catch (e: Exception) {
            logger.error("Cannot set user authentication", e)
        }

        filterChain.doFilter(request, response)
    }
}