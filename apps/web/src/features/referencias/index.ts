// Feature "referencias": só hooks compartilhados (useCategorias, useContatosOpcoes,
// useDasParametros, useMei). Não registra rotas nem navegação.
import type { AppModule } from '@/app/registry';

export const referenciasModule: AppModule = { id: 'referencias', routes: [], nav: [] };

export {
  categoriasParaOpcoes,
  contasBancariasParaOpcoes,
  contatosParaOpcoes,
  produtosServicosParaOpcoes,
  useCategorias,
  useContaBancariaPadrao,
  useContasBancariasOpcoes,
  useContatosOpcoes,
  useDasParametros,
  useMei,
  useProdutosServicosOpcoes,
} from './hooks';
export { referenciasKeys } from './keys';
export type {
  CategoriaRef,
  ContaBancariaRef,
  ContatoRef,
  DasParametros,
  ProdutoServicoRef,
} from './api';
