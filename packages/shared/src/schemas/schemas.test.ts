import { describe, expect, it } from 'vitest';

import {
  atualizarConfiguracoesBody,
  booleanoQuery,
  competencia,
  criarCategoriaBody,
  criarLancamentoBody,
  criarNotaFiscalBody,
  criarTituloBody,
  documentoInput,
  ehParcelasPorLista,
  fluxoCaixaQuery,
  idParam,
  isoDate,
  listarLancamentosQuery,
  listarParcelasQuery,
  mapeamentoCsv,
  paginado,
  paginationQuery,
  periodoQuery,
  previewImportacaoCampos,
  salvarDasnBody,
  telefone,
} from './index.js';

const UUID = '0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const UUID2 = '1b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function erros(resultado: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return resultado.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`) ?? [];
}

describe('common', () => {
  it('isoDate valida datas reais; competencia valida AAAA-MM', () => {
    expect(isoDate.safeParse('2026-02-28').success).toBe(true);
    expect(erros(isoDate.safeParse('2026-02-30'))).toEqual([': Data inválida']);
    expect(erros(isoDate.safeParse('28/02/2026'))).toEqual([
      ': Data deve estar no formato AAAA-MM-DD',
    ]);
    expect(competencia.safeParse('2026-12').success).toBe(true);
    expect(competencia.safeParse('2026-13').success).toBe(false);
  });

  it('paginação: defaults 1/50 e máximo 200', () => {
    expect(paginationQuery.parse({})).toEqual({ page: 1, pageSize: 50 });
    expect(paginationQuery.parse({ page: '3', pageSize: '200' })).toEqual({
      page: 3,
      pageSize: 200,
    });
    expect(erros(paginationQuery.safeParse({ pageSize: '201' }))).toEqual([
      'pageSize: Tamanho de página máximo é 200',
    ]);
    expect(paginationQuery.safeParse({ page: '0' }).success).toBe(false);
  });

  it('paginado embrulha { data, meta }', () => {
    const schema = paginado(idParam);
    expect(
      schema.parse({ data: [{ id: UUID }], meta: { page: 1, pageSize: 50, total: 1 } }).data,
    ).toHaveLength(1);
    expect(
      schema.safeParse({ data: [{ id: 'x' }], meta: { page: 1, pageSize: 50, total: 1 } }).success,
    ).toBe(false);
  });

  it('periodoQuery exige de ≤ ate', () => {
    expect(periodoQuery.safeParse({ de: '2026-01-01', ate: '2026-01-31' }).success).toBe(true);
    expect(erros(periodoQuery.safeParse({ de: '2026-02-01', ate: '2026-01-31' }))).toEqual([
      'ate: Data inicial deve ser anterior ou igual à final',
    ]);
  });

  it('booleanoQuery aceita sim/nao', () => {
    expect(booleanoQuery.parse('sim')).toBe(true);
    expect(booleanoQuery.parse('nao')).toBe(false);
    expect(booleanoQuery.parse('1')).toBe(true);
    expect(booleanoQuery.safeParse('talvez').success).toBe(false);
  });

  it('documentoInput e telefone normalizam', () => {
    expect(documentoInput.parse('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(documentoInput.parse('529.982.247-25')).toBe('52998224725');
    expect(documentoInput.safeParse('123').success).toBe(false);
    expect(telefone.parse('(11) 98765-4321')).toBe('11987654321');
    expect(telefone.safeParse('123').success).toBe(false);
  });

  it('idParam usa mensagem em pt-BR', () => {
    expect(erros(idParam.safeParse({ id: 'abc' }))).toEqual(['id: Identificador inválido']);
  });

  it('mensagens padrão do zod vêm em pt-BR', () => {
    expect(erros(idParam.safeParse({}))[0]).toMatch(/id: .*(obrigat|esperado|inválid)/i);
  });
});

describe('categorias', () => {
  it('grupo DASN só em receita', () => {
    expect(
      criarCategoriaBody.safeParse({ nome: 'Vendas', tipo: 'receita', grupoDasn: 'comercio' })
        .success,
    ).toBe(true);
    expect(
      erros(
        criarCategoriaBody.safeParse({ nome: 'Aluguel', tipo: 'despesa', grupoDasn: 'comercio' }),
      ),
    ).toEqual(['grupoDasn: Grupo da DASN só se aplica a categorias de receita']);
    expect(
      criarCategoriaBody.safeParse({ nome: 'Aluguel', tipo: 'despesa', cor: '#ABCDEF' }).data?.cor,
    ).toBe('#abcdef');
    expect(criarCategoriaBody.safeParse({ nome: '', tipo: 'despesa' }).success).toBe(false);
  });
});

describe('lancamentos', () => {
  const base = {
    tipo: 'receita',
    data: '2026-03-10',
    valor: 500000,
    descricao: 'Serviço',
    categoriaId: UUID,
  };

  it('status padrão pago; pendente não pode ter data de pagamento', () => {
    expect(criarLancamentoBody.parse(base).status).toBe('pago');
    expect(
      erros(
        criarLancamentoBody.safeParse({ ...base, status: 'pendente', dataPagamento: '2026-03-10' }),
      ),
    ).toEqual(['dataPagamento: Lançamento pendente não pode ter data de pagamento']);
  });

  it('recorrência embutida valida dia e data final', () => {
    expect(criarLancamentoBody.safeParse({ ...base, recorrencia: { diaDoMes: 10 } }).success).toBe(
      true,
    );
    expect(
      erros(criarLancamentoBody.safeParse({ ...base, recorrencia: { diaDoMes: 32 } })),
    ).toEqual(['recorrencia.diaDoMes: Dia deve ser entre 1 e 31']);
    expect(
      erros(
        criarLancamentoBody.safeParse({
          ...base,
          recorrencia: { diaDoMes: 10, dataFim: '2026-01-01' },
        }),
      ),
    ).toEqual([
      'recorrencia.dataFim: Data final da recorrência deve ser posterior à data do lançamento',
    ]);
  });

  it('valor deve ser inteiro positivo em centavos', () => {
    expect(erros(criarLancamentoBody.safeParse({ ...base, valor: 10.5 }))).toEqual([
      'valor: Valor deve ser um inteiro em centavos',
    ]);
    expect(erros(criarLancamentoBody.safeParse({ ...base, valor: 0 }))).toEqual([
      'valor: Valor deve ser maior que zero',
    ]);
  });

  it('filtros de lista: defaults e período', () => {
    const q = listarLancamentosQuery.parse({ tipo: 'despesa', de: '2026-01-01' });
    expect(q).toMatchObject({
      page: 1,
      pageSize: 50,
      ordenarPor: 'data',
      ordem: 'desc',
      tipo: 'despesa',
    });
    expect(listarLancamentosQuery.safeParse({ de: '2026-02-01', ate: '2026-01-01' }).success).toBe(
      false,
    );
  });
});

describe('titulos', () => {
  const base = { tipo: 'receber', descricao: 'Projeto', categoriaId: UUID, valorTotal: 10000 };

  it('parcelas por quantidade', () => {
    const t = criarTituloBody.parse({
      ...base,
      parcelas: { quantidade: 3, primeiroVencimento: '2026-04-10' },
    });
    expect(ehParcelasPorLista(t.parcelas)).toBe(false);
  });

  it('parcelas por lista: soma deve bater com o total e vencimentos em ordem', () => {
    const ok = criarTituloBody.safeParse({
      ...base,
      parcelas: {
        lista: [
          { vencimento: '2026-04-10', valor: 5000 },
          { vencimento: '2026-05-10', valor: 5000 },
        ],
      },
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ehParcelasPorLista(ok.data.parcelas)).toBe(true);

    expect(
      erros(
        criarTituloBody.safeParse({
          ...base,
          parcelas: {
            lista: [
              { vencimento: '2026-04-10', valor: 5000 },
              { vencimento: '2026-05-10', valor: 4999 },
            ],
          },
        }),
      ),
    ).toEqual(['parcelas.lista: A soma das parcelas deve ser igual ao valor total']);

    expect(
      erros(
        criarTituloBody.safeParse({
          ...base,
          parcelas: {
            lista: [
              { vencimento: '2026-05-10', valor: 5000 },
              { vencimento: '2026-04-10', valor: 5000 },
            ],
          },
        }),
      ),
    ).toEqual(['parcelas.lista.1.vencimento: Vencimentos devem estar em ordem crescente']);
  });

  it('rejeita formato desconhecido de parcelas', () => {
    expect(criarTituloBody.safeParse({ ...base, parcelas: { quantidade: 3 } }).success).toBe(false);
    expect(criarTituloBody.safeParse({ ...base, parcelas: { lista: [] } }).success).toBe(false);
  });

  it('listarParcelasQuery: atrasadas como booleano e defaults', () => {
    expect(listarParcelasQuery.parse({ atrasadas: 'true', tipo: 'pagar' })).toMatchObject({
      atrasadas: true,
      ordenarPor: 'vencimento',
      ordem: 'asc',
    });
    expect(
      listarParcelasQuery.safeParse({ vencimentoDe: '2026-02-01', vencimentoAte: '2026-01-01' })
        .success,
    ).toBe(false);
  });
});

describe('notas fiscais', () => {
  const base = { tipo: 'nfse', numero: '123', dataEmissao: '2026-03-10', valor: 100000 };
  it('gerarReceita exige categoria e não combina com vínculo', () => {
    expect(criarNotaFiscalBody.parse(base).gerarReceita).toBe(false);
    expect(erros(criarNotaFiscalBody.safeParse({ ...base, gerarReceita: true }))).toEqual([
      'categoriaId: Informe a categoria da receita a ser gerada',
    ]);
    expect(
      erros(
        criarNotaFiscalBody.safeParse({
          ...base,
          gerarReceita: true,
          categoriaId: UUID,
          lancamentoId: UUID2,
        }),
      ),
    ).toEqual([
      'lancamentoId: Não é possível gerar receita e vincular um lançamento ao mesmo tempo',
    ]);
  });
});

describe('obrigações', () => {
  it('salvarDasnBody exige data quando entregue', () => {
    expect(erros(salvarDasnBody.safeParse({ status: 'entregue' }))).toEqual([
      'dataEntrega: Informe a data de entrega',
    ]);
    expect(salvarDasnBody.safeParse({ status: 'pendente' }).success).toBe(true);
  });
});

describe('dashboard', () => {
  it('fluxoCaixaQuery mantém o refine do período e aplica defaults', () => {
    expect(fluxoCaixaQuery.parse({ de: '2026-01-01', ate: '2026-03-31' })).toEqual({
      de: '2026-01-01',
      ate: '2026-03-31',
      agrupamento: 'mes',
      incluirPrevisao: true,
    });
    expect(fluxoCaixaQuery.safeParse({ de: '2026-04-01', ate: '2026-03-31' }).success).toBe(false);
  });
});

describe('importações', () => {
  it('mapeamento valida o modo do tipo', () => {
    expect(
      mapeamentoCsv.parse({ data: 'Data', valor: 'Valor', descricao: 'Histórico' }),
    ).toMatchObject({
      modoTipo: 'sinal',
      statusPadrao: 'pago',
      inverterSinal: false,
    });
    expect(
      erros(
        mapeamentoCsv.safeParse({
          data: 'Data',
          valor: 'Valor',
          descricao: 'H',
          modoTipo: 'coluna',
        }),
      ),
    ).toEqual(['tipo: Informe a coluna do tipo']);
    expect(
      erros(
        mapeamentoCsv.safeParse({ data: 'Data', valor: 'Valor', descricao: 'H', modoTipo: 'fixo' }),
      ),
    ).toEqual(['tipoFixo: Informe o tipo fixo']);
  });

  it('previewImportacaoCampos faz o parse do JSON do multipart', () => {
    const r = previewImportacaoCampos.parse({
      mapeamento: JSON.stringify({ data: 'Data', valor: 'Valor', descricao: 'Histórico' }),
    });
    expect(r.mapeamento.data).toBe('Data');
    expect(erros(previewImportacaoCampos.safeParse({ mapeamento: '{nope' }))).toEqual([
      'mapeamento: Mapeamento deve ser um JSON válido',
    ]);
    expect(previewImportacaoCampos.safeParse({ mapeamento: '{}' }).success).toBe(false);
  });
});

describe('configurações', () => {
  it('caminhoneiro precisa informar tributos; outras atividades não podem', () => {
    expect(
      erros(
        atualizarConfiguracoesBody.safeParse({
          mei: { atividade: 'caminhoneiro', caminhoneiroTributos: null },
        }),
      ),
    ).toEqual([
      'mei.caminhoneiroTributos: Informe quais tributos o caminhoneiro recolhe (ICMS, ISS ou ambos)',
    ]);
    expect(
      erros(
        atualizarConfiguracoesBody.safeParse({
          mei: { atividade: 'servicos', caminhoneiroTributos: 'icms' },
        }),
      ),
    ).toEqual([
      'mei.caminhoneiroTributos: Tributos do caminhoneiro só se aplicam à atividade de transporte',
    ]);
    expect(
      atualizarConfiguracoesBody.safeParse({ diasAlertaDas: 10, preferencias: { tema: 'escuro' } })
        .success,
    ).toBe(true);
    expect(atualizarConfiguracoesBody.safeParse({}).success).toBe(true);
  });
});
