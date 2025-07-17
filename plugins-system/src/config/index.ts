import dotenv from 'dotenv';

dotenv.config();

export const config = {
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8003', 10),
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://multisaas:multisaas_password@localhost:5432/multisaas',
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },

  // Plugin Configuration
  plugins: {
    maxSize: parseInt(process.env.PLUGIN_MAX_SIZE || '52428800', 10), // 50MB
    uploadDir: process.env.PLUGIN_UPLOAD_DIR || './uploads',
    dataDir: process.env.PLUGIN_DATA_DIR || './data',
    pluginsDir: process.env.PLUGINS_DIR || './plugins',
  },
};