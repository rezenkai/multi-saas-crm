package com.backend.core.auth

import com.backend.core.base.BaseController
import com.backend.core.user.UserEntity
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RequestMapping("/auth/2fa")
class TwoFactorController(
    private val authService: AuthService
) : BaseController() {

    @PostMapping("/enable")
    fun enableTwoFactor(@AuthenticationPrincipal user: UserEntity): ResponseEntity<Map<String, Any>> {
        return try {
            val result = authService.enableTwoFactor(user.id)
            ResponseEntity.ok(result)
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Failed to enable 2FA")))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Failed to enable 2FA"))
        }
    }

    @PostMapping("/verify")
    fun verifyAndEnableTwoFactor(
        @AuthenticationPrincipal user: UserEntity,
        @RequestBody request: Map<String, Any>
    ): ResponseEntity<Map<String, Any>> { // Changed return type
        return try {
            val verificationCode = (request["verificationCode"] as? Number)?.toInt()
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "Verification code required"))

            val result = authService.verifyAndEnableTwoFactor(user.id, verificationCode)
            // Convert Map<String, String> to Map<String, Any>
            ResponseEntity.ok(result.mapValues { it.value as Any })
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Invalid verification code")))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Failed to verify 2FA"))
        }
    }

    @PostMapping("/disable")
    fun disableTwoFactor(
        @AuthenticationPrincipal user: UserEntity,
        @RequestBody request: Map<String, Any>
    ): ResponseEntity<Map<String, Any>> { // Changed return type
        return try {
            val verificationCode = (request["verificationCode"] as? Number)?.toInt()
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "Verification code required"))

            val result = authService.disableTwoFactor(user.id, verificationCode)
            // Convert Map<String, String> to Map<String, Any>
            ResponseEntity.ok(result.mapValues { it.value as Any })
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Invalid verification code")))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Failed to disable 2FA"))
        }
    }

    @PostMapping("/regenerate-backup-codes")
    fun regenerateBackupCodes(
        @AuthenticationPrincipal user: UserEntity,
        @RequestBody request: Map<String, Any>
    ): ResponseEntity<Map<String, Any>> {
        return try {
            val verificationCode = (request["verificationCode"] as? Number)?.toInt()
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "Verification code required"))

            val result = authService.regenerateBackupCodes(user.id, verificationCode)
            ResponseEntity.ok(result)
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Invalid verification code")))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Failed to regenerate backup codes"))
        }
    }

    @GetMapping("/status")
    fun getTwoFactorStatus(@AuthenticationPrincipal user: UserEntity): ResponseEntity<Map<String, Any>> {
        return try {
            val currentUser = authService.getCurrentUser(user.id)
            val status: Map<String, Any> = mapOf(
                "enabled" to currentUser.twoFactorEnabled,
                "verifiedAt" to (currentUser.twoFactorVerifiedAt?.toString() as Any),
                "hasBackupCodes" to (currentUser.backupCodes != null)
            )
            ResponseEntity.ok(status)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }
}