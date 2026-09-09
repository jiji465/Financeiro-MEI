// pnpm db:seed [--demo] — seeds de parâmetros MEI e categorias padrão (P1-B) e dados demo (WP5/Phase 3).
// Preenchido por P1-B (API core): parametros-mei.ts, categorias-padrao.ts. WP5: demo.ts.
import { loadEnv } from '../../config/env.js';
import { createDb } from '../index.js';

const demo = process.argv.includes('--demo');
const env = loadEnv();
const database = await createDb(env);
try {
  await database.migrate();
  console.log(
    demo
      ? 'Seed demo ainda não implementado (WP5 / Phase 3).'
      : 'Seed de parâmetros ainda não implementado (P1-B).',
  );
} finally {
  await database.close();
}
