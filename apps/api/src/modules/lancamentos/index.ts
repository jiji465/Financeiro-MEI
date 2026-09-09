// Módulo lançamentos (WP2): rotas de /lancamentos e /recorrencias (prefixo do registry é '').
// Criação/exclusão de lançamentos passa sempre por core.ts (congelado). Outros módulos importam
// daqui `gerarRecorrenciasPendentes(exec, tenantId, hoje)` (dashboard) e `toLancamentoDto`.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { recorrenciasRoutes } from './recorrencias.routes.js';
import { lancamentosRoutes } from './routes.js';

export const lancamentosModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(lancamentosRoutes);
  await app.register(recorrenciasRoutes);
};

export { criarLancamentoInterno, excluirLancamentoInterno } from './core.js';
export { gerarRecorrenciasPendentes, type OpcoesGeracao } from './recorrencias.service.js';
export { toLancamentoDto, type LancamentosCtx } from './service.js';
export type { LancamentoComRefs } from './repository.js';
