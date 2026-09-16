import { describe, expect, it } from 'vitest';

import type { NavItem } from '@/app/registry';

import { agruparNav, bottomNavSlots, itemDaRota, itensMais, itensSidebar, rotaAtiva } from './nav';

const itens: NavItem[] = [
  { id: 'relatorios', label: 'Relatórios', to: '/relatorios', ordem: 50 },
  { id: 'visao-geral', label: 'Visão geral', to: '/', ordem: 0, mobile: true },
  { id: 'lancamentos', label: 'Lançamentos', to: '/lancamentos', ordem: 10, mobile: true },
  { id: 'contatos', label: 'Contatos', to: '/contatos', ordem: 30 },
  { id: 'contas', label: 'Contas', to: '/contas/pagar', ordem: 20, mobile: true },
  { id: 'das', label: 'DAS', to: '/das', ordem: 40, mobile: true },
  {
    id: 'configuracoes',
    label: 'Configurações',
    to: '/configuracoes',
    ordem: 90,
    grupo: 'Conta',
  } as NavItem,
];

describe('navegação derivada do registry', () => {
  it('sidebar é o registry ordenado — sem item sintético', () => {
    const lista = itensSidebar(itens);
    expect(lista[0]?.to).toBe('/');
    expect(lista.map((i) => i.id)).toEqual([
      'visao-geral',
      'lancamentos',
      'contas',
      'contatos',
      'das',
      'relatorios',
      'configuracoes',
    ]);
  });

  it('sem nenhum item, a navegação fica vazia (nada de lista de reserva)', () => {
    expect(itensSidebar([])).toEqual([]);
    expect(bottomNavSlots([])).toEqual([]);
  });

  it('respeita o campo grupo quando presente', () => {
    const grupos = agruparNav(itensSidebar(itens));
    expect(grupos.map((g) => g.label)).toEqual([undefined, 'Conta']);
    expect(grupos[1]?.itens.map((i) => i.id)).toEqual(['configuracoes']);
  });

  it('barra inferior usa os itens mobile, por ordem, no máximo 4', () => {
    const slots = bottomNavSlots(itens);
    expect(slots.map((i) => i.to)).toEqual(['/', '/lancamentos', '/contas/pagar', '/das']);
  });

  it('"Mais" recebe o que não coube na barra', () => {
    expect(itensMais(itens).map((i) => i.id)).toEqual(['contatos', 'relatorios', 'configuracoes']);
  });

  it('rota ativa por prefixo de segmento', () => {
    expect(rotaAtiva('/', '/')).toBe(true);
    expect(rotaAtiva('/', '/das')).toBe(false);
    expect(rotaAtiva('/contas', '/contas/pagar')).toBe(true);
    expect(rotaAtiva('/contas', '/contasx')).toBe(false);
    expect(itemDaRota('/contatos/123', itensSidebar(itens))?.id).toBe('contatos');
    expect(itemDaRota('/nada', itensSidebar(itens))).toBeUndefined();
  });
});
