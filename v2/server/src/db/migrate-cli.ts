import { loadConfig } from '../config.js';
import { Database } from './database.js';
import { migrate } from './migrate.js';

const config = loadConfig();
const db = new Database(config.databaseUrl);
try {
  const applied = await migrate(db);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
} finally {
  await db.close();
}
