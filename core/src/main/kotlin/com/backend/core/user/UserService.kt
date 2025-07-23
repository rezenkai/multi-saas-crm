package com.backend.core.user

import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.util.*

@Service
@Transactional
class UserService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder
) {

    fun findByEmail(email: String): UserEntity? =
        userRepository.findByEmail(email)

    fun findById(id: UUID): UserEntity? =
        userRepository.findById(id).orElse(null)

    fun existsByEmail(email: String): Boolean =
        userRepository.existsByEmail(email)

    fun save(user: UserEntity): UserEntity =
        userRepository.save(user)

    fun findActiveByEmail(email: String): UserEntity? =
        userRepository.findActiveByEmail(email)

    fun updateProfile(userId: UUID, updates: UserEntity): UserEntity? {
        val existing = userRepository.findById(userId).orElse(null) ?: return null

        val updated = existing.copy(
            firstName = updates.firstName ?: existing.firstName,
            lastName = updates.lastName ?: existing.lastName,
            username = updates.username ?: existing.username,
            phone = updates.phone ?: existing.phone,
            title = updates.title ?: existing.title,
            department = updates.department ?: existing.department,
            bio = updates.bio ?: existing.bio,
            timezone = updates.timezone,
            locale = updates.locale,
            theme = updates.theme,
            updatedAt = LocalDateTime.now()
        )

        return userRepository.save(updated)
    }

    fun updateSettings(userId: UUID, settings: UserEntity): UserEntity? {
        val existing = userRepository.findById(userId).orElse(null) ?: return null

        val updated = existing.copy(
            timezone = settings.timezone,
            locale = settings.locale,
            theme = settings.theme,
            emailNotifications = settings.emailNotifications,
            smsNotifications = settings.smsNotifications,
            pushNotifications = settings.pushNotifications,
            marketingNotifications = settings.marketingNotifications,
            updatedAt = LocalDateTime.now()
        )

        return userRepository.save(updated)
    }

    fun changePassword(userId: UUID, currentPassword: String, newPassword: String, confirmPassword: String) {
        if (newPassword != confirmPassword) {
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
            failedLoginAttempts = 0,
            updatedAt = LocalDateTime.now()
        )

        userRepository.save(updatedUser)
    }

    fun deactivateUser(userId: UUID): UserEntity? {
        val user = userRepository.findById(userId).orElse(null) ?: return null

        val updatedUser = user.copy(
            isActive = false,
            email = "deleted_${UUID.randomUUID()}_${user.email}",
            updatedAt = LocalDateTime.now()
        )

        return userRepository.save(updatedUser)
    }

    fun updateAvatar(userId: UUID, avatarUrl: String): UserEntity? {
        val user = userRepository.findById(userId).orElse(null) ?: return null

        val updatedUser = user.copy(
            avatarUrl = avatarUrl,
            updatedAt = LocalDateTime.now()
        )

        return userRepository.save(updatedUser)
    }

    fun removeAvatar(userId: UUID): UserEntity? {
        val user = userRepository.findById(userId).orElse(null) ?: return null

        val updatedUser = user.copy(
            avatarUrl = null,
            updatedAt = LocalDateTime.now()
        )

        return userRepository.save(updatedUser)
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
}