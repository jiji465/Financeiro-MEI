import { describe, expect, it } from 'vitest';

import type { NavItem } from '@/app/registry';

import { agruparNav, bottomNavSlots, itemDaRota, itensMais, itensSidebar, rotaAtiva } from './nav';

const itens: NavItem[] = [
  { id: 'relatorios', label: 'Relatórios', to: '/relatorios', ordem: 50 },
  { id: 'lancamentos', label: 'Lançamentos', to: '/lancamentos', ordem: 10, mobile: true },
  { id: 'contatos', label: 'Contatos', to: '/contatos', ordem: 30 },
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
  it('sidebar ganha "Início" quando nenhuma feature registra "/"', () => {
    const lista = itensSidebar(itens);
    expect(lista[0]?.to).toBe('/');
    expect(lista.map((i) => i.id)).toEqual([
      'inicio',
      'lancamentos',
      'contatos',
      'das',
      'relatorios',
      'configuracoes',
    ]);
  });

  it('respeita o campo grupo quando presente', () => {
    const grupos = agruparNav(itensSidebar(itens));
    expect(grupos.map((g) => g.label)).toEqual([undefined, 'Conta']);
    expect(grupos[1]?.itens.map((i) => i.id)).toEqual(['configuracoes']);
  });

  it('barra inferior usa itens mobile e completa com o padrão até 4', () => {
    const slots = bottomNavSlots(itens);
    expect(slots.map((i) => i.to)).toEqual(['/', '/lancamentos', '/contas/pagar', '/das']);
    expect(bottomNavSlots([]).map((i) => i.label)).toEqual([
      'Início',
      'Lançamentos',
      'Contas',
      'DAS',
    ]);
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
