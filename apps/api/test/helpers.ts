// Helpers de teste: app completo com PGlite em memória. Um app por arquivo de teste
// (beforeAll/afterAll) — PGlite em WASM é pesado para criar por teste.
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';

import { buildApp } from '../src/app.js';
import { type Env, type EnvInput, loadEnv } from '../src/config/env.js';
import { createDb, type Database, MEMORY_DATA_DIR } from '../src/db/index.js';
import { runSeeds } from '../src/db/seed/index.js';
import type { HojeFn } from '../src/lib/hoje.js';
import { MemoryMailer } from '../src/lib/mailer.js';
import { LocalDiskStorage } from '../src/lib/storage.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const TEST_ENV: EnvInput = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  PGLITE_DATA_DIR: MEMORY_DATA_DIR,
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789-0123456789-abc',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789-0123456789-abc',
  SWAGGER: 'false',
  SERVE_WEB: 'false',
};

export interface TestAppOptions {
  /** Liga o @fastify/rate-limit (padrão: desligado nos testes). */
  rateLimit?: boolean;
  /** Relógio de negócio fixo. */
  hoje?: HojeFn;
  /** Não roda os seeds (parâmetros MEI) após migrar. */
  semSeeds?: boolean;
}

export interface TestApp {
  app: FastifyInstance;
  env: Env;
  database: Database;
  /** Mailer em memória: captura e-mails (link de redefinição de senha). */
  mailer: MemoryMailer;
  /** Fecha app e banco (chamar em afterAll). */
  close(): Promise<void>;
}

/** Cria env + PGlite memory:// + migrações + seeds + app pronto (app.ready()). */
export async function buildTestApp(
  overrides: EnvInput = {},
  opcoes: TestAppOptions = {},
): Promise<TestApp> {
  const env = loadEnv({ ...TEST_ENV, ...overrides });
  const database = await createDb(env);
  await database.migrate();
  if (!opcoes.semSeeds) await runSeeds(database.db);
  const mailer = new MemoryMailer();
  const storage = new LocalDiskStorage(join(tmpdir(), 'meifin-test-uploads', randomUUID()));
  const app = await buildApp({
    env,
    db: database,
    logger: false,
    mailer,
    storage,
    hoje: opcoes.hoje,
    rateLimit: opcoes.rateLimit ?? false,
  });
  await app.ready();
  return {
    app,
    env,
    database,
    mailer,
    close: () => app.close(),
  };
}

// ---------- autenticação ----------

let contadorSignup = 0;

export interface SignupOverrides {
  nome?: string;
  email?: string;
  senha?: string;
  cnpj?: string;
  atividade?: 'comercio' | 'servicos' | 'comercio_servicos' | 'caminhoneiro';
  caminhoneiroTributos?: 'icms' | 'iss' | 'ambos';
  dataAbertura?: string;
}

export interface TenantSession {
  accessToken: string;
  tenantId: string;
  userId: string;
  email: string;
  senha: string;
  /** Cookies devolvidos no signup (refresh_token). */
  cookies: Record<string, string>;
  /** Cabeçalhos prontos para app.inject: Authorization: Bearer ... */
  headers: { authorization: string };
  user: { id: string; tenantId: string; nome: string; email: string; role: string };
  tenant: { id: string; nome: string; atividade: string };
}

/** Converte os set-cookie da resposta em { nome: valor }. */
export function cookiesDe(res: LightMyRequestResponse): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const c of res.cookies as Array<{ name: string; value: string }>) {
    saida[c.name] = c.value;
  }
  return saida;
}

/** Cria um tenant + usuário via POST /auth/signup e devolve token, ids e cookies. */
export async function signupTenant(
  app: FastifyInstance,
  overrides: SignupOverrides = {},
): Promise<TenantSession> {
  contadorSignup += 1;
  const senha = overrides.senha ?? 'Senha@12345';
  const email = overrides.email ?? `mei${contadorSignup}-${randomUUID().slice(0, 8)}@teste.com`;
  const payload = {
    nome: overrides.nome ?? `MEI Teste ${contadorSignup}`,
    email,
    senha,
    atividade: overrides.atividade ?? 'servicos',
    ...(overrides.cnpj ? { cnpj: overrides.cnpj } : {}),
    ...(overrides.caminhoneiroTributos
      ? { caminhoneiroTributos: overrides.caminhoneiroTributos }
      : {}),
    ...(overrides.dataAbertura ? { dataAbertura: overrides.dataAbertura } : {}),
  };
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/signup', payload });
  if (res.statusCode !== 201) {
    throw new Error(`signupTenant falhou (${res.statusCode}): ${res.body}`);
  }
  const corpo = res.json<{
    accessToken: string;
    user: TenantSession['user'];
    tenant: TenantSession['tenant'];
  }>();
  return {
    accessToken: corpo.accessToken,
    tenantId: corpo.tenant.id,
    userId: corpo.user.id,
    email,
    senha,
    cookies: cookiesDe(res),
    headers: { authorization: `Bearer ${corpo.accessToken}` },
    user: corpo.user,
    tenant: corpo.tenant,
  };
}

/** app.inject já autenticado como a sessão informada. */
export function injectComo(
  app: FastifyInstance,
  sessao: Pick<TenantSession, 'headers'>,
  opcoes: InjectOptions,
): Promise<LightMyRequestResponse> {
  return app.inject({
    ...opcoes,
    headers: { ...sessao.headers, ...(opcoes.headers as Record<string, string> | undefined) },
  });
}
