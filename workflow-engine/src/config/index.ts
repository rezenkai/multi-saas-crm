import dotenv from 'dotenv';
dotenv.config();

export const config = {
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8011', 10),
  
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://multisaas:multisaas_password@localhost:5432/multisaas',
    ssl: process.env.NODE_ENV === 'production',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'workflow:',
    retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'workflow-jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Workflow Engine Configuration
  workflow: {
    maxStepsPerWorkflow: parseInt(process.env.MAX_STEPS_PER_WORKFLOW || '50', 10),
    maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '100', 10),
    defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || '1000', 10),
    enableScheduling: process.env.ENABLE_SCHEDULING === 'true',
    enableWebhooks: process.env.ENABLE_WEBHOOKS === 'true',
  },

  // External Service URLs
  services: {
    crmBackend: process.env.CRM_BACKEND_URL || 'http://crm-backend:8000',
    erpService: process.env.ERP_SERVICE_URL || 'http://erp-service:8006',
    marketingService: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:8007',
    pluginsService: process.env.PLUGINS_SERVICE_URL || 'http://plugins-service:8008',
    customFieldsService: process.env.CUSTOM_FIELDS_SERVICE_URL || 'http://custom-fields-service:8009',
    oauth2Service: process.env.OAUTH2_SERVICE_URL || 'http://oauth2-service:8010',
    apiGateway: process.env.API_GATEWAY_URL || 'http://api-gateway:3001',
  },

  // Security Configuration
  security: {
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    sessionSecret: process.env.SESSION_SECRET || 'workflow-session-secret-change-in-production',
    sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10), // 24 hours
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
    enableCSRF: process.env.ENABLE_CSRF === 'true',
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
    enableFile: process.env.LOG_ENABLE_FILE === 'true',
    fileConfig: {
      filename: process.env.LOG_FILE || 'logs/workflow-engine.log',
      maxSize: process.env.LOG_MAX_SIZE || '10m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
    },
  },

  // Multi-tenant Configuration
  multiTenant: {
    enableTenantIsolation: process.env.ENABLE_TENANT_ISOLATION !== 'false',
    defaultTenantId: process.env.DEFAULT_TENANT_ID || 'default',
    tenantHeaderName: process.env.TENANT_HEADER_NAME || 'x-tenant-id',
  },

  // Webhook Configuration
  webhooks: {
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '1000', 10),
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '10000', 10),
    secretHeader: process.env.WEBHOOK_SECRET_HEADER || 'x-webhook-secret',
  },

  // Integration Configuration
  integrations: {
    enableExternalAPIs: process.env.ENABLE_EXTERNAL_APIS !== 'false',
    apiTimeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10', 10),
    enableRetries: process.env.ENABLE_RETRIES !== 'false',
  },

  // Monitoring Configuration
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
  },
};