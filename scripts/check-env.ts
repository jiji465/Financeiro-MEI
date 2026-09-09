// pnpm env:check — mostra a configuração efetiva e avisa sobre OneDrive/espaços no caminho.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { defaultPgliteDir } from '../apps/api/src/config/env.js';

const raiz = resolve(import.meta.dirname, '..');
const envFile = resolve(raiz, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const databaseUrl = process.env.DATABASE_URL?.trim() || '';
const pgliteDir = process.env.PGLITE_DATA_DIR?.trim() || defaultPgliteDir();
const driver = databaseUrl
  ? 'pg (Postgres remoto via DATABASE_URL)'
  : 'pglite (local, sem instalação)';
const avisos: string[] = [];

console.log('MEI Financeiro — verificação de ambiente');
console.log(`  Node:            ${process.version}`);
console.log(`  Pasta do repo:   ${raiz}`);
console.log(
  `  Arquivo .env:    ${existsSync(envFile) ? envFile : '(ausente — copie .env.example para .env)'}`,
);
console.log(`  Banco:           ${driver}`);
console.log(
  `  Pasta do PGlite: ${pgliteDir}${existsSync(pgliteDir) ? ' (existe)' : ' (será criada no primeiro pnpm dev)'}`,
);
console.log(`  NODE_ENV:        ${process.env.NODE_ENV ?? 'development (padrão)'}`);

if (/onedrive/i.test(raiz)) {
  avisos.push(
    'O repositório está dentro do OneDrive. A sincronização pode travar node_modules e builds. ' +
      'Recomendação: mover a pasta para C:\\dev\\meifin ou pausar o OneDrive durante "pnpm install".',
  );
}
if (/\s/.test(raiz)) {
  avisos.push(
    'O caminho do repositório contém espaços. Funciona, mas sempre use aspas nos comandos.',
  );
}
if (/onedrive/i.test(pgliteDir)) {
  avisos.push(
    'A pasta do PGlite está dentro do OneDrive! Defina PGLITE_DATA_DIR fora dele (padrão: %LOCALAPPDATA%\\meifin\\pglite).',
  );
}
if (!existsSync(envFile)) {
  avisos.push('Sem .env: a API usará apenas variáveis do ambiente e falhará sem JWT_*_SECRET.');
}

if (avisos.length === 0) {
  console.log('\nTudo certo: dados do banco fora do OneDrive e configuração encontrada.');
} else {
  console.log('\nAvisos:');
  for (const a of avisos) console.log(`  - ${a}`);
}
