import { Pool, PoolConfig } from 'pg';
import { config } from './index';

// Конфигурация пула подключений PostgreSQL
const poolConfig: PoolConfig = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.username,
  password: config.database.password,
  ssl: config.database.ssl,
  max: config.database.maxConnections,
  idleTimeoutMillis: config.database.idleTimeoutMillis,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
  query_timeout: 30000,
};

// Создание пула подключений
export const db = new Pool(poolConfig);

// Обработка событий подключения
db.on('connect', (client: any) => {
  console.log(`✅ PostgreSQL client connected (PID: ${client.processID || 'unknown'})`);
});

db.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err);
});

db.on('acquire', (client: any) => {
  if (config.nodeEnv === 'development') {
    console.log(`🔄 PostgreSQL client acquired (PID: ${client.processID || 'unknown'})`);
  }
});

db.on('remove', (client: any) => {
  if (config.nodeEnv === 'development') {
    console.log(`❌ PostgreSQL client removed (PID: ${client.processID || 'unknown'})`);
  }
});

// Функция для проверки подключения к БД
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await db.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Функция для выполнения миграций
export async function runMigrations(): Promise<void> {
  const client = await db.connect();
  
  try {
    // Создаем таблицу для отслеживания миграций если не существует
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Migrations table ready');
    
  } catch (error) {
    console.error('❌ Error setting up migrations:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await db.end();
    console.log('✅ Database pool closed gracefully');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
}