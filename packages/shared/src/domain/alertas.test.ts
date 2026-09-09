import { describe, expect, it } from 'vitest';

import { type ContextoAlertas, contarAlertas, gerarAlertas } from './alertas.js';
import type { SituacaoLimite } from './limite.js';

const HOJE = '2026-09-09';

function ctx(parcial: Partial<ContextoAlertas> = {}): ContextoAlertas {
  return {
    hoje: HOJE,
    diasAlertaDas: 7,
    diasAlertaVencimento: 7,
    das: [],
    limite: null,
    dasn: [],
    parcelas: {},
    parametrosDesatualizados: [],
    dataAberturaAusente: false,
    receitaSemGrupoDasn: false,
    dispensados: [],
    ...parcial,
  };
}

function limite(parcial: Partial<SituacaoLimite> = {}): SituacaoLimite {
  return {
    ano: 2026,
    anoAbertura: false,
    mesInicio: 1,
    mesesConsiderados: 12,
    limite: 8_100_000,
    tolerancia: 9_720_000,
    acumulado: 0,
    restante: 8_100_000,
    percentual: 0,
    nivel: 'ok',
    excesso: null,
    valorExcedido: 0,
    diasDecorridos: 252,
    diasTotais: 365,
    mediaMensal: 0,
    projecao: 0,
    projecaoPercentual: 0,
    projecaoExcede: false,
    consequencia: null,
    ...parcial,
  };
}

const chaves = (c: ContextoAlertas) => gerarAlertas(c).map((a) => a.chave);

describe('gerarAlertas — DAS', () => {
  it('atrasado é crítico e não dispensável; pendente dentro da janela avisa', () => {
    const alertas = gerarAlertas(
      ctx({
        das: [
          { competencia: '2026-07', vencimento: '2026-08-20', status: 'atrasado', valor: 8605 },
          { competencia: '2026-08', vencimento: '2026-09-21', status: 'pendente', valor: 8605 }, // 12 dias
          { competencia: '2026-09', vencimento: '2026-10-20', status: 'pendente', valor: 8605 },
          { competencia: '2026-06', vencimento: '2026-07-20', status: 'pago', valor: 8605 },
          { competencia: '2026-10', vencimento: '2026-11-23', status: 'futuro', valor: 8605 },
        ],
        diasAlertaDas: 15,
      }),
    );
    expect(alertas.map((a) => a.chave)).toEqual(['das:2026-07:atrasado', 'das:2026-08:vence_em']);
    expect(alertas[0]).toMatchObject({
      severidade: 'critico',
      dispensavel: false,
      referencia: { tipo: 'das', competencia: '2026-07', ano: null },
      acao: { url: '/das' },
    });
    expect(alertas[0]?.mensagem).toContain('20 dias de atraso');
    expect(alertas[0]?.mensagem).toContain('R$ 86,05');
    expect(alertas[1]).toMatchObject({ severidade: 'info', dispensavel: true });
    expect(alertas[1]?.titulo).toContain('vence em 12 dias');
  });

  it('vence hoje / em 1 dia vira aviso; fora da janela não alerta', () => {
    const hoje = gerarAlertas(
      ctx({ das: [{ competencia: '2026-08', vencimento: HOJE, status: 'pendente', valor: 100 }] }),
    );
    expect(hoje[0]?.titulo).toContain('vence hoje');
    expect(hoje[0]?.severidade).toBe('aviso');

    const amanha = gerarAlertas(
      ctx({
        das: [{ competencia: '2026-08', vencimento: '2026-09-10', status: 'pendente', valor: 100 }],
      }),
    );
    expect(amanha[0]?.titulo).toContain('vence em 1 dia');

    expect(
      chaves(
        ctx({
          das: [{ competencia: '2026-08', vencimento: '2026-09-21', status: 'pendente', valor: 1 }],
        }),
      ),
    ).toEqual([]);
  });
});

describe('gerarAlertas — limite', () => {
  it.each([
    ['ok', null, false, []],
    ['atencao', null, false, ['limite:2026:70']],
    ['alerta', null, false, ['limite:2026:85']],
    ['estourado', null, true, ['limite:2026:100']],
    ['estourado', 'ate_20', true, ['limite:2026:excesso_ate_20']],
    ['estourado', 'acima_20', true, ['limite:2026:excesso_acima_20']],
    ['atencao', null, true, ['limite:2026:projecao', 'limite:2026:70']], // aviso antes de info
  ] as const)('nível %s / excesso %s / projeção %s', (nivel, excesso, projecaoExcede, esperado) => {
    const alertas = gerarAlertas(
      ctx({
        limite: limite({
          nivel,
          excesso,
          projecaoExcede,
          percentual: 75.5,
          acumulado: 6_115_500,
          restante: 1_984_500,
          projecao: 8_500_000,
          projecaoPercentual: 104.9,
          consequencia: excesso ? 'Consequência.' : null,
        }),
      }),
    );
    expect(alertas.map((a) => a.chave)).toEqual(esperado);
    for (const a of alertas) {
      expect(a.referencia).toEqual({ tipo: 'limite', competencia: null, ano: 2026 });
      expect(a.mensagem).toContain('R$');
    }
  });

  it('excesso é crítico e não dispensável; 85 é aviso; 70 é info', () => {
    const [ex] = gerarAlertas(ctx({ limite: limite({ nivel: 'estourado', excesso: 'ate_20' }) }));
    expect(ex).toMatchObject({ severidade: 'critico', dispensavel: false });
    const [a85] = gerarAlertas(ctx({ limite: limite({ nivel: 'alerta' }) }));
    expect(a85?.severidade).toBe('aviso');
    const [a70] = gerarAlertas(ctx({ limite: limite({ nivel: 'atencao' }) }));
    expect(a70?.severidade).toBe('info');
  });

  it('projeção sem valor não alerta', () => {
    expect(chaves(ctx({ limite: limite({ projecaoExcede: true, projecao: null }) }))).toEqual([]);
  });
});

describe('gerarAlertas — DASN', () => {
  it('atrasada, dentro do prazo (aviso ≤ 30 dias, senão info), ignorando entregues e janela fechada', () => {
    const alertas = gerarAlertas(
      ctx({
        dasn: [
          { anoBase: 2024, prazo: '2025-05-31', status: 'pendente', janelaAberta: true },
          { anoBase: 2025, prazo: '2026-09-30', status: 'pendente', janelaAberta: true }, // 21 dias
          { anoBase: 2023, prazo: '2024-05-31', status: 'entregue', janelaAberta: true },
          { anoBase: 2026, prazo: '2027-05-31', status: 'pendente', janelaAberta: false },
        ],
      }),
    );
    expect(alertas.map((a) => [a.chave, a.severidade])).toEqual([
      ['dasn:2024:atrasada', 'critico'],
      ['dasn:2025:prazo', 'aviso'],
    ]);
    expect(alertas[0]?.dispensavel).toBe(false);
    expect(alertas[1]?.mensagem).toContain('21 dias');

    const longe = gerarAlertas(
      ctx({
        dasn: [{ anoBase: 2025, prazo: '2026-12-31', status: 'pendente', janelaAberta: true }],
      }),
    );
    expect(longe[0]?.severidade).toBe('info');
  });
});

describe('gerarAlertas — parcelas', () => {
  it('atrasadas (pagar crítico, receber aviso) e próximas (info)', () => {
    const alertas = gerarAlertas(
      ctx({
        parcelas: {
          pagar: {
            atrasadas: { quantidade: 2, valor: 15_000 },
            proximas: { quantidade: 1, valor: 5000 },
          },
          receber: {
            atrasadas: { quantidade: 1, valor: 9000 },
            proximas: { quantidade: 0, valor: 0 },
          },
        },
      }),
    );
    expect(alertas.map((a) => [a.chave, a.severidade])).toEqual([
      ['parcelas:pagar:atrasadas', 'critico'],
      ['parcelas:receber:atrasadas', 'aviso'],
      ['parcelas:pagar:proximas', 'info'],
    ]);
    expect(alertas[0]?.titulo).toBe('2 contas a pagar em atraso');
    expect(alertas[1]?.titulo).toBe('1 conta a receber em atraso');
    expect(alertas[2]?.titulo).toBe('1 conta a pagar nos próximos 7 dias');
    expect(alertas[0]?.acao).toEqual({ rotulo: 'Ver contas a pagar', url: '/contas/pagar' });
  });

  it('sem parcelas não alerta', () => {
    expect(
      chaves(
        ctx({
          parcelas: {
            pagar: {
              atrasadas: { quantidade: 0, valor: 0 },
              proximas: { quantidade: 0, valor: 0 },
            },
          },
        }),
      ),
    ).toEqual([]);
  });
});

describe('gerarAlertas — cadastro e parâmetros', () => {
  it('gera as chaves estáveis', () => {
    expect(
      chaves(
        ctx({
          parametrosDesatualizados: [2027, 2028],
          dataAberturaAusente: true,
          receitaSemGrupoDasn: true,
        }),
      ),
    ).toEqual([
      'cadastro:data_abertura_ausente',
      'dasn:categoria_sem_grupo',
      'parametros:2027:desatualizados',
      'parametros:2028:desatualizados',
    ]);
  });
});

describe('gerarAlertas — dispensa, ordenação e contagem', () => {
  it('remove dispensados e ordena por severidade depois chave', () => {
    const c = ctx({
      das: [{ competencia: '2026-07', vencimento: '2026-08-20', status: 'atrasado', valor: 1 }],
      limite: limite({ nivel: 'atencao' }),
      dataAberturaAusente: true,
      dispensados: ['limite:2026:70'],
    });
    const alertas = gerarAlertas(c);
    expect(alertas.map((a) => a.chave)).toEqual([
      'das:2026-07:atrasado',
      'cadastro:data_abertura_ausente',
    ]);
    expect(contarAlertas(alertas)).toEqual({ critico: 1, aviso: 1, info: 0 });
  });

  it('contexto vazio não gera alertas', () => {
    expect(gerarAlertas(ctx())).toEqual([]);
    expect(contarAlertas([])).toEqual({ critico: 0, aviso: 0, info: 0 });
  });
});
