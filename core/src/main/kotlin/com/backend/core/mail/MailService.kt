package com.backend.core.mail

interface MailService {
    fun sendEmailVerification(email: String, verificationLink: String)
}
