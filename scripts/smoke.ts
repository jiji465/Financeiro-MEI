// Smoke test ponta a ponta: sobe a API em processo (PGlite memory://) e exercita rotas reais
// via app.inject. Sai com código 1 e mensagem em pt-BR na primeira falha.
// Fases seguintes acrescentam passos ao array PASSOS (P1-B: 1-2, WP2: 3, WP4: 4, WP5: 5-6, Phase 3: 7).
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../apps/api/src/app.js';
import { loadEnv } from '../apps/api/src/config/env.js';
import { createDb, type Database, MEMORY_DATA_DIR } from '../apps/api/src/db/index.js';

export interface SmokeContext {
  app: FastifyInstance;
  database: Database;
  /** Estado compartilhado entre passos (tokens, ids criados etc.). */
  estado: Record<string, unknown>;
}

export interface Passo {
  nome: string;
  run: (ctx: SmokeContext) => Promise<void>;
}

function esperar(condicao: boolean, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem);
}

export const PASSOS: Passo[] = [
  {
    nome: '0. GET /api/v1/health responde ok com PGlite',
    async run({ app }) {
      const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
      esperar(res.statusCode === 200, `status esperado 200, recebido ${res.statusCode}`);
      const corpo = res.json<{ status: string; db: string; versao: string }>();
      esperar(corpo.status === 'ok', `status esperado "ok", recebido "${corpo.status}"`);
      esperar(corpo.db === 'pglite', `db esperado "pglite", recebido "${corpo.db}"`);
      esperar(typeof corpo.versao === 'string' && corpo.versao.length > 0, 'versao ausente');
    },
  },
  // P1-B: 1. signup/login/me  2. categorias padrão
  // WP2: 3. lançamentos + importação CSV   WP4: 4. DAS pago gera despesa
  // WP5: 5. dashboard 6. relatórios (PDF começa com %PDF, CSV com BOM e ";")
  // Phase 3: 7. isolamento entre dois tenants
];

async function main() {
  const inicio = Date.now();
  const env = loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    PGLITE_DATA_DIR: MEMORY_DATA_DIR,
    JWT_ACCESS_SECRET: 'smoke-access-secret-0123456789-0123456789-abc',
    JWT_REFRESH_SECRET: 'smoke-refresh-secret-0123456789-0123456789-abc',
    SWAGGER: 'false',
  });
  const database = await createDb(env);
  await database.migrate();
  const app = await buildApp({ env, db: database, logger: false });
  await app.ready();
  const ctx: SmokeContext = { app, database, estado: {} };

  let falhou = false;
  try {
    for (const passo of PASSOS) {
      const t = Date.now();
      try {
        await passo.run(ctx);
        console.log(`  ok   ${passo.nome} (${Date.now() - t} ms)`);
      } catch (erro) {
        falhou = true;
        console.error(`  FALHA ${passo.nome}`);
        console.error(`        ${erro instanceof Error ? erro.message : String(erro)}`);
        break;
      }
    }
  } finally {
    await app.close();
  }

  if (falhou) {
    console.error(`\nSmoke test falhou (${Date.now() - inicio} ms).`);
    process.exit(1);
  }
  console.log(
    `\nSmoke test concluído com sucesso: ${PASSOS.length} passo(s) em ${Date.now() - inicio} ms.`,
  );
}

main().catch((erro) => {
  console.error(
    'Smoke test não conseguiu subir a API:',
    erro instanceof Error ? erro.message : erro,
  );
  process.exit(1);
});
