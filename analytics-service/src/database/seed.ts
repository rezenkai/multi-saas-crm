import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../config/database';

async function runSeed() {
  try {
    console.log('🌱 Seeding analytics database...');
    
    // Execute seed SQL
    const seedSQL = readFileSync(
      join(__dirname, '../database/seeds/001_sample_analytics_data.sql'), 
      'utf8'
    );
    
    await db.query(seedSQL);
    
    console.log('✅ Analytics seed data inserted successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

runSeed();