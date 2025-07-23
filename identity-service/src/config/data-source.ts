import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../user/entity/user.entity';

// Load environment variables
config();

const dbPort = process.env.DB_PORT;
const port = dbPort ? parseInt(dbPort, 10) : 5432;

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'salesforce_clone',

  // Entities
  entities: [User],

  // Migrations
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'migrations',

  // Logging
  logging:
    process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],

  // SSL configuration
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

export default AppDataSource;
