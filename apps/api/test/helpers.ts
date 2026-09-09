// Helpers de teste: app completo com PGlite em memória. Um app por arquivo de teste
// (beforeAll/afterAll) — PGlite em WASM é pesado para criar por teste.
// P1-B (API core) acrescenta helpers de autenticação (criar tenant/usuário, token) e isolamento.
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.js';
import { type Env, type EnvInput, loadEnv } from '../src/config/env.js';
import { createDb, type Database, MEMORY_DATA_DIR } from '../src/db/index.js';

export const TEST_ENV: EnvInput = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  PGLITE_DATA_DIR: MEMORY_DATA_DIR,
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789-0123456789-abc',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789-0123456789-abc',
  SWAGGER: 'false',
  SERVE_WEB: 'false',
};

export interface TestApp {
  app: FastifyInstance;
  env: Env;
  database: Database;
  /** Fecha app e banco (chamar em afterAll). */
  close(): Promise<void>;
}

/** Cria env + PGlite memory:// + migrações + app pronto (app.ready()). */
export async function buildTestApp(overrides: EnvInput = {}): Promise<TestApp> {
  const env = loadEnv({ ...TEST_ENV, ...overrides });
  const database = await createDb(env);
  await database.migrate();
  const app = await buildApp({ env, db: database, logger: false });
  await app.ready();
  return {
    app,
    env,
    database,
    close: () => app.close(),
  };
}
