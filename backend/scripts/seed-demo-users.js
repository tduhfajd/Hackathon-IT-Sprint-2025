const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'smart_support',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'admin123'
});

const DEMO_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'operator@demo.local',
    password: 'operator123',
    full_name: 'Иванова Мария Петровна',
    phone: '+79991234567',
    role: 'operator',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'admin@demo.local',
    password: 'admin123',
    full_name: 'Петров Иван Сергеевич',
    phone: '+79991234568',
    role: 'admin',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'citizen@demo.local',
    password: 'citizen123',
    full_name: 'Сидоров Петр Иванович',
    phone: '+79991234569',
    role: 'citizen',
    is_active: true
  }
];

async function seedDemoUsers() {
  try {
    console.log('🌱 Starting demo users seed...');

    for (const user of DEMO_USERS) {
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [user.email]
      );

      if (existingUser.rows.length > 0) {
        console.log(`⏭️  User ${user.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const password_hash = await bcrypt.hash(user.password, 10);

      // Insert user
      await pool.query(
        `INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.email, password_hash, user.full_name, user.phone, user.role, user.is_active]
      );

      console.log(`✅ Created ${user.role}: ${user.email} (password: ${user.password})`);
    }

    console.log('\n📋 Demo Users Summary:');
    console.log('=====================');
    console.log('Operator: operator@demo.local / operator123');
    console.log('Admin:    admin@demo.local / admin123');
    console.log('Citizen:  citizen@demo.local / citizen123');
    console.log('=====================\n');

    console.log('✅ Demo users seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Demo users seed failed:', error.message);
    process.exit(1);
  }
}

seedDemoUsers();

