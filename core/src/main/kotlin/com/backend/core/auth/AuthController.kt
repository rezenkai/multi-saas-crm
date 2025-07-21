package com.backend.core.auth

import com.backend.core.base.BaseController
import com.backend.core.security.JwtService
import com.backend.core.security.TokenBlacklistService
import com.backend.core.user.UserEntity
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RequestMapping("/auth")
class AuthController(
    private val authService: AuthService,
    private val tokenBlacklistService: TokenBlacklistService,
    private val jwtService: JwtService
) : BaseController() {

    @PostMapping("/register")
    fun register(@RequestBody request: Map<String, String>): ResponseEntity<Map<String, Any>> {
        return try {
            val email = request["email"] ?: return ResponseEntity.badRequest().body(mapOf("error" to "Email required"))
            val password = request["password"] ?: return ResponseEntity.badRequest().body(mapOf("error" to "Password required"))
            val passwordConfirm = request["passwordConfirm"] ?: return ResponseEntity.badRequest().body(mapOf("error" to "Password confirmation required"))
            val firstName = request["firstName"] ?: return ResponseEntity.badRequest().body(mapOf("error" to "First name required"))
            val lastName = request["lastName"] ?: return ResponseEntity.badRequest().body(mapOf("error" to "Last name required"))

            val result = authService.register(email, password, passwordConfirm, firstName, lastName)
            ResponseEntity.status(HttpStatus.CREATED).body(result)
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Registration failed")))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Registration failed"))
        }
    }

    @PostMapping("/login")
    fun login(@RequestBody request: Map<String, String>): ResponseEntity<Any> {
        return try {
            val email = request["email"] ?: return ResponseEntity.badRequest().body(mapOf("error" to "Email required"))
            val password = request["password"] ?: return ResponseEntity.badRequest().body(mapOf("error" to "Password required"))
            val tenantId = request["tenantId"]

            val tokenPair = authService.login(email, password, tenantId)

            val response = mapOf(
                "accessToken" to tokenPair.accessToken,
                "refreshToken" to tokenPair.refreshToken,
                "tokenType" to tokenPair.tokenType,
                "expiresIn" to tokenPair.expiresIn
            )

            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(mapOf("error" to "Invalid email or password"))
        }
    }

    @PostMapping("/refresh")
    fun refreshToken(@RequestBody request: Map<String, String>): ResponseEntity<Any> {
        return try {
            val refreshToken = request["refreshToken"]
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "Refresh token required"))

            val tokenPair = authService.refreshToken(refreshToken)

            val response = mapOf(
                "accessToken" to tokenPair.accessToken,
                "refreshToken" to tokenPair.refreshToken,
                "tokenType" to tokenPair.tokenType,
                "expiresIn" to tokenPair.expiresIn
            )

            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(mapOf("error" to "Failed to refresh token"))
        }
    }

    @PostMapping("/logout")
    fun logout(
        @RequestHeader("Authorization") authorization: String
    ): ResponseEntity<Map<String, String>> {
        val token = authorization.removePrefix("Bearer ").trim()

        val expirationMillis = jwtService.getExpiration(token).time - System.currentTimeMillis()
        val expiresInSeconds = expirationMillis / 1000

        tokenBlacklistService.blacklistToken(token, expiresInSeconds)

        return ResponseEntity.ok(mapOf("message" to "Logged out successfully"))
    }


    @GetMapping("/me")
    fun getCurrentUser(@AuthenticationPrincipal user: UserEntity): ResponseEntity<UserEntity> {
        return try {
            val currentUser = authService.getCurrentUser(user.id)
            ResponseEntity.ok(currentUser)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PostMapping("/change-password")
    fun changePassword(
        @AuthenticationPrincipal user: UserEntity,
        @RequestBody request: Map<String, String>
    ): ResponseEntity<Map<String, String>> {
        return try {
            val currentPassword = request["currentPassword"]
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "Current password required"))
            val newPassword = request["newPassword"]
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "New password required"))
            val newPasswordConfirm = request["newPasswordConfirm"]
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "Password confirmation required"))

            authService.changePassword(user.id, currentPassword, newPassword, newPasswordConfirm)
            ResponseEntity.ok(mapOf("message" to "Password changed successfully"))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Failed to change password")))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Failed to change password"))
        }
    }

    @GetMapping("/check-email/{email}")
    fun checkEmailAvailability(@PathVariable email: String): ResponseEntity<Map<String, Any>> {
        return try {
            val exists = authService.userRepository.existsByEmail(email)
            ResponseEntity.ok(mapOf(
                "email" to email,
                "available" to !exists
            ))
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/verify-email")
    fun verifyEmail(@RequestParam token: String): ResponseEntity<Map<String, Any>> {
        return try {
            val result = authService.verifyEmail(token)
            ResponseEntity.ok(result)
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Verification failed")))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Verification failed"))
        }
    }
}