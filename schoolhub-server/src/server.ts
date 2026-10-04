import { loadConfig } from './config/index.js';
import { createPostgresDatabase } from './database/postgres.js';
import { applyMigrations } from './database/migrations.js';
import { createApp } from './app/create-app.js';
import { redactDiagnostic } from './logging/service.js';

let app:Awaited<ReturnType<typeof createApp>>|undefined;
let db:ReturnType<typeof createPostgresDatabase>|undefined;
try{
  const config=loadConfig();
  db=createPostgresDatabase(config.databaseUrl);
  const migrations=await applyMigrations(db);
  app=await createApp(config,db);
  await app.listen({host:config.host,port:config.port});
  app.log.info({event:'SERVER_STARTED',host:config.host,port:config.port,migrations},'SchoolHub server started');
}catch(error){
  console.error(JSON.stringify({level:'fatal',event:'SERVER_START_FAILED',at:new Date().toISOString(),error:redactDiagnostic(error instanceof Error?{name:error.name,message:error.message}:error)}));
  if(db)await db.close().catch(()=>{});
  process.exitCode=1;
}
async function shutdown(signal:string){
  if(app)app.log.info({event:'SERVER_SHUTDOWN',signal},'Graceful shutdown');
  if(app)await app.close();
  if(db)await db.close();
}
process.once('SIGINT',()=>void shutdown('SIGINT').finally(()=>process.exit(0)));
process.once('SIGTERM',()=>void shutdown('SIGTERM').finally(()=>process.exit(0)));
process.on('unhandledRejection',reason=>app?.log.error({event:'UNHANDLED_REJECTION',reason:redactDiagnostic(reason)},'Unhandled rejection'));
process.on('uncaughtException',error=>app?.log.fatal({event:'UNCAUGHT_EXCEPTION',error:redactDiagnostic({name:error.name,message:error.message,stack:error.stack})},'Uncaught exception'));
