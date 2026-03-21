require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected');

    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running migrations...');
    await client.query(sql);
    console.log('Database schema applied successfully');

    const result = await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema =  ORDER BY table_name', ['public']);
    console.log('Tables created:');
    result.rows.forEach(function(r) { console.log('   ' + r.table_name); });

  } catch (err) {
    console.error('Migration failed: ' + err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();