import { existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import type { AppConfig } from '../config/index.js';

const SENSITIVE_KEY=/(password|secret|token|cookie|authorization|csrf|session|database.?url|connection.?string|private.?key)/i;
const MAX_TEXT=1000;

export function redactDiagnostic(value:unknown,depth=0):unknown{
  if(depth>5)return '[TRUNCATED]';
  if(typeof value==='string')return value.length>MAX_TEXT?value.slice(0,MAX_TEXT)+'?':value;
  if(Array.isArray(value))return value.slice(0,50).map(x=>redactDiagnostic(x,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).slice(0,100).map(([key,item])=>[key,SENSITIVE_KEY.test(key)?'[REDACTED]':redactDiagnostic(item,depth+1)]));
  return value;
}

export function prepareLogFile(config:AppConfig):string|undefined{
  if(!config.logToFile||config.logLevel==='silent')return undefined;
  const directory=isAbsolute(config.logDirectory)?config.logDirectory:resolve(config.logDirectory);
  mkdirSync(directory,{recursive:true});
  const active=join(directory,'schoolhub-server.log');
  const maxBytes=config.logMaxSizeMb*1024*1024;
  if(existsSync(active)&&statSync(active).size>=maxBytes){
    const suffix=new Date().toISOString().replace(/[:.]/g,'-');
    renameSync(active,join(directory,`schoolhub-server-${suffix}.log`));
  }
  const cutoff=Date.now()-config.logRetentionDays*86400000;
  for(const name of readdirSync(directory)){
    if(!/^schoolhub-server-.*\.log$/.test(name))continue;
    const file=join(directory,name);
    if(statSync(file).mtimeMs<cutoff)unlinkSync(file);
  }
  return active;
}

export function logMetadata(config:AppConfig){
  return {level:config.logLevel,toFile:config.logToFile,maxSizeMb:config.logMaxSizeMb,retentionDays:config.logRetentionDays};
}
