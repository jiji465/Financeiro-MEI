// Augmentações de tipo do Fastify e do @fastify/jwt usadas por plugins e módulos.
import type { FastifyReply } from 'fastify';

import type { Env } from '../config/env.js';
import type { Database, Db } from '../db/index.js';
import type { AccessTokenPayload } from '../plugins/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Env validado (plugin raiz). */
    env: Env;
    /** Instância Drizzle (PgDatabase comum a PGlite e pg). */
    db: Db;
    /** Handle completo: kind, withTx, migrate, close. */
    database: Database;
    /** onRequest hook: verifica o Bearer e preenche request.user / request.tenantId. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    /** Tenant do usuário autenticado (vazio em rotas públicas). */
    tenantId: string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}
