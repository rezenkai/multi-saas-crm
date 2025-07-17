import dotenv from 'dotenv';

dotenv.config();

export const config = {
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8010', 10),
  
  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'multisaas',
    user: process.env.DB_USER || 'multisaas',
    password: process.env.DB_PASSWORD || 'multisaas_password',
    url: process.env.DATABASE_URL || 'postgresql://multisaas:multisaas_password@localhost:5432/multisaas'
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // OAuth2 Configuration
  oauth2: {
    issuer: process.env.OAUTH2_ISSUER || 'http://localhost:8010',
    accessTokenLifetime: parseInt(process.env.ACCESS_TOKEN_LIFETIME || '3600', 10), // 1 hour
    refreshTokenLifetime: parseInt(process.env.REFRESH_TOKEN_LIFETIME || '1209600', 10), // 2 weeks
    authorizationCodeLifetime: parseInt(process.env.AUTHORIZATION_CODE_LIFETIME || '600', 10), // 10 minutes
    
    // JWT signing keys
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtAlgorithm: 'HS256' as const,
    
    // PKCE support
    enablePKCE: process.env.ENABLE_PKCE !== 'false',
    
    // Allowed grant types
    allowedGrantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
    
    // Default scopes
    defaultScopes: ['read', 'write'],
    availableScopes: ['read', 'write', 'admin', 'contacts:read', 'contacts:write', 'companies:read', 'companies:write', 'opportunities:read', 'opportunities:write']
  },

  // External OAuth Providers
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8010/auth/google/callback',
      scopes: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar']
    },
    
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      callbackUrl: process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:8010/auth/microsoft/callback',
      scopes: ['profile', 'openid', 'email', 'https://graph.microsoft.com/mail.read', 'https://graph.microsoft.com/calendars.read']
    },
    
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:8010/auth/github/callback',
      scopes: ['user:email', 'repo', 'read:org']
    },
    
    slack: {
      clientId: process.env.SLACK_CLIENT_ID || '',
      clientSecret: process.env.SLACK_CLIENT_SECRET || '',
      callbackUrl: process.env.SLACK_CALLBACK_URL || 'http://localhost:8010/auth/slack/callback',
      scopes: ['identity.basic', 'identity.email', 'channels:read', 'chat:write']
    }
  },

  // Security Configuration
  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per window
    
    // CORS settings
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    
    // Session settings
    sessionSecret: process.env.SESSION_SECRET || 'oauth2-session-secret-change-in-production',
    sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10), // 24 hours
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Multi-tenant Configuration
  multiTenant: {
    enableTenantIsolation: process.env.ENABLE_TENANT_ISOLATION !== 'false',
    defaultTenantId: process.env.DEFAULT_TENANT_ID || 'default',
  }
};