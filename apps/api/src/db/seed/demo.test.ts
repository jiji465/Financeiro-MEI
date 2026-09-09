// Testes do seed de demonstração: cria o tenant demo, confere as contagens principais, o login
// funciona com a senha publicada e rodar de novo é idempotente (não duplica nada).
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { createDb, type Database, MEMORY_DATA_DIR } from '../index.js';
import { criarHoje } from '../../lib/hoje.js';
import { MemoryMailer } from '../../lib/mailer.js';
import { runSeeds } from './index.js';
import { DEMO_EMAIL, DEMO_SENHA, seedDemo } from './demo.js';

const HOJE = '2026-09-09';

describe('seedDemo', () => {
  let database: Database;
  let app: FastifyInstance;

  beforeAll(async () => {
    database = await createDb(
      loadEnv({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        PGLITE_DATA_DIR: MEMORY_DATA_DIR,
        JWT_ACCESS_SECRET: 'test-access-secret-0123456789-0123456789-abc',
        JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789-0123456789-abc',
      }),
    );
    await database.migrate();
    await runSeeds(database.db);
    // Um único app para todo o describe: app.close() já fecha o database (plugins/db.ts).
    app = await buildApp({
      env: loadEnv({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        PGLITE_DATA_DIR: MEMORY_DATA_DIR,
        JWT_ACCESS_SECRET: 'test-access-secret-0123456789-0123456789-abc',
        JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789-0123456789-abc',
      }),
      db: database,
      logger: false,
      mailer: new MemoryMailer(),
      hoje: criarHoje(HOJE),
      rateLimit: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria clientes, fornecedores, lançamentos, notas, títulos/parcelas e DAS pagos', async () => {
    const resultado = await seedDemo(database, criarHoje(HOJE)());
    expect(resultado.criado).toBe(true);
    const c = resultado.contadores!;
    expect(c.clientes).toBe(8);
    expect(c.fornecedores).toBe(6);
    expect(c.notasFiscais).toBe(14);
    expect(c.titulos).toBe(3);
    expect(c.parcelas).toBe(9); // 3 + 2 + 4
    expect(c.dasPagos).toBe(11);
    // 12 meses × (2 receitas + 7~8 despesas) + 3 parcelas baixadas como lançamento.
    expect(c.lancamentos).toBeGreaterThan(100);
  });

  it('é idempotente: rodar de novo não duplica (usuário já existe)', async () => {
    const resultado = await seedDemo(database, criarHoje(HOJE)());
    expect(resultado).toEqual({ criado: false });
  });

  it('o usuário demo consegue entrar com as credenciais publicadas', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: DEMO_EMAIL, senha: DEMO_SENHA },
    });
    expect(res.statusCode).toBe(200);
    const corpo = res.json<{
      user: { email: string };
      tenant: { nome: string };
      accessToken: string;
    }>();
    expect(corpo.user.email).toBe(DEMO_EMAIL);

    // Dashboard: o mês corrente tem receitas pendentes (o 2º recebimento do mês ainda não caiu).
    const resumo = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/resumo',
      headers: { authorization: `Bearer ${corpo.accessToken}` },
    });
    expect(resumo.statusCode).toBe(200);
    const dados = resumo.json<{
      data: { receitasPendentes: number; limite: { percentual: number } | null };
    }>().data;
    expect(dados.receitasPendentes).toBeGreaterThan(0);
    expect(dados.limite?.percentual).toBeGreaterThan(0);
  });
});
