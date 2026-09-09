// Configuração do drizzle-kit (generate/push/migrate). Sem DATABASE_URL usa o PGlite local.
// drizzle-kit não carrega .env sozinho, então carregamos aqui (raiz do repo ou pasta atual).
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { defineConfig } from 'drizzle-kit';

for (const candidato of [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')]) {
  if (existsSync(candidato)) {
    process.loadEnvFile(candidato);
    break;
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
// Manter em sincronia com defaultPgliteDir() em src/config/env.ts
const pgliteDir =
  process.env.PGLITE_DATA_DIR?.trim() ||
  join(process.env.LOCALAPPDATA?.trim() || join(homedir(), '.local', 'share'), 'meifin', 'pglite');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  ...(databaseUrl
    ? { dbCredentials: { url: databaseUrl } }
    : { driver: 'pglite', dbCredentials: { url: pgliteDir } }),
});
