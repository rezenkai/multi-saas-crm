package com.backend.core.company

import jakarta.persistence.*
import jakarta.validation.constraints.Email
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.math.BigDecimal
import java.time.LocalDateTime
import java.util.*

@Entity
@Table(name = "companies")
data class CompanyEntity(
    @Id
    @Column(columnDefinition = "UUID")
    val id: UUID = UUID.randomUUID(),

    @Column(name = "tenant_id", nullable = false, columnDefinition = "UUID")
    val tenantId: UUID,

    @Column(name = "owner_id", nullable = false, columnDefinition = "UUID")
    val ownerId: UUID,

    // Основная информация
    @Column(nullable = false, length = 255)
    val name: String,

    @Column(name = "legal_name", length = 255)
    val legalName: String? = null,

    @Column(columnDefinition = "TEXT")
    val description: String? = null,

    // Тип компании
    @Enumerated(EnumType.STRING)
    @Column(name = "company_type")
    val companyType: CompanyType = CompanyType.PROSPECT,

    // Контактная информация
    @Email
    @Column(length = 255)
    val email: String? = null,

    @Column(length = 20)
    val phone: String? = null,

    @Column(length = 500)
    val website: String? = null,

    // Адрес
    @Column(columnDefinition = "TEXT")
    val address: String? = null,

    @Column(length = 100)
    val city: String? = null,

    @Column(length = 100)
    val state: String? = null,

    @Column(length = 100)
    val country: String? = null,

    @Column(name = "postal_code", length = 20)
    val postalCode: String? = null,

    // Дополнительная информация
    @Column(length = 100)
    val industry: String? = null,

    @Column(length = 50)
    val size: String? = null, // small, medium, large

    @Column(name = "company_size", length = 50)
    val companySize: String? = null, // STARTUP, SMALL, MEDIUM, LARGE, ENTERPRISE

    @Column(name = "annual_revenue", precision = 15, scale = 2)
    val annualRevenue: BigDecimal? = null,

    // Социальные сети
    @Column(name = "linkedin_url", length = 500)
    val linkedinUrl: String? = null,

    @Column(name = "twitter_url", length = 500)
    val twitterUrl: String? = null,

    @Column(name = "facebook_url", length = 500)
    val facebookUrl: String? = null,

    // Статус
    @Column(name = "is_active")
    val isActive: Boolean = true,

    @Column(name = "is_verified")
    val isVerified: Boolean = false,

    // Источник
    @Column(length = 100)
    val source: String? = null,

    @Column(columnDefinition = "TEXT")
    val notes: String? = null,

    // Метаданные
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @UpdateTimestamp
    @Column(name = "updated_at")
    val updatedAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "last_contacted")
    val lastContacted: LocalDateTime? = null
)

enum class CompanyType {
    CUSTOMER, PARTNER, VENDOR, COMPETITOR, PROSPECT
}