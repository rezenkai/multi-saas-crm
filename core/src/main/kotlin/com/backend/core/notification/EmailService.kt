package com.backend.core.notification

import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration
import org.springframework.stereotype.Service

@Configuration
@ConfigurationProperties(prefix = "notification.email")
class EmailConfig {
    var enabled: Boolean = false
    var provider: String = "stub" // stub, sendgrid, smtp
    var fromEmail: String = "noreply@crm.com"
    var fromName: String = "CRM System"
    var sendgridApiKey: String? = null
    var smtpHost: String? = null
    var smtpPort: Int = 587
    var smtpUsername: String? = null
    var smtpPassword: String? = null
}

@Service
class EmailService(
    private val emailConfig: EmailConfig
) {
    private val logger = LoggerFactory.getLogger(EmailService::class.java)

    fun sendWelcomeEmailSync(userEmail: String, userName: String) {
        if (!emailConfig.enabled) {
            logger.info("Email service disabled - would send welcome email to: $userEmail")
            return
        }

        when (emailConfig.provider) {
            "stub" -> {
                logger.info("📧 [EMAIL STUB] Sending welcome email:")
                logger.info("   To: $userEmail")
                logger.info("   Subject: Welcome to CRM System!")
                logger.info("   User: $userName")
                Thread.sleep(100) // Simulate delay
                logger.info("✅ [EMAIL STUB] Welcome email sent successfully")
            }
            "sendgrid" -> {
                logger.info("📧 [SENDGRID] Would send via SendGrid API...")
                throw NotImplementedError("SendGrid integration not implemented yet")
            }
            "smtp" -> {
                logger.info("📧 [SMTP] Would send via SMTP...")
                throw NotImplementedError("SMTP integration not implemented yet")
            }
            else -> throw IllegalArgumentException("Unknown email provider: ${emailConfig.provider}")
        }
    }

    fun sendPasswordResetEmailSync(userEmail: String, resetToken: String) {
        if (!emailConfig.enabled) {
            logger.info("Email service disabled - would send password reset email to: $userEmail")
            return
        }

        logger.info("📧 [EMAIL STUB] Sending password reset email:")
        logger.info("   To: $userEmail")
        logger.info("   Reset Token: $resetToken")
        Thread.sleep(100)
        logger.info("✅ [EMAIL STUB] Password reset email sent successfully")
    }

    fun sendTwoFactorSetupEmailSync(userEmail: String, userName: String) {
        if (!emailConfig.enabled) {
            logger.info("Email service disabled - would send 2FA setup email to: $userEmail")
            return
        }

        logger.info("📧 [EMAIL STUB] Sending 2FA setup email:")
        logger.info("   To: $userEmail")
        logger.info("   User: $userName")
        Thread.sleep(100)
        logger.info("✅ [EMAIL STUB] 2FA setup email sent successfully")
    }
}