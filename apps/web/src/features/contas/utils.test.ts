import { describe, expect, it } from 'vitest';

import { agruparPorVencimento, grupoDeVencimento } from './utils';

const HOJE = '2026-09-09';

function parcela(overrides: Partial<Parameters<typeof agruparPorVencimento>[0][number]> = {}) {
  return {
    id: overrides.id ?? 'p1',
    tituloId: 'titulo1',
    numero: 1,
    vencimento: overrides.vencimento ?? '2026-08-20',
    valor: overrides.valor ?? 1000,
    status: overrides.status ?? 'aberta',
    lancamentoId: null,
    dataPagamento: null,
    valorPago: null,
    formaPagamento: null,
    atrasada: false,
    diasAtraso: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    titulo: {
      id: 'titulo1',
      tipo: 'pagar',
      descricao: 'Conta teste',
      contato: null,
    },
    ...overrides,
  } as Parameters<typeof agruparPorVencimento>[0][number];
}

describe('grupoDeVencimento', () => {
  it('parcela paga nunca vira "vencidas", mesmo com data passada', () => {
    expect(grupoDeVencimento('2026-01-01', HOJE, 'paga')).toBe('liquidadas');
  });

  it('parcela cancelada também vira "liquidadas"', () => {
    expect(grupoDeVencimento('2026-01-01', HOJE, 'cancelada')).toBe('liquidadas');
  });

  it('parcela em aberto vencida vira "vencidas"', () => {
    expect(grupoDeVencimento('2026-01-01', HOJE, 'aberta')).toBe('vencidas');
  });

  it('sem status informado, comportamento por data continua igual (compat)', () => {
    expect(grupoDeVencimento('2026-01-01', HOJE)).toBe('vencidas');
  });
});

describe('agruparPorVencimento', () => {
  it('separa parcelas pagas/canceladas das vencidas em aberto, mesmo com a mesma data', () => {
    const parcelas = [
      parcela({ id: 'aberta-vencida', vencimento: '2026-08-01', status: 'aberta' }),
      parcela({ id: 'paga-mesma-data', vencimento: '2026-08-01', status: 'paga' }),
      parcela({ id: 'cancelada-mesma-data', vencimento: '2026-08-01', status: 'cancelada' }),
    ];
    const grupos = agruparPorVencimento(parcelas, HOJE);
    const porGrupo = Object.fromEntries(grupos.map((g) => [g.grupo, g.itens.map((i) => i.id)]));
    expect(porGrupo.vencidas).toEqual(['aberta-vencida']);
    expect(porGrupo.liquidadas).toEqual(['paga-mesma-data', 'cancelada-mesma-data']);
  });
});
