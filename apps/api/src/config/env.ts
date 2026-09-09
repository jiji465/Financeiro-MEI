// Variáveis de ambiente validadas com zod. Única fonte de configuração da API.
// Carregamento do arquivo .env: `tsx --env-file-if-exists` (dev) / `node --env-file-if-exists` (prod);
// main.ts também tenta process.loadEnvFile como fallback. Sem dotenv.
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { z } from 'zod';

import { apiRootDir } from './paths.js';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export type DbDriver = 'pglite' | 'pg';

/** Pasta padrão dos dados do PGlite: %LOCALAPPDATA%\meifin\pglite (fora do OneDrive). */
export function defaultPgliteDir(): string {
  const base = process.env.LOCALAPPDATA?.trim() || join(homedir(), '.local', 'share');
  return join(base, 'meifin', 'pglite');
}

/** Build do frontend servido quando SERVE_WEB=true. */
export function defaultWebDistDir(): string {
  return resolve(apiRootDir(), '..', 'web', 'dist');
}

function csvParaLista(valor: string | undefined): string[] | undefined {
  if (!valor) return undefined;
  const itens = valor
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return itens.length > 0 ? itens : undefined;
}

const segredo = (nome: string) =>
  z
    .string()
    .min(32, `${nome} deve ter pelo menos 32 caracteres`)
    .max(512, `${nome} deve ter no máximo 512 caracteres`);

const envBruto = z.object({
  NODE_ENV: z.enum(NODE_ENVS).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  HOST: z.string().min(1).default('127.0.0.1'),
  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  APP_URL: z.url('APP_URL deve ser uma URL válida').default('http://127.0.0.1:5173'),
  CORS_ORIGIN: z.string().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  PGLITE_DATA_DIR: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: segredo('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: segredo('JWT_REFRESH_SECRET'),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  SERVE_WEB: z.stringbool().default(false),
  WEB_DIST_DIR: z.string().min(1).optional(),
  SWAGGER: z.stringbool().optional(),
  TZ_BUSINESS: z.string().min(1).default('America/Sao_Paulo'),
});

export const envSchema = envBruto
  .transform((raw) => {
    const isProd = raw.NODE_ENV === 'production';
    const isTest = raw.NODE_ENV === 'test';
    const logPadrao: LogLevel = isTest ? 'silent' : isProd ? 'info' : 'debug';
    const databaseUrl = raw.DATABASE_URL?.trim() || undefined;
    return {
      ...raw,
      LOG_LEVEL: raw.LOG_LEVEL ?? logPadrao,
      CORS_ORIGIN: csvParaLista(raw.CORS_ORIGIN) ?? [raw.APP_URL],
      DATABASE_URL: databaseUrl,
      DB_DRIVER: (databaseUrl ? 'pg' : 'pglite') as DbDriver,
      PGLITE_DATA_DIR: raw.PGLITE_DATA_DIR?.trim() || defaultPgliteDir(),
      WEB_DIST_DIR: raw.WEB_DIST_DIR?.trim() || defaultWebDistDir(),
      SWAGGER: raw.SWAGGER ?? !isProd,
      IS_PRODUCTION: isProd,
      IS_TEST: isTest,
      IS_DEVELOPMENT: !isProd && !isTest,
    };
  })
  .superRefine((env, ctx) => {
    if (!env.IS_PRODUCTION) return;
    if (!env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'Em produção (NODE_ENV=production) DATABASE_URL é obrigatória (Supabase/Neon)',
      });
    }
    for (const chave of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (env[chave].startsWith('dev-')) {
        ctx.addIssue({
          code: 'custom',
          path: [chave],
          message: `${chave} não pode usar o valor de desenvolvimento (prefixo "dev-") em produção`,
        });
      }
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET deve ser diferente de JWT_ACCESS_SECRET',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
export type EnvInput = Record<string, string | undefined>;

export class EnvError extends Error {
  constructor(public readonly problemas: string[]) {
    super(`Configuração de ambiente inválida:\n${problemas.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvError';
  }
}

/**
 * Valida e normaliza as variáveis de ambiente. Strings vazias contam como ausentes
 * (o .env.example deixa DATABASE_URL= e PGLITE_DATA_DIR= vazios de propósito).
 */
export function loadEnv(source: EnvInput = process.env): Env {
  const limpo: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(source)) {
    if (typeof valor === 'string' && valor.trim() !== '') limpo[chave] = valor;
  }
  const resultado = envSchema.safeParse(limpo);
  if (!resultado.success) {
    throw new EnvError(
      resultado.error.issues.map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`),
    );
  }
  return resultado.data;
}
