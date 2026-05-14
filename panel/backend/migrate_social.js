const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config({ path: '/app/.env' });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.PANEL_MYSQL_HOST || 'panel-mysql',
    user: process.env.PANEL_MYSQL_USER || 'panel',
    password: process.env.PANEL_MYSQL_PASSWORD || '8vhUaJb5OSl1rfP8fCUaof6u8Da1',
    database: process.env.PANEL_MYSQL_DATABASE || 'siamworld_panel'
  });

  console.log('Connecting to DB...');
  
  // Checking and Adding columns
  const [columns] = await connection.query('SHOW COLUMNS FROM panel_users');
  const columnNames = columns.map(c => c.Field);

  if (!columnNames.includes('google_id')) {
    console.log('Adding google_id...');
    await connection.query('ALTER TABLE panel_users ADD COLUMN google_id VARCHAR(255) NULL AFTER role');
  }
  if (!columnNames.includes('facebook_id')) {
    console.log('Adding facebook_id...');
    await connection.query('ALTER TABLE panel_users ADD COLUMN facebook_id VARCHAR(255) NULL AFTER google_id');
  }
  if (!columnNames.includes('avatar_url')) {
    console.log('Adding avatar_url...');
    await connection.query('ALTER TABLE panel_users ADD COLUMN avatar_url TEXT NULL AFTER facebook_id');
  }

  console.log('Database updated successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Error updating database:', err);
  process.exit(1);
});
