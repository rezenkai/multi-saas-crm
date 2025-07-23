package com.backend.core.contact

import com.backend.core.company.CompanyEntity
import jakarta.persistence.*
import jakarta.validation.constraints.Email
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.LocalDateTime
import java.util.*

@Entity
@Table(name = "contacts")
data class ContactEntity(
    @Id
    @Column(columnDefinition = "UUID")
    val id: UUID = UUID.randomUUID(),

    @Column(name = "tenant_id", nullable = false, columnDefinition = "UUID")
    val tenantId: UUID,

    @Column(name = "owner_id", nullable = false, columnDefinition = "UUID")
    val ownerId: UUID,

    @Column(name = "company_id", columnDefinition = "UUID")
    val companyId: UUID? = null,

    // Основная информация
    @Column(name = "first_name", nullable = false, length = 100)
    val firstName: String,

    @Column(name = "last_name", nullable = false, length = 100)
    val lastName: String,

    @Email
    @Column(unique = true, length = 255)
    val email: String? = null,

    @Column(length = 20)
    val phone: String? = null,

    @Column(length = 20)
    val mobile: String? = null,

    // Тип контакта
    @Enumerated(EnumType.STRING)
    @Column(name = "contact_type")
    val contactType: ContactType = ContactType.LEAD,

    // Дополнительная информация
    @Column(length = 100)
    val title: String? = null,

    @Column(length = 100)
    val department: String? = null,

    @Column(length = 100)
    val position: String? = null,

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
    val lastContacted: LocalDateTime? = null,

    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", insertable = false, updatable = false)
    val company: CompanyEntity? = null
) {
    val fullName: String
        get() = "$firstName $lastName".trim()
}

enum class ContactType {
    LEAD, CUSTOMER, PARTNER, VENDOR, EMPLOYEE
}