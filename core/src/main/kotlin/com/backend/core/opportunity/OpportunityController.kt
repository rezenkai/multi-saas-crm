package com.backend.core.opportunity

import com.backend.core.base.BaseController
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.math.BigDecimal
import java.util.*

@RequestMapping("/opportunities")
class OpportunityController(
    private val opportunityService: OpportunityService
) : BaseController() {

    @GetMapping
    fun getAllOpportunities(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @RequestParam(required = false) search: String?,
        @RequestParam(required = false) companyId: String?,
        @RequestParam(required = false) contactId: String?,
        @RequestParam(required = false) stage: OpportunityStage?,
        @RequestParam(required = false) opportunityType: OpportunityType?,
        @RequestParam(required = false) ownerId: String?,
        @RequestParam(required = false) active: Boolean?
    ): ResponseEntity<List<OpportunityEntity>> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)

            val opportunities = when {
                !search.isNullOrBlank() -> opportunityService.searchOpportunities(tenantUUID, search)
                !companyId.isNullOrBlank() -> opportunityService.getOpportunitiesByCompany(tenantUUID, UUID.fromString(companyId))
                !contactId.isNullOrBlank() -> opportunityService.getOpportunitiesByContact(tenantUUID, UUID.fromString(contactId))
                stage != null -> opportunityService.getOpportunitiesByStage(tenantUUID, stage)
                opportunityType != null -> opportunityService.getOpportunitiesByType(tenantUUID, opportunityType)
                !ownerId.isNullOrBlank() -> opportunityService.getOpportunitiesByOwner(tenantUUID, UUID.fromString(ownerId))
                active == true -> opportunityService.getActiveOpportunities(tenantUUID)
                else -> opportunityService.getAllOpportunities(tenantUUID)
            }

            ResponseEntity.ok(opportunities)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/{id}")
    fun getOpportunityById(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String
    ): ResponseEntity<OpportunityEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val opportunityUUID = UUID.fromString(id)
            val opportunity = opportunityService.getOpportunityById(tenantUUID, opportunityUUID)
                ?: return ResponseEntity.notFound().build()
            ResponseEntity.ok(opportunity)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PostMapping
    fun createOpportunity(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @RequestHeader("X-User-ID") userId: String,
        @Valid @RequestBody opportunity: OpportunityEntity
    ): ResponseEntity<OpportunityEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val userUUID = UUID.fromString(userId)

            val newOpportunity = opportunity.copy(
                id = UUID.randomUUID(),
                tenantId = tenantUUID,
                ownerId = userUUID
            )

            val savedOpportunity = opportunityService.createOpportunity(newOpportunity)
            ResponseEntity.status(HttpStatus.CREATED).body(savedOpportunity)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PutMapping("/{id}")
    fun updateOpportunity(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String,
        @Valid @RequestBody updates: OpportunityEntity
    ): ResponseEntity<OpportunityEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val opportunityUUID = UUID.fromString(id)

            val opportunity = opportunityService.updateOpportunity(tenantUUID, opportunityUUID, updates)
                ?: return ResponseEntity.notFound().build()

            ResponseEntity.ok(opportunity)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @DeleteMapping("/{id}")
    fun deleteOpportunity(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String
    ): ResponseEntity<Void> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val opportunityUUID = UUID.fromString(id)

            val deleted = opportunityService.deleteOpportunity(tenantUUID, opportunityUUID)
            if (deleted) ResponseEntity.noContent().build()
            else ResponseEntity.notFound().build()
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/open")
    fun getOpenOpportunities(
        @RequestHeader("X-Tenant-ID") tenantId: String
    ): ResponseEntity<List<OpportunityEntity>> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val opportunities = opportunityService.getOpenOpportunities(tenantUUID)
            ResponseEntity.ok(opportunities)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/analytics")
    fun getOpportunityAnalytics(
        @RequestHeader("X-Tenant-ID") tenantId: String
    ): ResponseEntity<Map<String, Any>> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val analytics = opportunityService.getOpportunityAnalytics(tenantUUID)
            ResponseEntity.ok(analytics)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/count")
    fun getOpportunityCount(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @RequestParam(required = false) stage: OpportunityStage?
    ): ResponseEntity<Map<String, Long>> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val count = if (stage != null) {
                opportunityService.getOpportunityCountByStage(tenantUUID, stage)
            } else {
                opportunityService.getOpportunityCount(tenantUUID)
            }
            ResponseEntity.ok(mapOf("count" to count))
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PatchMapping("/{id}/stage/{stage}")
    fun updateOpportunityStage(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String,
        @PathVariable stage: OpportunityStage
    ): ResponseEntity<OpportunityEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val opportunityUUID = UUID.fromString(id)

            val opportunity = opportunityService.updateOpportunityStage(tenantUUID, opportunityUUID, stage)
                ?: return ResponseEntity.notFound().build()

            ResponseEntity.ok(opportunity)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PatchMapping("/{id}/close-won")
    fun closeOpportunityAsWon(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String
    ): ResponseEntity<OpportunityEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val opportunityUUID = UUID.fromString(id)

            val opportunity = opportunityService.closeOpportunityAsWon(tenantUUID, opportunityUUID)
                ?: return ResponseEntity.notFound().build()

            ResponseEntity.ok(opportunity)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PatchMapping("/{id}/close-lost")
    fun closeOpportunityAsLost(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String
    ): ResponseEntity<OpportunityEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val opportunityUUID = UUID.fromString(id)

            val opportunity = opportunityService.closeOpportunityAsLost(tenantUUID, opportunityUUID)
                ?: return ResponseEntity.notFound().build()

            ResponseEntity.ok(opportunity)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }
}