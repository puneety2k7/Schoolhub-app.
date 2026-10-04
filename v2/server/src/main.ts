import { loadConfig } from './config.js';
import { Database } from './db/database.js';
import { migrate } from './db/migrate.js';
import { buildApp } from './http/app.js';

const config = loadConfig();
const db = new Database(config.databaseUrl);
await migrate(db);
const app = await buildApp(config, db);
await app.listen({ host: config.host, port: config.port });
console.log(`SchoolHub V2 server listening on http://${config.host}:${config.port}`);
