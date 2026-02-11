/**
 * Database seeding script
 * Creates test tenant for development
 */

require('dotenv').config({ path: '../../../../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'winston',
  user: 'winston',
  password: 'winston',
  port: 5432
});

async function seed() {
  try {
    console.log('Seeding database...');

    // Create test tenant
    const result = await pool.query(`
      INSERT INTO tenants (
        name,
        email,
        industry,
        sub_industry,
        website_url,
        tier,
        status,
        selected_model,
        credits_remaining,
        credits_monthly_allotment
      ) VALUES (
        'Test Dispensary',
        'test@example.com',
        'cannabis',
        'dispensary',
        'https://example.com',
        'free',
        'active',
        'kimi-k2.5',
        50000,
        50000
      )
      ON CONFLICT (email) DO UPDATE
      SET updated_at = NOW()
      RETURNING id, name, email, credits_remaining
    `);

    const tenant = result.rows[0];
    console.log('\n✅ Test tenant created:');
    console.log('   ID:', tenant.id);
    console.log('   Name:', tenant.name);
    console.log('   Email:', tenant.email);
    console.log('   Credits:', tenant.credits_remaining);
    console.log('\n   Use this tenant ID in your test requests:');
    console.log(`   Authorization: Bearer winston-${tenant.id}`);
    console.log('');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
