import { readFileSync } from 'fs';
import { join } from 'path';
import { db, runMigrations } from '../config/database';

async function runMigration() {
  try {
    console.log('🔄 Running analytics database migrations...');
    
    await runMigrations();
    
    // Execute migration SQL
    const migrationSQL = readFileSync(
      join(__dirname, '../database/migrations/001_analytics_tables.sql'), 
      'utf8'
    );
    
    await db.query(migrationSQL);
    
    console.log('✅ Analytics migrations completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();