package com.backend.core.user

import com.backend.core.base.BaseController
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RequestMapping("/users")
class UserController(
    private val userService: UserService
) : BaseController() {

    @GetMapping("/me")
    fun getCurrentUserProfile(
        @AuthenticationPrincipal user: UserEntity
    ): ResponseEntity<UserEntity> {
        return try {
            val currentUser = userService.findById(user.id)
                ?: return ResponseEntity.notFound().build()

            ResponseEntity.ok(currentUser)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PutMapping("/me")
    fun updateCurrentUserProfile(
        @AuthenticationPrincipal user: UserEntity,
        @Valid @RequestBody updates: UserEntity
    ): ResponseEntity<UserEntity> {
        return try {
            val updatedUser = userService.updateProfile(user.id, updates)
                ?: return ResponseEntity.notFound().build()

            ResponseEntity.ok(updatedUser)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PutMapping("/settings")
    fun updateUserSettings(
        @AuthenticationPrincipal user: UserEntity,
        @Valid @RequestBody settings: UserEntity
    ): ResponseEntity<UserEntity> {
        return try {
            val updatedUser = userService.updateSettings(user.id, settings)
                ?: return ResponseEntity.notFound().build()

            ResponseEntity.ok(updatedUser)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PostMapping("/change-password")
    fun changePassword(
        @AuthenticationPrincipal user: UserEntity,
        @RequestBody passwordData: Map<String, String>
    ): ResponseEntity<Map<String, String>> {
        return try {
            val currentPassword = passwordData["currentPassword"]
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "Current password required"))
            val newPassword = passwordData["newPassword"]
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "New password required"))
            val confirmPassword = passwordData["newPasswordConfirm"]
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "Password confirmation required"))

            userService.changePassword(user.id, currentPassword, newPassword, confirmPassword)

            ResponseEntity.ok(mapOf(
                "message" to "Password changed successfully",
                "userId" to user.id.toString()
            ))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Failed to change password")))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Failed to change password"))
        }
    }

    @DeleteMapping("/delete")
    fun deleteUserAccount(
        @AuthenticationPrincipal user: UserEntity
    ): ResponseEntity<Map<String, String>> {
        return try {
            userService.deactivateUser(user.id)
            ResponseEntity.ok(mapOf(
                "message" to "Account successfully deleted",
                "userId" to user.id.toString()
            ))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Failed to delete account"))
        }
    }

    @PostMapping("/avatar")
    fun uploadAvatar(
        @AuthenticationPrincipal user: UserEntity,
        @RequestBody avatarData: Map<String, String>
    ): ResponseEntity<Map<String, String>> {
        return try {
            val avatarUrl = avatarData["avatarUrl"]
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "Avatar URL required"))

            userService.updateAvatar(user.id, avatarUrl)
            ResponseEntity.ok(mapOf(
                "message" to "Avatar uploaded successfully",
                "avatarUrl" to avatarUrl,
                "userId" to user.id.toString()
            ))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Failed to upload avatar"))
        }
    }

    @DeleteMapping("/avatar")
    fun deleteAvatar(
        @AuthenticationPrincipal user: UserEntity
    ): ResponseEntity<Map<String, String>> {
        return try {
            userService.removeAvatar(user.id)
            ResponseEntity.ok(mapOf(
                "message" to "Avatar deleted successfully",
                "userId" to user.id.toString()
            ))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Failed to delete avatar"))
        }
    }
}