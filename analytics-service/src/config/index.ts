import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server Configuration
  port: process.env.PORT || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration (подключаемся к той же БД что и Kotlin core)
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'salesforce_clone',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '100'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB || '1'), // Используем БД 1 для analytics
  },

  // JWT Configuration (для аутентификации с Kotlin core)
  jwt: {
    secret: process.env.JWT_SECRET || 'bXlfc2VjcmV0X2tleV9mb3Jfand0X3Rva2Vux2dlbmVyYXRpb25fMTIzNDU2Nzg5MA==',
    algorithm: 'HS256' as const,
  },

  // ClickHouse Configuration
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST || 'clickhouse-analytics',
    port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
    database: process.env.CLICKHOUSE_DB || 'default',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  },

  // Superset Configuration
  superset: {
    host: process.env.SUPERSET_HOST || 'http://superset-analytics:8088',
    username: process.env.SUPERSET_USERNAME || 'admin',
    password: process.env.SUPERSET_PASSWORD || 'admin123',
  },

  // Grafana Configuration
  grafana: {
    host: process.env.GRAFANA_HOST || 'http://grafana:3000',
    username: process.env.GRAFANA_USERNAME || 'admin',
    password: process.env.GRAFANA_PASSWORD || 'admin123',
  },

  // Analytics Configuration
  analytics: {
    batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE || '100'),
    flushInterval: parseInt(process.env.ANALYTICS_FLUSH_INTERVAL || '10000'), // 10 секунд
    metricsRefreshInterval: parseInt(process.env.METRICS_REFRESH_INTERVAL || '60000'), // 1 минута
    enableRealTime: process.env.ENABLE_REALTIME !== 'false',
  },

  // Security
  security: {
    enableCors: process.env.ENABLE_CORS !== 'false',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    enableHelmet: process.env.ENABLE_HELMET !== 'false',
    rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '1000'),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 минут
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFile: process.env.LOG_FILE === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/analytics.log',
  },
};