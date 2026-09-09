// Seeds idempotentes. runSeeds(db) roda no boot (main.ts) e em `pnpm db:seed`;
// `pnpm db:seed:demo` (--demo) fica para WP5/Phase 3 (db/seed/demo.ts).
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DbExecutor } from '../index.js';
import { seedParametrosMei } from './parametros-mei.js';

export interface SeedResult {
  parametrosMeiInseridos: number;
}

export async function runSeeds(exec: DbExecutor): Promise<SeedResult> {
  const parametrosMeiInseridos = await seedParametrosMei(exec);
  return { parametrosMeiInseridos };
}

function executadoComoScript(): boolean {
  const alvo = process.argv[1];
  if (!alvo) return false;
  const normalizar = (p: string) => {
    const r = resolve(p).replace(/\\/g, '/');
    return process.platform === 'win32' ? r.toLowerCase() : r;
  };
  return normalizar(fileURLToPath(import.meta.url)) === normalizar(alvo);
}

if (executadoComoScript()) {
  const { loadEnv } = await import('../../config/env.js');
  const { createDb } = await import('../index.js');
  const demo = process.argv.includes('--demo');
  const env = loadEnv();
  const database = await createDb(env);
  try {
    await database.migrate();
    const resultado = await runSeeds(database.db);
    console.log(
      `Seed de parâmetros MEI: ${resultado.parametrosMeiInseridos} ano(s) inserido(s) (${database.kind}).`,
    );
    if (demo) console.log('Seed demo: implementado na Phase 3 (db/seed/demo.ts).');
  } finally {
    await database.close();
  }
}
