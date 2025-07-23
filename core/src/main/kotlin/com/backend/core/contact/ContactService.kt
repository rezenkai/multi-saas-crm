package com.backend.core.contact

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.util.*

@Service
@Transactional
class ContactService(
    private val contactRepository: ContactRepository
) {

    fun getAllContacts(tenantId: UUID): List<ContactEntity> =
        contactRepository.findByTenantId(tenantId)

    fun getContactById(tenantId: UUID, contactId: UUID): ContactEntity? =
        contactRepository.findByTenantIdAndId(tenantId, contactId)

    fun searchContacts(tenantId: UUID, search: String): List<ContactEntity> =
        contactRepository.searchByTenantId(tenantId, search)

    fun createContact(contact: ContactEntity): ContactEntity {
        // Check email uniqueness
        contact.email?.let { email ->
            contactRepository.findByTenantIdAndEmail(contact.tenantId, email)?.let {
                throw IllegalArgumentException("Email already exists")
            }
        }
        return contactRepository.save(contact)
    }

    fun updateContact(tenantId: UUID, contactId: UUID, updates: ContactEntity): ContactEntity? {
        val existing = contactRepository.findByTenantIdAndId(tenantId, contactId) ?: return null

        val updated = existing.copy(
            firstName = updates.firstName,
            lastName = updates.lastName,
            email = updates.email,
            phone = updates.phone,
            mobile = updates.mobile,
            contactType = updates.contactType,
            title = updates.title,
            department = updates.department,
            position = updates.position,
            companyId = updates.companyId,
            updatedAt = LocalDateTime.now()
        )

        return contactRepository.save(updated)
    }

    fun deleteContact(tenantId: UUID, contactId: UUID): Boolean {
        val contact = contactRepository.findByTenantIdAndId(tenantId, contactId) ?: return false
        contactRepository.delete(contact)
        return true
    }
}