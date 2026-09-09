// Fábrica de conexão: PGlite (dev/test, arquivo local ou memory://) ou pg (produção, DATABASE_URL).
// Um dialeto, um conjunto de migrações (apps/api/drizzle). Nunca editar fora de P0/P1-B.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';

import type { Env } from '../config/env.js';
import { migrationsDir } from '../config/paths.js';
import * as schema from './schema/index.js';

export type DbSchema = typeof schema;

/** Supertipo comum de PgliteDatabase e NodePgDatabase: services e repositories tipam contra ele. */
export type Db = PgDatabase<PgQueryResultHKT, DbSchema, ExtractTablesWithRelations<DbSchema>>;

/** Transação (mesma API de consulta do Db). */
export type DbTx = PgTransaction<PgQueryResultHKT, DbSchema, ExtractTablesWithRelations<DbSchema>>;

/** Aceito por repositories: conexão ou transação. */
export type DbExecutor = Db | DbTx;

export type DbKind = 'pglite' | 'pg';

export interface MigrateResult {
  aplicado: boolean;
  motivo?: string;
  pasta: string;
}

export interface Database {
  db: Db;
  kind: DbKind;
  /** Cliente bruto: PGlite (dev/test) ou pg.Pool (produção). Use isPgliteDatabase() para estreitar. */
  client: PGlite | pg.Pool;
  /** Pasta de dados do PGlite (ou 'memory://'); undefined no pg. */
  dataDir: string | undefined;
  /** Aplica as migrações de apps/api/drizzle; ignora com aviso se ainda não houver nenhuma. */
  migrate(): Promise<MigrateResult>;
  /** Transação. No PGlite (conexão única) é serializada por um mutex em processo. */
  withTx<T>(fn: (tx: DbTx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export type PgliteDatabaseHandle = Database & { kind: 'pglite'; client: PGlite; dataDir: string };

export function isPgliteDatabase(database: Database): database is PgliteDatabaseHandle {
  return database.kind === 'pglite';
}

/** Mutex simples (fila de promessas) para serializar transações no PGlite. */
class Mutex {
  private fila: Promise<void> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const anterior = this.fila;
    let liberar!: () => void;
    this.fila = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    return anterior.then(fn).finally(() => liberar());
  }
}

export const MEMORY_DATA_DIR = 'memory://';

function temMigracoes(pasta: string): boolean {
  return existsSync(join(pasta, 'meta', '_journal.json'));
}

async function createPglite(dataDir: string): Promise<Database> {
  const emMemoria = dataDir === MEMORY_DATA_DIR;
  if (!emMemoria) mkdirSync(dataDir, { recursive: true });

  const client = new PGlite(emMemoria ? MEMORY_DATA_DIR : dataDir);
  await client.waitReady;
  const db = drizzlePglite({ client, schema });
  const mutex = new Mutex();
  const pasta = migrationsDir();

  return {
    kind: 'pglite',
    client,
    dataDir,
    db: db as unknown as Db,
    async migrate() {
      if (!temMigracoes(pasta)) {
        return { aplicado: false, pasta, motivo: 'nenhuma migração encontrada' };
      }
      await mutex.run(() => migratePglite(db, { migrationsFolder: pasta }));
      return { aplicado: true, pasta };
    },
    withTx(fn) {
      return mutex.run(() => db.transaction((tx) => fn(tx as unknown as DbTx)));
    },
    async close() {
      await client.close();
    },
  };
}

async function createPg(connectionString: string): Promise<Database> {
  const client = new pg.Pool({ connectionString, max: 10 });
  // Falha cedo se a URL estiver errada
  const conexao = await client.connect();
  conexao.release();
  const db = drizzlePg({ client, schema });
  const pasta = migrationsDir();

  return {
    kind: 'pg',
    client,
    dataDir: undefined,
    db: db as unknown as Db,
    async migrate() {
      if (!temMigracoes(pasta)) {
        return { aplicado: false, pasta, motivo: 'nenhuma migração encontrada' };
      }
      await migratePg(db, { migrationsFolder: pasta });
      return { aplicado: true, pasta };
    },
    withTx(fn) {
      return db.transaction((tx) => fn(tx as unknown as DbTx));
    },
    async close() {
      await client.end();
    },
  };
}

/** Cria a conexão conforme o env: DATABASE_URL → pg; senão PGlite em PGLITE_DATA_DIR (ou memory://). */
export async function createDb(env: Pick<Env, 'DB_DRIVER' | 'DATABASE_URL' | 'PGLITE_DATA_DIR'>) {
  if (env.DB_DRIVER === 'pg' && env.DATABASE_URL) {
    return createPg(env.DATABASE_URL);
  }
  return createPglite(env.PGLITE_DATA_DIR);
}

export { schema };
