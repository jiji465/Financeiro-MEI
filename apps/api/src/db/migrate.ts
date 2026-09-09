// pnpm db:migrate — aplica as migrações de apps/api/drizzle no banco configurado.
// P1-B (API core) evolui este script junto com a migração 0000_init.
import { loadEnv } from '../config/env.js';
import { createDb } from './index.js';

const env = loadEnv();
const database = await createDb(env);
try {
  const resultado = await database.migrate();
  if (resultado.aplicado) {
    console.log(`Migrações aplicadas (${database.kind}) a partir de ${resultado.pasta}`);
  } else {
    console.log(
      `Nenhuma migração aplicada: ${resultado.motivo ?? 'motivo desconhecido'} (${resultado.pasta})`,
    );
  }
} finally {
  await database.close();
}
