package com.backend.core.auth

import org.springframework.data.jpa.repository.JpaRepository
import java.util.*

interface EmailVerificationTokenRepository : JpaRepository<EmailVerificationTokenEntity, UUID> {
    fun findByToken(token: String): EmailVerificationTokenEntity?
    fun deleteByUserId(userId: UUID)
}
