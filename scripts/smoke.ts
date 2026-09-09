// Smoke test ponta a ponta: sobe a API em processo (PGlite memory://) e exercita rotas reais
// via app.inject. Sai com código 1 e mensagem em pt-BR na primeira falha.
// Fases seguintes acrescentam passos ao array PASSOS (P1-B: 1-2, WP2: 3, WP4: 4, WP5: 5-6, Phase 3: 7).
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../apps/api/src/app.js';
import { type Env, loadEnv } from '../apps/api/src/config/env.js';
import { createDb, type Database, MEMORY_DATA_DIR } from '../apps/api/src/db/index.js';
import { runSeeds } from '../apps/api/src/db/seed/index.js';
import { criarAuthService } from '../apps/api/src/modules/auth/service.js';

export interface SmokeContext {
  app: FastifyInstance;
  env: Env;
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
  {
    nome: '1. Criar conta (via admin, cadastro público não existe mais) → POST /auth/login → GET /auth/me',
    async run({ app, env, database, estado }) {
      const email = `smoke-${Date.now()}@meifin.test`;
      const senha = 'Smoke@12345';
      // Cadastro público foi removido (seção 11 do plano): quem cria conta é sempre o admin
      // (POST /admin/contas). Aqui usamos a mesma função interna diretamente, sem passar por
      // um admin de verdade, só para validar a criação de tenant/usuário/categorias ponta a ponta.
      // app.jwt só existe em tempo de execução (decorado pelo plugin @fastify/jwt); o tipo
      // FastifyInstance "puro" que este script enxerga (fora do projeto apps/api) não inclui essa
      // augmentação — daqui vem o cast pontual abaixo, só para o assinar do token.
      const jwtSign = (app as unknown as { jwt: { sign: (p: unknown) => string } }).jwt.sign;
      const authService = criarAuthService({
        database,
        env,
        mailer: { enviar: async () => {} },
        sign: (payload) => jwtSign(payload),
      });
      const signup = await authService.signup(
        { nome: 'MEI Smoke', email, senha, atividade: 'comercio_servicos' },
        {},
      );
      esperar(typeof signup.accessToken === 'string', 'signup sem accessToken');
      esperar(signup.tenant.id.length > 0, 'signup sem tenant');
      const corpo = signup;

      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, senha },
      });
      esperar(login.statusCode === 200, `login: esperado 200, recebido ${login.statusCode}`);
      const accessToken = login.json<{ accessToken: string }>().accessToken;

      const me = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      esperar(me.statusCode === 200, `me: esperado 200, recebido ${me.statusCode}`);
      const dados = me.json<{ data: { user: { email: string }; tenant: { id: string } } }>().data;
      esperar(dados.user.email === email, 'me devolveu outro usuário');
      esperar(dados.tenant.id === corpo.tenant.id, 'me devolveu outro tenant');

      estado.accessToken = accessToken;
      estado.tenantId = corpo.tenant.id;
      estado.userId = corpo.user.id;
      estado.headers = { authorization: `Bearer ${accessToken}` };
    },
  },
  {
    nome: '2. GET /categorias devolve as categorias padrão (≥ 10, com "Impostos e DAS")',
    async run({ app, estado }) {
      const headers = estado.headers as Record<string, string>;
      const res = await app.inject({ method: 'GET', url: '/api/v1/categorias', headers });
      esperar(res.statusCode === 200, `categorias: esperado 200, recebido ${res.statusCode}`);
      const { data } = res.json<{
        data: Array<{ id: string; nome: string; tipo: string; sistema: boolean }>;
      }>();
      esperar(data.length >= 10, `esperado ≥ 10 categorias, recebido ${data.length}`);
      const das = data.find((c) => c.sistema);
      esperar(
        !!das && das.nome === 'Impostos e DAS',
        'categoria de sistema "Impostos e DAS" ausente',
      );
      esperar(
        data.some((c) => c.tipo === 'receita'),
        'nenhuma categoria de receita',
      );
      esperar(
        data.some((c) => c.tipo === 'despesa'),
        'nenhuma categoria de despesa',
      );

      const sem = await app.inject({ method: 'GET', url: '/api/v1/categorias' });
      esperar(sem.statusCode === 401, `sem token: esperado 401, recebido ${sem.statusCode}`);

      estado.categoriaReceitaId = data.find((c) => c.tipo === 'receita')!.id;
      estado.categoriaDasId = das!.id;
    },
  },
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
  await runSeeds(database.db);
  const app = await buildApp({ env, db: database, logger: false });
  await app.ready();
  const ctx: SmokeContext = { app, env, database, estado: {} };

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
