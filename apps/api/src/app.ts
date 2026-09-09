// Monta a aplicação Fastify sem escutar porta (usado por main.ts, testes e scripts/smoke.ts).
import { existsSync } from 'node:fs';

import fastifyStatic from '@fastify/static';
import { API_PREFIX } from '@meifin/shared';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Env } from './config/env.js';
import { apiVersion } from './config/paths.js';
import type { Database } from './db/index.js';
import { hoje as hojePadrao, type HojeFn } from './lib/hoje.js';
import { ConsoleMailer, type Mailer } from './lib/mailer.js';
import { criarStorage, type FileStorage } from './lib/storage.js';
import { modules } from './modules/registry.js';
import { authPlugin } from './plugins/auth.js';
import { dbPlugin } from './plugins/db.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { multipartPlugin } from './plugins/multipart.js';
import { securityPlugin } from './plugins/security.js';
import { swaggerPlugin } from './plugins/swagger.js';

export interface BuildAppOptions {
  env: Env;
  /** Resultado de createDb(env). O app fecha a conexão em app.close(). */
  db: Database;
  /** Sobrescreve o logger (testes usam false). Padrão: pino com nível env.LOG_LEVEL. */
  logger?: FastifyServerOptions['logger'];
  /** Relógio de negócio injetável (testes). Padrão: hoje em America/Sao_Paulo. */
  hoje?: HojeFn;
  /** Mailer injetável (testes usam MemoryMailer). Padrão: ConsoleMailer (loga no pino). */
  mailer?: Mailer;
  /** Storage de anexos injetável. Padrão: disco local ao lado da pasta do PGlite. */
  storage?: FileStorage;
  /** Liga o rate limit (padrão: true, exceto NODE_ENV=test). */
  rateLimit?: boolean;
}

export const healthResponse = z.object({
  status: z.literal('ok'),
  db: z.enum(['pglite', 'pg']),
  versao: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponse>;

function criarLogger(env: Env): FastifyServerOptions['logger'] {
  if (env.LOG_LEVEL === 'silent') return false;
  if (env.IS_DEVELOPMENT) {
    return {
      level: env.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
    };
  }
  return { level: env.LOG_LEVEL };
}

export async function buildApp({
  env,
  db,
  logger,
  hoje,
  mailer,
  storage,
  rateLimit,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger ?? criarLogger(env),
    trustProxy: env.IS_PRODUCTION,
    bodyLimit: 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('env', env);
  app.decorate('hoje', hoje ?? hojePadrao);
  app.decorate('mailer', mailer ?? new ConsoleMailer(app.log));
  app.decorate('storage', storage ?? criarStorage(env));

  await app.register(dbPlugin, { database: db });
  await app.register(errorHandlerPlugin);
  await app.register(securityPlugin, { env, rateLimit: rateLimit ?? !env.IS_TEST });
  await app.register(authPlugin, { env });
  await app.register(multipartPlugin);
  if (env.SWAGGER) await app.register(swaggerPlugin, { env });

  app.get(
    `${API_PREFIX}/health`,
    {
      schema: {
        tags: ['infra'],
        summary: 'Estado da API e do banco',
        response: { 200: healthResponse },
      },
    },
    async () => ({ status: 'ok' as const, db: db.kind, versao: apiVersion() }),
  );

  // Cada módulo em contexto encapsulado: prefixo próprio + hook de autenticação (exceto auth).
  for (const mod of modules) {
    await app.register(
      async (scope) => {
        if (mod.requiresAuth) scope.addHook('onRequest', scope.authenticate);
        if (mod.requiresAdmin) scope.addHook('onRequest', scope.requireAdmin);
        await scope.register(mod.plugin);
      },
      { prefix: `${API_PREFIX}${mod.prefix}` },
    );
  }

  if (env.SERVE_WEB) await registrarWeb(app, env);

  return app;
}

/** Serve apps/web/dist com fallback SPA para rotas que não são /api (deploy single-service). */
async function registrarWeb(app: FastifyInstance, env: Env) {
  if (!existsSync(env.WEB_DIST_DIR)) {
    app.log.warn(`SERVE_WEB=true mas ${env.WEB_DIST_DIR} não existe; rode "pnpm build" primeiro.`);
    return;
  }
  await app.register(fastifyStatic, {
    root: env.WEB_DIST_DIR,
    prefix: '/',
    wildcard: false,
    index: ['index.html'],
  });
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith(API_PREFIX) || request.method !== 'GET') {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Rota não encontrada: ${request.method} ${request.url}`,
        },
      });
    }
    return reply.sendFile('index.html');
  });
}
