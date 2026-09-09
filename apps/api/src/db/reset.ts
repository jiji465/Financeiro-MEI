// pnpm db:reset — apaga a pasta do PGlite local e recria o banco vazio (com migrações, se houver).
// Recusa rodar contra Postgres remoto (DATABASE_URL): lá o reset é manual, por segurança.
import { existsSync, rmSync } from 'node:fs';

import { loadEnv } from '../config/env.js';
import { createDb, MEMORY_DATA_DIR } from './index.js';

const env = loadEnv();
if (env.DB_DRIVER !== 'pglite') {
  console.error(
    'db:reset só funciona com PGlite local. Para Postgres remoto, apague as tabelas manualmente.',
  );
  process.exit(1);
}
if (env.PGLITE_DATA_DIR === MEMORY_DATA_DIR) {
  console.error('PGLITE_DATA_DIR=memory:// não tem nada para apagar.');
  process.exit(1);
}
if (existsSync(env.PGLITE_DATA_DIR)) {
  rmSync(env.PGLITE_DATA_DIR, { recursive: true, force: true });
  console.log(`Pasta removida: ${env.PGLITE_DATA_DIR}`);
} else {
  console.log(`Pasta não existia: ${env.PGLITE_DATA_DIR}`);
}
const database = await createDb(env);
try {
  const resultado = await database.migrate();
  console.log(
    resultado.aplicado
      ? 'Banco recriado e migrações aplicadas.'
      : `Banco recriado vazio (${resultado.motivo ?? 'sem migrações'}).`,
  );
} finally {
  await database.close();
}
