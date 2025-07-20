package com.backend.core.company

import com.backend.core.base.BaseController
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.*

@RequestMapping("/companies")
class CompanyController(
    private val companyService: CompanyService
) : BaseController() {

    @GetMapping
    fun getAllCompanies(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @RequestParam(required = false) search: String?
    ): ResponseEntity<List<CompanyEntity>> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val companies = if (search.isNullOrBlank()) {
                companyService.getAllCompanies(tenantUUID)
            } else {
                companyService.searchCompanies(tenantUUID, search)
            }
            ResponseEntity.ok(companies)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/{id}")
    fun getCompanyById(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String
    ): ResponseEntity<CompanyEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val companyUUID = UUID.fromString(id)
            val company = companyService.getCompanyById(tenantUUID, companyUUID)
                ?: return ResponseEntity.notFound().build()
            ResponseEntity.ok(company)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PostMapping
    fun createCompany(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @RequestHeader("X-User-ID") userId: String,
        @Valid @RequestBody company: CompanyEntity
    ): ResponseEntity<CompanyEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val userUUID = UUID.fromString(userId)

            val newCompany = company.copy(
                id = UUID.randomUUID(),
                tenantId = tenantUUID,
                ownerId = userUUID
            )

            val savedCompany = companyService.createCompany(newCompany)
            ResponseEntity.status(HttpStatus.CREATED).body(savedCompany)
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().build()
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PutMapping("/{id}")
    fun updateCompany(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String,
        @Valid @RequestBody updates: CompanyEntity
    ): ResponseEntity<CompanyEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val companyUUID = UUID.fromString(id)

            val company = companyService.updateCompany(tenantUUID, companyUUID, updates)
                ?: return ResponseEntity.notFound().build()

            ResponseEntity.ok(company)
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().build()
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @DeleteMapping("/{id}")
    fun deleteCompany(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String
    ): ResponseEntity<Void> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val companyUUID = UUID.fromString(id)

            val deleted = companyService.deleteCompany(tenantUUID, companyUUID)
            if (deleted) ResponseEntity.noContent().build()
            else ResponseEntity.notFound().build()
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/industry/{industry}")
    fun getCompaniesByIndustry(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable industry: String
    ): ResponseEntity<List<CompanyEntity>> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val companies = companyService.getCompaniesByIndustry(tenantUUID, industry)
            ResponseEntity.ok(companies)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/owner/{ownerId}")
    fun getCompaniesByOwner(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable ownerId: String
    ): ResponseEntity<List<CompanyEntity>> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val ownerUUID = UUID.fromString(ownerId)
            val companies = companyService.getCompaniesByOwner(tenantUUID, ownerUUID)
            ResponseEntity.ok(companies)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/active")
    fun getActiveCompanies(
        @RequestHeader("X-Tenant-ID") tenantId: String
    ): ResponseEntity<List<CompanyEntity>> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val companies = companyService.getActiveCompanies(tenantUUID)
            ResponseEntity.ok(companies)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/count")
    fun getCompanyCount(
        @RequestHeader("X-Tenant-ID") tenantId: String
    ): ResponseEntity<Map<String, Long>> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val count = companyService.getCompanyCount(tenantUUID)
            ResponseEntity.ok(mapOf("count" to count))
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }
}