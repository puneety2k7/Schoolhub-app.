import 'fastify';
import type { Principal } from '../authorization/service.js';
declare module 'fastify' { interface FastifyRequest { principal?: Principal; sessionToken?: string; sessionCsrfHash?: string; correlationId: string; } }
