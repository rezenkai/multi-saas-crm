package com.backend.core.notification

import com.backend.core.base.BaseController
import com.backend.core.user.UserEntity
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RequestMapping("/notifications")
class NotificationController(
    private val emailService: EmailService,
    private val smsService: SmsService
) : BaseController() {

    @PostMapping("/test-email")
    fun testEmail(@AuthenticationPrincipal user: UserEntity): ResponseEntity<Map<String, String>> {
        return try {
            // Use simple synchronous call instead of coroutines
            emailService.sendWelcomeEmailSync(user.email, user.fullName)
            ResponseEntity.ok(mapOf("message" to "Test email sent successfully"))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Failed to send test email"))
        }
    }

    @PostMapping("/test-sms")
    fun testSms(
        @AuthenticationPrincipal user: UserEntity,
        @RequestBody request: Map<String, String>
    ): ResponseEntity<Map<String, String>> {
        return try {
            val phoneNumber = request["phoneNumber"]
                ?: return ResponseEntity.badRequest().body(mapOf("error" to "Phone number required"))

            smsService.sendTestSmsSync(phoneNumber, user.fullName)
            ResponseEntity.ok(mapOf("message" to "Test SMS sent successfully"))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to "Failed to send test SMS"))
        }
    }
}