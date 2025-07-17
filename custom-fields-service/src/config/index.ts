import dotenv from 'dotenv';

dotenv.config();

export const config = {
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8009', 10),
  
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

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Custom Fields Configuration
  customFields: {
    maxFieldsPerEntity: parseInt(process.env.MAX_FIELDS_PER_ENTITY || '100', 10),
    maxFieldNameLength: parseInt(process.env.MAX_FIELD_NAME_LENGTH || '50', 10),
    maxFieldLabelLength: parseInt(process.env.MAX_FIELD_LABEL_LENGTH || '100', 10),
    maxSelectOptions: parseInt(process.env.MAX_SELECT_OPTIONS || '50', 10),
    allowedEntityTypes: (process.env.ALLOWED_ENTITY_TYPES || 'contact,company,opportunity,user,project,task').split(',')
  }
};