// pnpm db:backup — exporta o PGlite local (dumpDataDir) para %LOCALAPPDATA%\meifin\backups\*.tar.gz
// P1-B (API core) pode acrescentar pg_dump para Postgres remoto.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { loadEnv } from '../config/env.js';
import { createDb, isPgliteDatabase } from './index.js';

const env = loadEnv();
const database = await createDb(env);
try {
  if (!isPgliteDatabase(database)) {
    console.error(
      'db:backup só cobre o PGlite local. Para Supabase/Neon use o backup do provedor ou pg_dump.',
    );
    process.exit(1);
  }
  const pasta = join(dirname(database.dataDir), 'backups');
  mkdirSync(pasta, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
  const destino = join(pasta, `pglite-${carimbo}.tar.gz`);
  const blob = await database.client.dumpDataDir('gzip');
  writeFileSync(destino, Buffer.from(await blob.arrayBuffer()));
  console.log(`Backup gravado em ${destino}`);
} finally {
  await database.close();
}
