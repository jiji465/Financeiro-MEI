// Expõe app.db (Drizzle) e app.database (handle) e fecha a conexão no app.close().
import fp from 'fastify-plugin';

import type { Database } from '../db/index.js';

export interface DbPluginOptions {
  database: Database;
}

export const dbPlugin = fp<DbPluginOptions>(
  async (app, { database }) => {
    app.decorate('db', database.db);
    app.decorate('database', database);
    app.addHook('onClose', async () => {
      await database.close();
    });
  },
  { name: 'meifin-db' },
);
