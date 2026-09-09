// Feature "lancamentos" (WP2): lista com filtros na URL, drawer de criação/edição
// (?novo=receita|despesa, ?editar=<id>), recorrência e anexo. Também registra a rota do
// assistente de importação de CSV (`features/relatorios/importar`, ver docs/handoff/P1-C.md #3).
import { ArrowLeftRight } from 'lucide-react';

import type { AppModule } from '@/app/registry';

export const lancamentosModule: AppModule = {
  id: 'lancamentos',
  routes: [
    {
      path: '/lancamentos',
      lazy: async () => ({ Component: (await import('./pages/lista-page')).LancamentosListaPage }),
    },
    {
      path: '/relatorios/importar',
      lazy: async () => ({
        Component: (await import('../relatorios/importar/pages/importar-page')).ImportarCsvPage,
      }),
    },
  ],
  nav: [
    {
      id: 'lancamentos',
      label: 'Lançamentos',
      to: '/lancamentos',
      icon: ArrowLeftRight,
      ordem: 20,
      mobile: true,
    },
  ],
};

export { lancamentosKeys, recorrenciasKeys } from './keys';
export { invalidarAposMutacaoFinanceira } from './invalidate';
export {
  useAtualizarLancamento,
  useAtualizarRecorrencia,
  useCriarLancamento,
  useCriarRecorrencia,
  useEnviarAnexo,
  useExcluirLancamento,
  useExcluirRecorrencia,
  useGerarRecorrencias,
  useLancamento,
  useLancamentos,
  usePagarLancamento,
  useRecorrencia,
  useRecorrencias,
  useRemoverAnexo,
  useResumoLancamentos,
} from './hooks';
