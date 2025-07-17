import dotenv from 'dotenv';

dotenv.config();

export const config = {
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  // Services Configuration
  services: {
    auth: {
      url: process.env.AUTH_SERVICE_URL || 'http://crm-backend:8000',
      timeout: 30000,
    },
    users: {
      url: process.env.USERS_SERVICE_URL || 'http://crm-backend:8000',
      timeout: 30000,
    },
    contacts: {
      url: process.env.CONTACTS_SERVICE_URL || 'http://crm-backend:8000',
      timeout: 30000,
    },
    companies: {
      url: process.env.COMPANIES_SERVICE_URL || 'http://crm-backend:8000',
      timeout: 30000,
    },
    opportunities: {
      url: process.env.OPPORTUNITIES_SERVICE_URL || 'http://crm-backend:8000',
      timeout: 30000,
    },
    dashboard: {
      url: process.env.DASHBOARD_SERVICE_URL || 'http://crm-backend:8000',
      timeout: 30000,
    },
    erp: {
      url: process.env.ERP_SERVICE_URL || 'http://erp-service:8006',
      timeout: 30000,
    },
    marketing: {
      url: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:8007',
      timeout: 30000,
    },
    plugins: {
      url: process.env.PLUGINS_SERVICE_URL || 'http://plugins-service:8008',
      timeout: 30000,
    },
    customfields: {
      url: process.env.CUSTOM_FIELDS_SERVICE_URL || 'http://custom-fields-service:8009',
      timeout: 30000,
    },
    oauth2: {
      url: process.env.OAUTH2_SERVICE_URL || 'http://oauth2-service:8010',
      timeout: 30000,
    },
    workflow: {
      url: process.env.WORKFLOW_ENGINE_URL || 'http://workflow-engine:8011',
      timeout: 30000,
    },
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },

  // Security Configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  },
};