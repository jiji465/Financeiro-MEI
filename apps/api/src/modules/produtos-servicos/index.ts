// Módulo produtos-servicos: rotas em routes.ts, regras em service.ts, acesso a dados em
// repository.ts. O plugin recebe a instância já com o type provider zod; usa app.db / request.tenantId.
//
// O módulo de lançamentos importa `itensDoLancamento` e `sincronizarItens` daqui: os itens são
// gravados junto com o lançamento, mas as regras deles (arredondamento, soma que tem que bater)
// pertencem a este módulo.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { produtosServicosRoutes } from './routes.js';

export const produtosServicosModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(produtosServicosRoutes);
};

export {
  calcularItens,
  itensDoLancamento,
  itensPorLancamento,
  sincronizarItens,
  toLancamentoItemDto,
  toProdutoServicoDto,
  toProdutoServicoOpcaoDto,
} from './service.js';
