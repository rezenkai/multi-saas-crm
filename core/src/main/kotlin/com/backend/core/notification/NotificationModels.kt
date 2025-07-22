package com.backend.core.notification

import java.time.LocalDateTime

enum class NotificationChannel {
    EMAIL, SMS, TELEGRAM, WHATSAPP, PUSH
}

enum class NotificationStatus {
    PENDING, SENT, FAILED, DELIVERED
}

data class EmailNotificationRequest(
    val to: String,
    val subject: String,
    val template: String? = null,
    val htmlContent: String? = null,
    val textContent: String? = null,
    val data: Map<String, Any> = emptyMap()
)

data class SmsNotificationRequest(
    val to: String,
    val message: String,
    val template: String? = null,
    val data: Map<String, Any> = emptyMap()
)

data class MultiChannelNotificationRequest(
    val channels: List<NotificationChannel>,
    val email: EmailNotificationRequest? = null,
    val sms: SmsNotificationRequest? = null
)

data class NotificationResult(
    val id: String,
    val status: NotificationStatus,
    val channel: NotificationChannel,
    val sentAt: LocalDateTime? = null,
    val error: String? = null
)