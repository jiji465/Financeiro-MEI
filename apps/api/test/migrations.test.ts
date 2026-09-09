// Aplica apps/api/drizzle em um PGlite memory:// limpo e confere tabelas, enums e idempotência.
import { readdirSync } from 'node:fs';
import { type SQL, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/env.js';
import { migrationsDir } from '../src/config/paths.js';
import { createDb, type Database, MEMORY_DATA_DIR } from '../src/db/index.js';
import { TEST_ENV } from './helpers.js';

/** Um arquivo .sql = uma migração aplicada; conta os arquivos em vez de fixar um número. */
function totalMigracoes(): number {
  return readdirSync(migrationsDir()).filter((f) => f.endsWith('.sql')).length;
}

const TABELAS_ESPERADAS = [
  'alertas_dispensados',
  'categorias',
  'configuracoes',
  'contatos',
  'das_pagamentos',
  'dasn_declaracoes',
  'importacoes',
  'lancamentos',
  'notas_fiscais',
  'parametros_mei',
  'parcelas',
  'password_reset_tokens',
  'recorrencias',
  'refresh_tokens',
  'solicitacoes_acesso',
  'tenants',
  'titulos',
  'users',
];

const ENUMS_ESPERADOS = [
  'atividade',
  'caminhoneiro_tributos',
  'forma_pagamento',
  'grupo_dasn',
  'origem_lancamento',
  'regime_apuracao',
  'status_dasn',
  'status_lancamento',
  'status_nota',
  'status_parcela',
  'status_solicitacao',
  'status_titulo',
  'tipo_contato',
  'tipo_lancamento',
  'tipo_nota',
  'tipo_titulo',
  'user_role',
];

/** db.execute é tipado como unknown no supertipo Db; PGlite e pg devolvem { rows }. */
async function linhas<T>(database: Database, consulta: SQL): Promise<T[]> {
  const res = (await database.db.execute(consulta)) as unknown as { rows: T[] };
  return res.rows;
}

describe('migrações (0000_init)', () => {
  let database: Database;

  beforeAll(async () => {
    database = await createDb(loadEnv({ ...TEST_ENV, PGLITE_DATA_DIR: MEMORY_DATA_DIR }));
  });

  afterAll(async () => {
    await database.close();
  });

  it('aplica a migração em um banco vazio', async () => {
    const resultado = await database.migrate();
    expect(resultado.aplicado).toBe(true);
  });

  it('cria exatamente as tabelas do modelo de dados', async () => {
    const res = await linhas<{ table_name: string }>(
      database,
      sql`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name
      `,
    );
    expect(res.map((r) => r.table_name)).toEqual(TABELAS_ESPERADAS);
  });

  it('cria os enums do domínio', async () => {
    const res = await linhas<{ typname: string }>(
      database,
      sql`
        select t.typname from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e'
        order by t.typname
      `,
    );
    expect(res.map((r) => r.typname)).toEqual(ENUMS_ESPERADOS);
  });

  it('tem as FKs compostas (tenant_id, x_id) e o índice único em lower(email)', async () => {
    const fks = await linhas<{ conname: string }>(
      database,
      sql`
        select conname from pg_constraint
        where contype = 'f' and array_length(conkey, 1) = 2
        order by conname
      `,
    );
    const nomes = fks.map((r) => r.conname);
    expect(nomes).toContain('lancamentos_categoria_fk');
    expect(nomes).toContain('configuracoes_categoria_das_fk');
    expect(nomes).toContain('parcelas_titulo_fk');

    const idx = await linhas<{ indexdef: string }>(
      database,
      sql`select indexdef from pg_indexes where indexname = 'users_email_lower_idx'`,
    );
    expect(idx[0]?.indexdef).toMatch(/UNIQUE INDEX .*lower\(email\)/i);
  });

  it('é idempotente (rodar de novo não falha nem duplica)', async () => {
    const resultado = await database.migrate();
    expect(resultado.aplicado).toBe(true);
    const res = await linhas<{ n: number }>(
      database,
      sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
    );
    expect(res[0]?.n).toBe(totalMigracoes());
  });
});
