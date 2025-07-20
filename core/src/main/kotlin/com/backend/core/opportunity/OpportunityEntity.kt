package com.backend.core.opportunity

import com.backend.core.company.CompanyEntity
import com.backend.core.contact.ContactEntity
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.*

@Entity
@Table(name = "opportunities")
data class OpportunityEntity(
    @Id
    @Column(columnDefinition = "UUID")
    val id: UUID = UUID.randomUUID(),

    @Column(name = "tenant_id", nullable = false, columnDefinition = "UUID")
    val tenantId: UUID,

    @Column(name = "owner_id", nullable = false, columnDefinition = "UUID")
    val ownerId: UUID,

    @Column(name = "company_id", columnDefinition = "UUID")
    val companyId: UUID? = null,

    @Column(name = "contact_id", columnDefinition = "UUID")
    val contactId: UUID? = null,

    // Основная информация
    @Column(nullable = false, length = 255)
    val name: String,

    @Column(columnDefinition = "TEXT")
    val description: String? = null,

    // Стадия и тип
    @Enumerated(EnumType.STRING)
    val stage: OpportunityStage = OpportunityStage.PROSPECTING,

    @Enumerated(EnumType.STRING)
    @Column(name = "opportunity_type")
    val opportunityType: OpportunityType = OpportunityType.NEW_BUSINESS,

    @Enumerated(EnumType.STRING)
    @Column(name = "lead_source")
    val leadSource: LeadSource? = null,

    // Финансовая информация
    @Column(precision = 15, scale = 2)
    val amount: BigDecimal? = null,

    val probability: Int = 0, // 0-100

    @Column(name = "expected_revenue", precision = 15, scale = 2)
    val expectedRevenue: BigDecimal? = null,

    // Даты
    @Column(name = "close_date")
    val closeDate: LocalDate? = null,

    @Column(name = "actual_close_date")
    val actualCloseDate: LocalDate? = null,

    // Дополнительная информация
    @Column(name = "next_step", length = 500)
    val nextStep: String? = null,

    @Column(columnDefinition = "TEXT")
    val notes: String? = null,

    // Статус
    @Column(name = "is_active")
    val isActive: Boolean = true,

    @Column(name = "is_closed")
    val isClosed: Boolean = false,

    @Column(name = "is_won")
    val isWon: Boolean = false,

    // Метаданные
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @UpdateTimestamp
    @Column(name = "updated_at")
    val updatedAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "last_activity")
    val lastActivity: LocalDateTime? = null,

    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", insertable = false, updatable = false)
    val company: CompanyEntity? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contact_id", insertable = false, updatable = false)
    val contact: ContactEntity? = null
)


enum class OpportunityStage {
    PROSPECTING, QUALIFICATION, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST
}

enum class OpportunityType {
    NEW_BUSINESS, EXISTING_BUSINESS, RENEWAL, UPSELL, CROSS_SELL
}

enum class LeadSource {
    WEBSITE, REFERRAL, COLD_CALL, EMAIL, SOCIAL_MEDIA, CONFERENCE, PARTNER, OTHER
}