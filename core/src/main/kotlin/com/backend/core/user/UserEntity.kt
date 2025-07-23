package com.backend.core.user

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.userdetails.UserDetails
import java.time.LocalDateTime
import java.util.*

@Entity
@Table(name = "users")
data class UserEntity(
    @Id
    @Column(columnDefinition = "UUID")
    val id: UUID = UUID.randomUUID(),

    @Column(unique = true, nullable = false)
    val email: String,

    @Column(unique = true)
    val username: String? = null,

    @JsonIgnore
    @Column(name = "hashed_password", nullable = false)
    val hashedPassword: String,

    @Column(name = "first_name")
    val firstName: String? = null,

    @Column(name = "last_name")
    val lastName: String? = null,

    // Profile fields
    @Column(name = "avatar_url")
    val avatarUrl: String? = null,

    val phone: String? = null,
    val title: String? = null,
    val department: String? = null,

    @Column(columnDefinition = "TEXT")
    val bio: String? = null,

    // Settings
    val timezone: String = "UTC",
    val locale: String = "en",
    val theme: String = "light",

    @Column(name = "email_notifications")
    val emailNotifications: Boolean = true,

    @Column(name = "sms_notifications")
    val smsNotifications: Boolean = false,

    @Column(name = "push_notifications")
    val pushNotifications: Boolean = true,

    @Column(name = "marketing_notifications")
    val marketingNotifications: Boolean = false,

    // Status fields
    @Column(name = "is_active")
    val isActive: Boolean = true,

    @Column(name = "is_verified")
    val isVerified: Boolean = false,

    @Column(name = "is_superuser")
    val isSuperuser: Boolean = false,

    // 2FA fields
    @Column(name = "two_factor_enabled")
    val twoFactorEnabled: Boolean = false,

    @JsonIgnore
    @Column(name = "two_factor_secret")
    val twoFactorSecret: String? = null,

    @JsonIgnore
    @Column(name = "backup_codes", columnDefinition = "TEXT")
    val backupCodes: String? = null, // JSON array of backup codes

    @Column(name = "two_factor_verified_at")
    val twoFactorVerifiedAt: LocalDateTime? = null,

    // Security fields
    @JsonIgnore
    @Column(name = "failed_login_attempts")
    val failedLoginAttempts: Int = 0,

    @JsonIgnore
    @Column(name = "locked_until")
    val lockedUntil: LocalDateTime? = null,

    @Column(name = "last_login")
    val lastLogin: LocalDateTime? = null,

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @UpdateTimestamp
    @Column(name = "updated_at")
    val updatedAt: LocalDateTime = LocalDateTime.now()
) : UserDetails {

    val fullName: String
        get() = "${firstName ?: ""} ${lastName ?: ""}".trim()

    @JsonIgnore
    override fun getAuthorities(): MutableCollection<out GrantedAuthority> {
        val authorities = mutableListOf<GrantedAuthority>()
        authorities.add(SimpleGrantedAuthority("ROLE_USER"))
        if (isSuperuser) {
            authorities.add(SimpleGrantedAuthority("ROLE_ADMIN"))
        }
        return authorities
    }

    @JsonIgnore
    override fun getPassword(): String = hashedPassword

    @JsonIgnore
    override fun getUsername(): String = email

    @JsonIgnore
    override fun isAccountNonExpired(): Boolean = true

    @JsonIgnore
    override fun isAccountNonLocked(): Boolean {
        return lockedUntil?.isBefore(LocalDateTime.now()) != false
    }

    @JsonIgnore
    override fun isCredentialsNonExpired(): Boolean = true

    @JsonIgnore
    override fun isEnabled(): Boolean = isActive && isVerified
}