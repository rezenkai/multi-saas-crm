package com.backend.core.contact

import com.backend.core.base.BaseController
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.*

@RequestMapping("/contacts")
class ContactController(
    private val contactService: ContactService
) : BaseController() {

    @GetMapping
    fun getAllContacts(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @RequestParam(required = false) search: String?
    ): ResponseEntity<List<ContactEntity>> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val contacts = if (search.isNullOrBlank()) {
                contactService.getAllContacts(tenantUUID)
            } else {
                contactService.searchContacts(tenantUUID, search)
            }
            ResponseEntity.ok(contacts)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/{id}")
    fun getContactById(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String
    ): ResponseEntity<ContactEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val contactUUID = UUID.fromString(id)
            val contact = contactService.getContactById(tenantUUID, contactUUID)
                ?: return ResponseEntity.notFound().build()
            ResponseEntity.ok(contact)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PostMapping
    fun createContact(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @RequestHeader("X-User-ID") userId: String,
        @Valid @RequestBody contact: ContactEntity
    ): ResponseEntity<ContactEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val userUUID = UUID.fromString(userId)

            val newContact = contact.copy(
                id = UUID.randomUUID(),
                tenantId = tenantUUID,
                ownerId = userUUID
            )

            val savedContact = contactService.createContact(newContact)
            ResponseEntity.status(HttpStatus.CREATED).body(savedContact)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PutMapping("/{id}")
    fun updateContact(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String,
        @Valid @RequestBody updates: ContactEntity
    ): ResponseEntity<ContactEntity> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val contactUUID = UUID.fromString(id)

            val contact = contactService.updateContact(tenantUUID, contactUUID, updates)
                ?: return ResponseEntity.notFound().build()

            ResponseEntity.ok(contact)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @DeleteMapping("/{id}")
    fun deleteContact(
        @RequestHeader("X-Tenant-ID") tenantId: String,
        @PathVariable id: String
    ): ResponseEntity<Void> {
        return try {
            val tenantUUID = UUID.fromString(tenantId)
            val contactUUID = UUID.fromString(id)

            val deleted = contactService.deleteContact(tenantUUID, contactUUID)
            if (deleted) ResponseEntity.noContent().build()
            else ResponseEntity.notFound().build()
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }
}