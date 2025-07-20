package com.backend.core.opportunity

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.*

@Service
@Transactional
class OpportunityService(
    private val opportunityRepository: OpportunityRepository
) {

    fun getAllOpportunities(tenantId: UUID): List<OpportunityEntity> =
        opportunityRepository.findByTenantId(tenantId)

    fun getOpportunityById(tenantId: UUID, opportunityId: UUID): OpportunityEntity? =
        opportunityRepository.findByTenantIdAndId(tenantId, opportunityId)

    fun getOpportunitiesByCompany(tenantId: UUID, companyId: UUID): List<OpportunityEntity> =
        opportunityRepository.findByTenantIdAndCompanyId(tenantId, companyId)

    fun getOpportunitiesByContact(tenantId: UUID, contactId: UUID): List<OpportunityEntity> =
        opportunityRepository.findByTenantIdAndContactId(tenantId, contactId)

    fun getOpportunitiesByStage(tenantId: UUID, stage: OpportunityStage): List<OpportunityEntity> =
        opportunityRepository.findByTenantIdAndStage(tenantId, stage)

    fun getOpportunitiesByType(tenantId: UUID, opportunityType: OpportunityType): List<OpportunityEntity> =
        opportunityRepository.findByTenantIdAndOpportunityType(tenantId, opportunityType)

    fun getOpportunitiesByOwner(tenantId: UUID, ownerId: UUID): List<OpportunityEntity> =
        opportunityRepository.findByTenantIdAndOwnerId(tenantId, ownerId)

    fun getActiveOpportunities(tenantId: UUID): List<OpportunityEntity> =
        opportunityRepository.findActiveByTenantId(tenantId)

    fun getOpenOpportunities(tenantId: UUID): List<OpportunityEntity> =
        opportunityRepository.findOpenOpportunitiesByTenantId(tenantId)

    fun searchOpportunities(tenantId: UUID, search: String): List<OpportunityEntity> =
        opportunityRepository.searchByTenantId(tenantId, search)

    fun getOpportunityCount(tenantId: UUID): Long =
        opportunityRepository.countByTenantId(tenantId)

    fun getOpportunityCountByStage(tenantId: UUID, stage: OpportunityStage): Long =
        opportunityRepository.countByTenantIdAndStage(tenantId, stage)

    fun createOpportunity(opportunity: OpportunityEntity): OpportunityEntity {
        val opportunityWithCalculatedFields = opportunity.copy(
            expectedRevenue = calculateExpectedRevenue(opportunity.amount, opportunity.probability),
            isClosed = isClosedStage(opportunity.stage),
            isWon = opportunity.stage == OpportunityStage.CLOSED_WON
        )
        return opportunityRepository.save(opportunityWithCalculatedFields)
    }

    fun updateOpportunity(tenantId: UUID, opportunityId: UUID, updates: OpportunityEntity): OpportunityEntity? {
        val existing = opportunityRepository.findByTenantIdAndId(tenantId, opportunityId) ?: return null

        val updated = existing.copy(
            name = updates.name,
            description = updates.description,
            stage = updates.stage,
            opportunityType = updates.opportunityType,
            leadSource = updates.leadSource,
            amount = updates.amount,
            probability = updates.probability,
            expectedRevenue = calculateExpectedRevenue(updates.amount, updates.probability),
            closeDate = updates.closeDate,
            actualCloseDate = if (isClosedStage(updates.stage)) LocalDate.now() else updates.actualCloseDate,
            nextStep = updates.nextStep,
            notes = updates.notes,
            companyId = updates.companyId,
            contactId = updates.contactId,
            isClosed = isClosedStage(updates.stage),
            isWon = updates.stage == OpportunityStage.CLOSED_WON,
            updatedAt = LocalDateTime.now(),
            lastActivity = LocalDateTime.now()
        )

        return opportunityRepository.save(updated)
    }

    fun deleteOpportunity(tenantId: UUID, opportunityId: UUID): Boolean {
        val opportunity = opportunityRepository.findByTenantIdAndId(tenantId, opportunityId) ?: return false
        opportunityRepository.delete(opportunity)
        return true
    }

    fun updateOpportunityStage(tenantId: UUID, opportunityId: UUID, stage: OpportunityStage): OpportunityEntity? {
        val existing = opportunityRepository.findByTenantIdAndId(tenantId, opportunityId) ?: return null

        val updated = existing.copy(
            stage = stage,
            isClosed = isClosedStage(stage),
            isWon = stage == OpportunityStage.CLOSED_WON,
            actualCloseDate = if (isClosedStage(stage)) LocalDate.now() else null,
            updatedAt = LocalDateTime.now(),
            lastActivity = LocalDateTime.now()
        )

        return opportunityRepository.save(updated)
    }

    fun closeOpportunityAsWon(tenantId: UUID, opportunityId: UUID): OpportunityEntity? {
        return updateOpportunityStage(tenantId, opportunityId, OpportunityStage.CLOSED_WON)
    }

    fun closeOpportunityAsLost(tenantId: UUID, opportunityId: UUID): OpportunityEntity? {
        return updateOpportunityStage(tenantId, opportunityId, OpportunityStage.CLOSED_LOST)
    }

    fun getOpportunityAnalytics(tenantId: UUID): Map<String, Any> {
        val totalRevenue = opportunityRepository.getTotalRevenueByTenantId(tenantId) ?: BigDecimal.ZERO
        val weightedPipeline = opportunityRepository.getWeightedPipelineByTenantId(tenantId) ?: BigDecimal.ZERO
        val averageDealSize = opportunityRepository.getAverageDealSizeByTenantId(tenantId) ?: BigDecimal.ZERO
        val totalCount = opportunityRepository.countByTenantId(tenantId)

        return mapOf(
            "totalRevenue" to totalRevenue,
            "weightedPipeline" to weightedPipeline,
            "averageDealSize" to averageDealSize,
            "totalOpportunities" to totalCount,
            "wonCount" to opportunityRepository.countByTenantIdAndStage(tenantId, OpportunityStage.CLOSED_WON),
            "lostCount" to opportunityRepository.countByTenantIdAndStage(tenantId, OpportunityStage.CLOSED_LOST),
            "openCount" to totalCount - opportunityRepository.countByTenantIdAndStage(tenantId, OpportunityStage.CLOSED_WON) - opportunityRepository.countByTenantIdAndStage(tenantId, OpportunityStage.CLOSED_LOST)
        )
    }

    private fun calculateExpectedRevenue(amount: BigDecimal?, probability: Int): BigDecimal? {
        return amount?.multiply(BigDecimal(probability))?.divide(BigDecimal(100))
    }

    private fun isClosedStage(stage: OpportunityStage): Boolean {
        return stage == OpportunityStage.CLOSED_WON || stage == OpportunityStage.CLOSED_LOST
    }
}