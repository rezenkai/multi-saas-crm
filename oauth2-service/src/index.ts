import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import passport from 'passport';
import { config } from './config';
import { logger } from './utils/logger';
import { corsMiddleware, tenantMiddleware, rateLimitMiddleware } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
import oauthRoutes from './routes/oauth-simple';
import providerRoutes from './routes/providers';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for OAuth redirect pages
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware (required for passport)
app.use(session({
  secret: config.security.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.environment === 'production',
    httpOnly: true,
    maxAge: config.security.sessionMaxAge
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Custom middleware
app.use(rateLimitMiddleware);
app.use(tenantMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'oauth2-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.environment,
    features: {
      oauth2_server: true,
      external_providers: {
        google: !!config.providers.google.clientId,
        github: !!config.providers.github.clientId,
        microsoft: !!config.providers.microsoft.clientId,
        slack: !!config.providers.slack.clientId
      },
      multi_tenant: config.multiTenant.enableTenantIsolation,
      pkce_support: config.oauth2.enablePKCE
    }
  });
});

// Routes
app.use('/oauth', oauthRoutes);
app.use('/auth', providerRoutes);

// OAuth2 discovery endpoint (at root level)
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const issuer = config.oauth2.issuer;
  
  const discovery = {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    jwks_uri: `${issuer}/oauth/jwks`,
    introspection_endpoint: `${issuer}/oauth/introspect`,
    response_types_supported: ['code'],
    grant_types_supported: config.oauth2.allowedGrantTypes,
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    scopes_supported: config.oauth2.availableScopes,
    code_challenge_methods_supported: config.oauth2.enablePKCE ? ['S256', 'plain'] : [],
    service_documentation: `${issuer}/docs`,
    ui_locales_supported: ['en-US', 'en'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'email', 'name', 'picture', 'tenant_id']
  };

  res.json(discovery);
});

// OpenID Connect discovery endpoint
app.get('/.well-known/openid_configuration', (req, res) => {
  const issuer = config.oauth2.issuer;
  
  const discovery = {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    jwks_uri: `${issuer}/oauth/jwks`,
    introspection_endpoint: `${issuer}/oauth/introspect`,
    response_types_supported: ['code', 'id_token', 'code id_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256', 'RS256'],
    scopes_supported: ['openid', 'profile', 'email', ...config.oauth2.availableScopes],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'email', 'email_verified', 'name', 'picture', 'tenant_id'],
    code_challenge_methods_supported: config.oauth2.enablePKCE ? ['S256', 'plain'] : []
  };

  res.json(discovery);
});

// API documentation endpoint
app.get('/docs', (req, res) => {
  const docs = {
    title: 'OAuth2 Authorization Server API',
    version: '1.0.0',
    description: 'Multi-tenant OAuth2 authorization server with external provider integration',
    base_url: config.oauth2.issuer,
    endpoints: {
      authorization: {
        method: 'GET',
        path: '/oauth/authorize',
        description: 'OAuth2 authorization endpoint',
        parameters: {
          response_type: 'code',
          client_id: 'string (required)',
          redirect_uri: 'string (required)', 
          scope: 'string (optional)',
          state: 'string (recommended)',
          code_challenge: 'string (PKCE)',
          code_challenge_method: 'S256 or plain (PKCE)'
        }
      },
      token: {
        method: 'POST',
        path: '/oauth/token',
        description: 'OAuth2 token endpoint',
        parameters: {
          grant_type: 'authorization_code, refresh_token, or client_credentials',
          client_id: 'string (required)',
          client_secret: 'string (required)',
          code: 'string (authorization_code grant)',
          redirect_uri: 'string (authorization_code grant)',
          refresh_token: 'string (refresh_token grant)',
          scope: 'string (optional)',
          code_verifier: 'string (PKCE)'
        }
      },
      userinfo: {
        method: 'GET',
        path: '/oauth/userinfo',
        description: 'Get user information',
        headers: {
          Authorization: 'Bearer <access_token>'
        }
      },
      revoke: {
        method: 'POST',
        path: '/oauth/revoke',
        description: 'Revoke access or refresh token',
        parameters: {
          token: 'string (required)',
          token_type_hint: 'access_token or refresh_token (optional)',
          client_id: 'string (required)',
          client_secret: 'string (required)'
        }
      }
    },
    external_providers: {
      google: {
        auth_url: '/auth/google',
        callback_url: '/auth/google/callback',
        scopes: config.providers.google.scopes
      },
      github: {
        auth_url: '/auth/github',
        callback_url: '/auth/github/callback',
        scopes: config.providers.github.scopes
      }
    },
    scopes: config.oauth2.availableScopes,
    grant_types: config.oauth2.allowedGrantTypes
  };

  res.json(docs);
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port || 8010;
app.listen(PORT, () => {
  logger.info(`OAuth2 Service started on port ${PORT}`, {
    environment: config.environment,
    issuer: config.oauth2.issuer,
    grants: config.oauth2.allowedGrantTypes,
    externalProviders: {
      google: !!config.providers.google.clientId,
      github: !!config.providers.github.clientId,
      microsoft: !!config.providers.microsoft.clientId,
      slack: !!config.providers.slack.clientId
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});