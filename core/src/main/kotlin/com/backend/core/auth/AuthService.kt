package com.backend.core.auth

import com.backend.core.security.JwtService
import com.backend.core.security.TokenPair
import com.backend.core.user.UserEntity
import com.backend.core.user.UserRepository
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
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
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtService: JwtService,
    private val authenticationManager: AuthenticationManager,
    private val twoFactorService: TwoFactorService
) {

    private val objectMapper = jacksonObjectMapper()

    fun login(email: String, password: String, twoFactorCode: Int? = null, tenantId: String? = null): TokenPair {
        try {
            // Step 1: Authenticate user credentials
            authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken(email, password)
            )

            // Step 2: Get user details
            val user = userRepository.findActiveByEmail(email)
                ?: throw BadCredentialsException("Invalid email or password")

            // Step 3: Check if account is locked
            if (user.lockedUntil?.isAfter(LocalDateTime.now()) == true) {
                throw BadCredentialsException("Account is temporarily locked")
            }

            // Step 4: Check 2FA if enabled
            if (user.twoFactorEnabled) {
                if (twoFactorCode == null) {
                    throw TwoFactorRequiredException("Two-factor authentication code required")
                }

                // Verify 2FA code
                val isValidCode = user.twoFactorSecret?.let { secret ->
                    twoFactorService.verifyCode(secret, twoFactorCode)
                } ?: false

                // Check backup codes if main code fails
                val isValidBackupCode = if (!isValidCode && user.backupCodes != null) {
                    verifyBackupCode(user, twoFactorCode.toString())
                } else false

                if (!isValidCode && !isValidBackupCode) {
                    throw BadCredentialsException("Invalid two-factor authentication code")
                }

                // Update 2FA verification timestamp
                val updatedUser = user.copy(twoFactorVerifiedAt = LocalDateTime.now())
                userRepository.save(updatedUser)
            }

            // Step 5: Reset failed login attempts and update last login
            val updatedUser = user.copy(
                failedLoginAttempts = 0,
                lastLogin = LocalDateTime.now()
            )
            userRepository.save(updatedUser)

            // Step 6: Generate tokens
            val resolvedTenantId = tenantId ?: "default-tenant"
            val role = if (user.isSuperuser) "admin" else "user"

            return jwtService.generateTokenPair(user, resolvedTenantId, role)

        } catch (e: TwoFactorRequiredException) {
            throw e
        } catch (e: BadCredentialsException) {
            handleFailedLogin(email)
            throw BadCredentialsException("Invalid email or password")
        }
    }

    fun enableTwoFactor(userId: UUID): Map<String, Any> {
        val user = userRepository.findById(userId).orElse(null)
            ?: throw IllegalArgumentException("User not found")

        if (user.twoFactorEnabled) {
            throw IllegalArgumentException("Two-factor authentication is already enabled")
        }

        val secretKey = twoFactorService.generateSecretKey()
        val qrCodeUrl = twoFactorService.generateQRCodeUrl(user.email, secretKey)
        val backupCodes = twoFactorService.generateBackupCodes()

        val updatedUser = user.copy(
            twoFactorSecret = secretKey,
            backupCodes = objectMapper.writeValueAsString(backupCodes),
            updatedAt = LocalDateTime.now()
        )
        userRepository.save(updatedUser)

        return mapOf(
            "secretKey" to secretKey,
            "qrCodeUrl" to qrCodeUrl,
            "backupCodes" to backupCodes,
            "message" to "Scan QR code with your authenticator app and verify with a code to complete setup"
        )
    }

    fun verifyAndEnableTwoFactor(userId: UUID, verificationCode: Int): Map<String, String> {
        val user = userRepository.findById(userId).orElse(null)
            ?: throw IllegalArgumentException("User not found")

        if (user.twoFactorEnabled) {
            throw IllegalArgumentException("Two-factor authentication is already enabled")
        }

        val secretKey = user.twoFactorSecret
            ?: throw IllegalArgumentException("Two-factor setup not initiated")

        if (!twoFactorService.verifyCode(secretKey, verificationCode)) {
            throw IllegalArgumentException("Invalid verification code")
        }

        val updatedUser = user.copy(
            twoFactorEnabled = true,
            twoFactorVerifiedAt = LocalDateTime.now(),
            updatedAt = LocalDateTime.now()
        )
        userRepository.save(updatedUser)

        return mapOf("message" to "Two-factor authentication enabled successfully")
    }

    fun disableTwoFactor(userId: UUID, verificationCode: Int): Map<String, String> {
        val user = userRepository.findById(userId).orElse(null)
            ?: throw IllegalArgumentException("User not found")

        if (!user.twoFactorEnabled) {
            throw IllegalArgumentException("Two-factor authentication is not enabled")
        }

        val secretKey = user.twoFactorSecret
            ?: throw IllegalArgumentException("Two-factor secret not found")

        if (!twoFactorService.verifyCode(secretKey, verificationCode)) {
            throw IllegalArgumentException("Invalid verification code")
        }

        val updatedUser = user.copy(
            twoFactorEnabled = false,
            twoFactorSecret = null,
            backupCodes = null,
            twoFactorVerifiedAt = null,
            updatedAt = LocalDateTime.now()
        )
        userRepository.save(updatedUser)

        return mapOf("message" to "Two-factor authentication disabled successfully")
    }

    fun regenerateBackupCodes(userId: UUID, verificationCode: Int): Map<String, Any> {
        val user = userRepository.findById(userId).orElse(null)
            ?: throw IllegalArgumentException("User not found")

        if (!user.twoFactorEnabled) {
            throw IllegalArgumentException("Two-factor authentication is not enabled")
        }

        val secretKey = user.twoFactorSecret
            ?: throw IllegalArgumentException("Two-factor secret not found")

        if (!twoFactorService.verifyCode(secretKey, verificationCode)) {
            throw IllegalArgumentException("Invalid verification code")
        }

        val newBackupCodes = twoFactorService.generateBackupCodes()

        val updatedUser = user.copy(
            backupCodes = objectMapper.writeValueAsString(newBackupCodes),
            updatedAt = LocalDateTime.now()
        )
        userRepository.save(updatedUser)

        return mapOf(
            "backupCodes" to newBackupCodes,
            "message" to "New backup codes generated. Store them safely!"
        )
    }

    private fun verifyBackupCode(user: UserEntity, code: String): Boolean {
        val backupCodesJson = user.backupCodes ?: return false
        val backupCodes = objectMapper.readValue(backupCodesJson, Array<String>::class.java).toMutableList()

        return if (backupCodes.contains(code.uppercase())) {
            // Remove used backup code
            backupCodes.remove(code.uppercase())
            val updatedUser = user.copy(
                backupCodes = objectMapper.writeValueAsString(backupCodes),
                updatedAt = LocalDateTime.now()
            )
            userRepository.save(updatedUser)
            true
        } else {
            false
        }
    }

    private fun handleFailedLogin(email: String) {
        val user = userRepository.findByEmail(email) ?: return
        val attempts = user.failedLoginAttempts + 1
        val updatedUser = if (attempts >= 5) {
            user.copy(
                failedLoginAttempts = attempts,
                lockedUntil = LocalDateTime.now().plusMinutes(30)
            )
        } else {
            user.copy(failedLoginAttempts = attempts)
        }
        userRepository.save(updatedUser)
    }

    // ... rest of existing methods (register, refreshToken, changePassword, etc.)
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
            isVerified = true
        )

        val savedUser = userRepository.save(user)

        return mapOf(
            "message" to "Registration successful. You can now log in.",
            "userId" to savedUser.id.toString(),
            "email" to savedUser.email
        )
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