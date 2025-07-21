package com.backend.core.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration

@Configuration
@ConfigurationProperties(prefix = "jwt")
class JwtConfig {
    var secret: String = "bXlfc2VjcmV0X2tleV9mb3Jfand0X3Rva2Vux2dlbmVyYXRpb25fMTIzNDU2Nzg5MA=="
    var accessTokenExpiration: Long = 86400000
    var refreshTokenExpiration: Long = 604800000
    var algorithm: String = "HS256"
}