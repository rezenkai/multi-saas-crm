import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../user/entity/user.entity';

export default registerAs('database', (): TypeOrmModuleOptions => {
  const dbPort = process.env.DB_PORT;
  const port = dbPort ? parseInt(dbPort, 10) : 5432;

  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'salesforce_clone',

    // Entities
    entities: [User],

    // Auto-create tables in development (disable in production)
    synchronize: process.env.NODE_ENV === 'development',

    // Enable logging in development
    logging:
      process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],

    // Connection pool settings
    extra: {
      max: 20, // Maximum number of connections
      min: 5, // Minimum number of connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },

    // Migrations (we'll set this up later)
    migrations: ['dist/migrations/*.js'],
    migrationsRun: false,

    // SSL configuration (for production)
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  };
});
