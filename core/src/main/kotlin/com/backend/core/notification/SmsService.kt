package com.backend.core.notification

import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration
import org.springframework.stereotype.Service

@Configuration
@ConfigurationProperties(prefix = "notification.sms")
class SmsConfig {
    var enabled: Boolean = false
    var provider: String = "stub" // stub, sms_ru, smsc_ru, twilio
    var smsRuApiKey: String? = null
    var smscLogin: String? = null
    var smscPassword: String? = null
    var twilioAccountSid: String? = null
    var twilioAuthToken: String? = null
    var twilioFromNumber: String? = null
}

@Service
class SmsService(
    private val smsConfig: SmsConfig
) {
    private val logger = LoggerFactory.getLogger(SmsService::class.java)

    fun sendTestSmsSync(phoneNumber: String, userName: String) {
        if (!smsConfig.enabled) {
            logger.info("SMS service disabled - would send test SMS to: $phoneNumber")
            return
        }

        when (smsConfig.provider) {
            "stub" -> {
                logger.info("📱 [SMS STUB] Sending test SMS:")
                logger.info("   To: $phoneNumber")
                logger.info("   Message: Test SMS from CRM System. Hello $userName!")
                Thread.sleep(200) // Simulate delay
                logger.info("✅ [SMS STUB] Test SMS sent successfully")
            }
            "sms_ru" -> {
                logger.info("📱 [SMS.RU] Would send via SMS.ru API...")
                throw NotImplementedError("SMS.ru integration not implemented yet")
            }
            "smsc_ru" -> {
                logger.info("📱 [SMSC.RU] Would send via SMSC.ru API...")
                throw NotImplementedError("SMSC.ru integration not implemented yet")
            }
            "twilio" -> {
                logger.info("📱 [TWILIO] Would send via Twilio API...")
                throw NotImplementedError("Twilio integration not implemented yet")
            }
            else -> throw IllegalArgumentException("Unknown SMS provider: ${smsConfig.provider}")
        }
    }

    fun sendVerificationCodeSync(phoneNumber: String, code: String) {
        if (!smsConfig.enabled) {
            logger.info("SMS service disabled - would send verification code to: $phoneNumber")
            return
        }

        logger.info("📱 [SMS STUB] Sending verification code:")
        logger.info("   To: $phoneNumber")
        logger.info("   Code: $code")
        Thread.sleep(200)
        logger.info("✅ [SMS STUB] Verification code sent successfully")
    }

    fun sendLoginAlertSync(phoneNumber: String, location: String) {
        if (!smsConfig.enabled) {
            logger.info("SMS service disabled - would send login alert to: $phoneNumber")
            return
        }

        logger.info("📱 [SMS STUB] Sending login alert:")
        logger.info("   To: $phoneNumber")
        logger.info("   Location: $location")
        Thread.sleep(200)
        logger.info("✅ [SMS STUB] Login alert sent successfully")
    }
}