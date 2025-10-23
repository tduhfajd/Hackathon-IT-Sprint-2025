const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'smart_support',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migration 005: Add AI columns to appeals table...');
    
    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, '005_add_ai_columns_to_appeals.sql'), 
      'utf8'
    );
    
    await client.query(migrationSql);
    
    console.log('✅ Migration 005 completed successfully!');
    
    // Verify columns were added
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='appeals' 
      AND column_name IN ('category_suggestion', 'priority_suggestion', 'sentiment_type', 'sentiment_score', 'keywords', 'summary', 'ai_confidence')
      ORDER BY column_name
    `);
    
    console.log('\n📋 AI Columns in appeals table:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}: ${row.data_type}`);
    });
    
    if (result.rows.length !== 7) {
      console.warn(`\n⚠️  Expected 7 columns, found ${result.rows.length}`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

