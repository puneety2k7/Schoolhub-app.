import pg from 'pg';
import { loadConfig } from '../config.js';

/** Setup helper: verifies the configured V2 database is reachable. Never creates, drops or alters anything. */
const config = loadConfig();
const url = new URL(config.databaseUrl), database = decodeURIComponent(url.pathname.slice(1)), user = decodeURIComponent(url.username);
const client = new pg.Client({ connectionString: config.databaseUrl });
try {
  await client.connect();
  const info = await client.query('SELECT current_database() AS db, current_user AS usr');
  console.log(`OK: connected to PostgreSQL database "${info.rows[0].db}" as "${info.rows[0].usr}".`);
  await client.end();
} catch (error: any) {
  console.error(`FAILED: ${error.message}`);
  if (error.code === '3D000') {
    console.error(`\nThe database "${database}" does not exist yet. Create it ONCE as the PostgreSQL administrator (this script never does it for you):\n`);
    console.error(`  psql -U postgres -h ${url.hostname} -c "CREATE ROLE ${user} LOGIN PASSWORD 'YOUR_PASSWORD';"`);
    console.error(`  psql -U postgres -h ${url.hostname} -c "CREATE DATABASE ${database} OWNER ${user};"\n`);
    console.error('Use the same user and password in v2.config.env, then run Setup-SchoolHub-V2.bat again.');
  } else if (error.code === '28P01' || error.code === '28000') {
    console.error('\nPostgreSQL rejected the username or password in v2.config.env. If the user does not exist, create it with the first command above.');
  } else if (error.code === 'ECONNREFUSED') {
    console.error('\nPostgreSQL is not running (or the host/port in v2.config.env is wrong). Start the PostgreSQL service and try again.');
  }
  process.exit(1);
}
