// Entrada do servidor: env → banco → migrações → seeds → app → listen. Encerra o banco em SIGINT/SIGTERM.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { repoRootDir } from './config/paths.js';
import { createDb } from './db/index.js';
import { runSeeds } from './db/seed/index.js';

// Fallback quando o processo não foi iniciado com --env-file (ex.: node dist/src/main.js).
// Variáveis já definidas no ambiente têm precedência sobre o arquivo.
const envFile = join(repoRootDir(), '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = loadEnv();
const database = await createDb(env);
const migracoes = await database.migrate();
const seeds = migracoes.aplicado ? await runSeeds(database.db) : undefined;
const app = await buildApp({ env, db: database });

app.log.info(
  migracoes.aplicado
    ? `Migrações aplicadas (${database.kind})`
    : `Migrações ignoradas: ${migracoes.motivo ?? 'sem migrações'} (${database.kind})`,
);
if (seeds && seeds.parametrosMeiInseridos > 0) {
  app.log.info(`Seed: ${seeds.parametrosMeiInseridos} ano(s) de parâmetros MEI inseridos`);
}

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (erro) {
  app.log.error(erro, 'Falha ao iniciar a API');
  await app.close();
  process.exit(1);
}

app.log.info(`MEI Financeiro API: http://${env.HOST}:${env.PORT}/api/v1/health`);
if (env.SWAGGER) app.log.info(`Documentação: http://${env.HOST}:${env.PORT}/docs`);

let encerrando = false;
async function encerrar(sinal: NodeJS.Signals) {
  if (encerrando) return;
  encerrando = true;
  app.log.info(`Recebido ${sinal}, encerrando...`);
  try {
    await app.close(); // fecha o banco via plugin db (onClose)
    process.exit(0);
  } catch (erro) {
    app.log.error(erro, 'Erro ao encerrar');
    process.exit(1);
  }
}
process.once('SIGINT', encerrar);
process.once('SIGTERM', encerrar);
