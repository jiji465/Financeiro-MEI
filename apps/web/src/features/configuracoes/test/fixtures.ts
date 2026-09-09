// Fábricas de DTOs para testes de configurações (categorias e configurações do MEI).
import type { CategoriaDto } from '@meifin/shared';

export { criarConfiguracoes } from '@/features/das/test/fixtures';

let seq = 0;

export function criarCategoria(sobrescrever: Partial<CategoriaDto> = {}): CategoriaDto {
  seq += 1;
  return {
    id: `cat-${String(seq).padStart(4, '0')}`,
    nome: 'Vendas',
    tipo: 'receita',
    grupoDasn: 'servicos',
    cor: '#16a34a',
    icone: null,
    padrao: false,
    sistema: false,
    ativo: true,
    ordem: 0,
    createdAt: '2024-03-15T10:00:00.000Z',
    updatedAt: '2024-03-15T10:00:00.000Z',
    ...sobrescrever,
  };
}
