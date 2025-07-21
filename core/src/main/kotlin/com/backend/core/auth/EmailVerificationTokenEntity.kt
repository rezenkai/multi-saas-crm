package com.backend.core.auth

import jakarta.persistence.*
import java.time.LocalDateTime
import java.util.*

@Entity
@Table(name = "email_verification_tokens")
data class EmailVerificationTokenEntity(
    @Id
    @GeneratedValue
    val id: UUID? = null,

    @Column(nullable = false, unique = true)
    val token: String,

    @Column(nullable = false)
    val userId: UUID,

    @Column(nullable = false)
    val expiresAt: LocalDateTime
)
