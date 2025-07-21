package com.backend.core.auth

import com.backend.core.security.JwtService
import com.backend.core.security.TokenPair
import com.backend.core.user.UserEntity
import com.backend.core.user.UserRepository
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.util.*

@Service
@Transactional
class AuthService(
    val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtService: JwtService,
    private val authenticationManager: AuthenticationManager,
    private val emailVerificationTokenRepository: EmailVerificationTokenRepository,
) {

    fun register(email: String, password: String, passwordConfirm: String, firstName: String, lastName: String): Map<String, Any> {
        if (password != passwordConfirm) {
            throw IllegalArgumentException("Passwords do not match")
        }

        if (userRepository.existsByEmail(email)) {
            throw IllegalArgumentException("User with email $email already exists")
        }

        validatePasswordStrength(password)

        val user = UserEntity(
            email = email,
            hashedPassword = passwordEncoder.encode(password),
            firstName = firstName,
            lastName = lastName,
            isActive = true,
            isVerified = false
        )

        val savedUser = userRepository.save(user)

        val token = UUID.randomUUID().toString()
        val verificationToken = EmailVerificationTokenEntity(
            token = token,
            userId = savedUser.id,
            expiresAt = LocalDateTime.now().plusHours(24)
        )
        emailVerificationTokenRepository.save(verificationToken)

        val verificationLink = "https://yourdomain.com/auth/verify-email?token=$token"
        mailService.sendEmailVerification(email, verificationLink)

        return mapOf(
            "message" to "Registration successful. Please check your email to verify your account.",
            "userId" to savedUser.id.toString(),
            "email" to savedUser.email
        )
    }

    fun verifyEmail(token: String): Map<String, Any> {
        val verificationToken = emailVerificationTokenRepository.findByToken(token)
            ?: throw IllegalArgumentException("Invalid verification token")

        if (verificationToken.expiresAt.isBefore(LocalDateTime.now())) {
            throw IllegalArgumentException("Verification token has expired")
        }

        val user = userRepository.findById(verificationToken.userId).orElse(null)
            ?: throw IllegalArgumentException("User not found")

        if (user.isVerified) {
            return mapOf("message" to "Email is already verified")
        }

        val updatedUser = user.copy(isVerified = true)
        userRepository.save(updatedUser)

        emailVerificationTokenRepository.deleteByUserId(user.id!!)

        return mapOf("message" to "Email verified successfully")
    }



    fun login(email: String, password: String, tenantId: String? = null): TokenPair {
        try {
            authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken(email, password)
            )

            val user = userRepository.findActiveByEmail(email)
                ?: throw BadCredentialsException("Invalid email or password")

            if (user.lockedUntil?.isAfter(LocalDateTime.now()) == true) {
                throw BadCredentialsException("Account is temporarily locked")
            }

            val updatedUser = user.copy(
                failedLoginAttempts = 0,
                lastLogin = LocalDateTime.now()
            )
            userRepository.save(updatedUser)

            // For now using default values - TODO: implement proper tenant management
            val resolvedTenantId = tenantId ?: "default-tenant"
            val role = "user"

            return jwtService.generateTokenPair(user, resolvedTenantId, role)

        } catch (e: BadCredentialsException) {
            val user = userRepository.findByEmail(email)
            user?.let {
                val attempts = it.failedLoginAttempts + 1
                val updatedUser = if (attempts >= 5) {
                    it.copy(
                        failedLoginAttempts = attempts,
                        lockedUntil = LocalDateTime.now().plusMinutes(30)
                    )
                } else {
                    it.copy(failedLoginAttempts = attempts)
                }
                userRepository.save(updatedUser)
            }
            throw BadCredentialsException("Invalid email or password")
        }
    }

    fun refreshToken(refreshToken: String): TokenPair {
        try {
            if (!jwtService.isRefreshToken(refreshToken)) {
                throw BadCredentialsException("Invalid token type")
            }

            val userEmail = jwtService.extractUsername(refreshToken)
            val user = userRepository.findActiveByEmail(userEmail)
                ?: throw BadCredentialsException("User not found")

            if (jwtService.isTokenValid(refreshToken, user)) {
                val tenantId = jwtService.extractTenantId(refreshToken)
                val role = jwtService.extractRole(refreshToken)

                return jwtService.generateTokenPair(user, tenantId, role)
            } else {
                throw BadCredentialsException("Invalid or expired token")
            }
        } catch (e: Exception) {
            throw BadCredentialsException("Failed to refresh token")
        }
    }

    fun changePassword(userId: UUID, currentPassword: String, newPassword: String, newPasswordConfirm: String) {
        if (newPassword != newPasswordConfirm) {
            throw IllegalArgumentException("New passwords do not match")
        }

        val user = userRepository.findById(userId).orElse(null)
            ?: throw IllegalArgumentException("User not found")

        if (!passwordEncoder.matches(currentPassword, user.hashedPassword)) {
            throw IllegalArgumentException("Current password is incorrect")
        }

        validatePasswordStrength(newPassword)

        if (passwordEncoder.matches(newPassword, user.hashedPassword)) {
            throw IllegalArgumentException("New password must be different from current password")
        }

        val updatedUser = user.copy(
            hashedPassword = passwordEncoder.encode(newPassword),
            failedLoginAttempts = 0
        )
        userRepository.save(updatedUser)
    }

    fun getCurrentUser(userId: UUID): UserEntity {
        return userRepository.findById(userId).orElse(null)
            ?: throw IllegalArgumentException("User not found")
    }

    private fun validatePasswordStrength(password: String) {
        val minLength = 8
        if (password.length < minLength) {
            throw IllegalArgumentException("Password must be at least $minLength characters long")
        }
        if (!password.any { it.isDigit() }) {
            throw IllegalArgumentException("Password must contain at least one digit")
        }
        if (!password.any { it.isUpperCase() }) {
            throw IllegalArgumentException("Password must contain at least one uppercase letter")
        }
        if (!password.any { it.isLowerCase() }) {
            throw IllegalArgumentException("Password must contain at least one lowercase letter")
        }
        if (!password.any { "!@#$%^&*()_+-=[]{}|;:,.<>?".contains(it) }) {
            throw IllegalArgumentException("Password must contain at least one special character")
        }
    }

    fun getRolePermissions(role: String): List<String> {
        return when (role) {
            "admin" -> listOf(
                "read:all", "write:all", "delete:all",
                "manage:users", "manage:settings"
            )
            "manager" -> listOf(
                "read:contacts", "write:contacts", "read:companies",
                "write:companies", "read:deals", "write:deals"
            )
            "user" -> listOf(
                "read:contacts", "write:contacts:own", "read:companies",
                "read:deals", "write:deals:own"
            )
            else -> emptyList()
        }
    }
}