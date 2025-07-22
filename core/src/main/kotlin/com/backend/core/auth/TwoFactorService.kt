package com.backend.core.auth

import com.warrenstrange.googleauth.GoogleAuthenticator
import com.warrenstrange.googleauth.GoogleAuthenticatorKey
import com.warrenstrange.googleauth.GoogleAuthenticatorQRGenerator
import org.springframework.stereotype.Service
import java.util.*

@Service
class TwoFactorService {

    private val googleAuthenticator = GoogleAuthenticator()

    fun generateSecretKey(): String {
        val key: GoogleAuthenticatorKey = googleAuthenticator.createCredentials()
        return key.key
    }

    fun generateQRCodeUrl(userEmail: String, secretKey: String, issuer: String = "CRM System"): String {
        return GoogleAuthenticatorQRGenerator.getOtpAuthURL(
            issuer,
            userEmail,
            GoogleAuthenticatorKey.Builder(secretKey).build()
        )
    }

    fun verifyCode(secretKey: String, verificationCode: Int): Boolean {
        return googleAuthenticator.authorize(secretKey, verificationCode)
    }

    fun generateBackupCodes(): List<String> {
        return (1..10).map {
            UUID.randomUUID().toString().replace("-", "").substring(0, 8).uppercase()
        }
    }
}