package com.backend.core.mail

import org.springframework.stereotype.Service

@Service
class MailServiceImpl : MailService {
    override fun sendEmailVerification(email: String, verificationLink: String) {
        println("Sending email verification to $email with link: $verificationLink")
        // TODO: Integrate with actual SMTP, SendGrid, Mailjet, or SES
    }
}
