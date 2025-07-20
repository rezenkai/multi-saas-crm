package com.backend.core.contact

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.util.*

@Repository
interface ContactRepository : JpaRepository<ContactEntity, UUID> {
    fun findByTenantId(tenantId: UUID): List<ContactEntity>
    fun findByTenantId(tenantId: UUID, pageable: Pageable): Page<ContactEntity>

    fun findByTenantIdAndCompanyId(tenantId: UUID, companyId: UUID): List<ContactEntity>

    @Query("SELECT c FROM ContactEntity c WHERE c.tenantId = :tenantId AND c.id = :id")
    fun findByTenantIdAndId(@Param("tenantId") tenantId: UUID, @Param("id") id: UUID): ContactEntity?

    @Query("SELECT c FROM ContactEntity c WHERE c.tenantId = :tenantId AND " +
            "(LOWER(c.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(c.lastName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(c.position) LIKE LOWER(CONCAT('%', :search, '%')))")
    fun searchByTenantId(@Param("tenantId") tenantId: UUID, @Param("search") search: String): List<ContactEntity>

    fun countByTenantId(tenantId: UUID): Long

    @Query("SELECT c FROM ContactEntity c WHERE c.tenantId = :tenantId AND c.email = :email")
    fun findByTenantIdAndEmail(@Param("tenantId") tenantId: UUID, @Param("email") email: String): ContactEntity?

    fun findByTenantIdAndContactType(tenantId: UUID, contactType: ContactType): List<ContactEntity>
    fun findByTenantIdAndOwnerId(tenantId: UUID, ownerId: UUID): List<ContactEntity>

    @Query("SELECT c FROM ContactEntity c WHERE c.tenantId = :tenantId AND c.isActive = true")
    fun findActiveByTenantId(@Param("tenantId") tenantId: UUID): List<ContactEntity>
}