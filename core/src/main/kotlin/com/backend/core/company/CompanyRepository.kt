package com.backend.core.company

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.util.*

@Repository
interface CompanyRepository : JpaRepository<CompanyEntity, UUID> {
    fun findByTenantId(tenantId: UUID): List<CompanyEntity>
    fun findByTenantId(tenantId: UUID, pageable: Pageable): Page<CompanyEntity>

    @Query("SELECT c FROM CompanyEntity c WHERE c.tenantId = :tenantId AND c.id = :id")
    fun findByTenantIdAndId(@Param("tenantId") tenantId: UUID, @Param("id") id: UUID): CompanyEntity?

    @Query("SELECT c FROM CompanyEntity c WHERE c.tenantId = :tenantId AND " +
            "(LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(c.legalName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')))")
    fun searchByTenantId(@Param("tenantId") tenantId: UUID, @Param("search") search: String): List<CompanyEntity>

    fun countByTenantId(tenantId: UUID): Long
    fun findByTenantIdAndIndustry(tenantId: UUID, industry: String): List<CompanyEntity>
    fun findByTenantIdAndCompanyType(tenantId: UUID, companyType: CompanyType): List<CompanyEntity>
    fun findByTenantIdAndOwnerId(tenantId: UUID, ownerId: UUID): List<CompanyEntity>

    @Query("SELECT c FROM CompanyEntity c WHERE c.tenantId = :tenantId AND c.isActive = true")
    fun findActiveByTenantId(@Param("tenantId") tenantId: UUID): List<CompanyEntity>
    fun existsByTenantIdAndEmail(tenantId: UUID, email: String): Boolean
}