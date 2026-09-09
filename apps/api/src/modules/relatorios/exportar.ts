// Exportadores CSV/PDF dos relatórios. Cada função recebe o DTO JSON já calculado pelo service
// e devolve { buffer, nome, contentType } para a rota enviar com Content-Disposition.
import {
  COLUNAS_CSV_LANCAMENTOS,
  type ColunaCsv,
  type ContasRelatorioDto,
  type DasnRelatorioDto,
  type DreRelatorioDto,
  type ExtratoDto,
  formatData,
  formatMesAno,
  LABEL_FORMA_PAGAMENTO,
  LABEL_GRUPO_DASN,
  LABEL_NIVEL_LIMITE,
  LABEL_ORIGEM_LANCAMENTO,
  LABEL_REGIME_APURACAO,
  LABEL_STATUS_DASN,
  LABEL_STATUS_LANCAMENTO,
  LABEL_STATUS_PARCELA,
  LABEL_TIPO_LANCAMENTO,
  LABEL_TIPO_TITULO,
  type LimiteRelatorioDto,
  type LinhaDreDto,
  TITULOS_CSV_LANCAMENTOS,
} from '@meifin/shared';

import { bufferCsv, CSV_CONTENT_TYPE, nomeArquivo } from '../../lib/csv.js';
import {
  type ColunaPdf,
  type EmissorPdf,
  formatarBrlPdf,
  gerarPdf,
  paragrafoPdf,
  paresPdf,
  PDF_CONTENT_TYPE,
  type PdfDoc,
  secaoPdf,
  tabelaPdf,
} from '../../lib/pdf.js';
import type { LinhaLancamentoRelatorio } from './service.js';

export interface ArquivoGerado {
  buffer: Buffer;
  nome: string;
  contentType: string;
}

export type Formato = 'csv' | 'pdf';

function periodoTexto(p: { de: string; ate: string }): string {
  return `${formatData(p.de)} a ${formatData(p.ate)}`;
}

function pct(v: number | null): string {
  return v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function csv<T>(
  linhas: readonly T[],
  colunas: readonly ColunaCsv<T>[],
  nome: string,
): ArquivoGerado {
  return {
    buffer: bufferCsv(linhas, colunas),
    nome: nomeArquivo(nome, 'csv'),
    contentType: CSV_CONTENT_TYPE,
  };
}

async function pdf(
  nome: string,
  opcoes: {
    titulo: string;
    subtitulo?: string;
    emissor: EmissorPdf;
    periodo?: string;
    orientacao?: 'portrait' | 'landscape';
  },
  desenhar: (doc: PdfDoc) => void,
): Promise<ArquivoGerado> {
  const buffer = await gerarPdf(opcoes, desenhar);
  return { buffer, nome: nomeArquivo(nome, 'pdf'), contentType: PDF_CONTENT_TYPE };
}

// ---------------------------------------------------------------------------
// DRE
// ---------------------------------------------------------------------------

interface LinhaCsvDre {
  grupo: string;
  categoria: string;
  grupoDasn: string;
  valor: number;
  percentual: number;
  quantidade: number;
}

function linhasCsvDre(d: DreRelatorioDto): LinhaCsvDre[] {
  const mapear = (grupo: string, itens: LinhaDreDto[]) =>
    itens.map((i) => ({
      grupo,
      categoria: i.nome,
      grupoDasn: i.grupoDasn ? LABEL_GRUPO_DASN[i.grupoDasn] : '',
      valor: i.valor,
      percentual: i.percentual,
      quantidade: i.quantidade,
    }));
  return [
    ...mapear('Receitas', d.receitas.itens),
    {
      grupo: 'Receitas',
      categoria: 'Total de receitas',
      grupoDasn: '',
      valor: d.receitas.total,
      percentual: 100,
      quantidade: d.receitas.itens.reduce((s, i) => s + i.quantidade, 0),
    },
    ...mapear('Despesas', d.despesas.itens),
    {
      grupo: 'Despesas',
      categoria: 'Total de despesas',
      grupoDasn: '',
      valor: d.despesas.total,
      percentual: 100,
      quantidade: d.despesas.itens.reduce((s, i) => s + i.quantidade, 0),
    },
    {
      grupo: 'Resultado',
      categoria: 'Impostos (DAS)',
      grupoDasn: '',
      valor: d.impostos,
      percentual: 0,
      quantidade: 0,
    },
    {
      grupo: 'Resultado',
      categoria: 'Resultado do período',
      grupoDasn: '',
      valor: d.resultado,
      percentual: d.margem ?? 0,
      quantidade: 0,
    },
  ];
}

export function dreCsv(d: DreRelatorioDto): ArquivoGerado {
  return csv(
    linhasCsvDre(d),
    [
      { titulo: 'Grupo', valor: 'grupo' },
      { titulo: 'Categoria', valor: 'categoria' },
      { titulo: 'Grupo DASN', valor: 'grupoDasn' },
      { titulo: 'Valor', valor: 'valor', tipo: 'centavos' },
      {
        titulo: '% do grupo',
        valor: (l) => l.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
      },
      { titulo: 'Quantidade', valor: 'quantidade', tipo: 'inteiro' },
    ],
    `DRE ${d.periodo.de} a ${d.periodo.ate}`,
  );
}

const COLUNAS_PDF_DRE: ColunaPdf<LinhaDreDto>[] = [
  { titulo: 'Categoria', valor: (l) => l.nome, peso: 3 },
  {
    titulo: 'Grupo DASN',
    valor: (l) => (l.grupoDasn ? LABEL_GRUPO_DASN[l.grupoDasn] : ''),
    peso: 1.4,
  },
  { titulo: 'Qtd.', valor: (l) => String(l.quantidade), peso: 0.6, alinhar: 'right' },
  { titulo: '%', valor: (l) => pct(l.percentual), peso: 0.8, alinhar: 'right' },
  { titulo: 'Valor', valor: (l) => formatarBrlPdf(l.valor), peso: 1.4, alinhar: 'right' },
];

export function drePdf(d: DreRelatorioDto, emissor: EmissorPdf): Promise<ArquivoGerado> {
  return pdf(
    `DRE ${d.periodo.de} a ${d.periodo.ate}`,
    {
      titulo: 'DRE simplificada',
      subtitulo: `Regime: ${LABEL_REGIME_APURACAO[d.regime]}`,
      emissor,
      periodo: periodoTexto(d.periodo),
    },
    (doc) => {
      secaoPdf(doc, 'Receitas');
      tabelaPdf(doc, d.receitas.itens, COLUNAS_PDF_DRE, {
        totais: ['Total de receitas', '', '', '', formatarBrlPdf(d.receitas.total)],
      });
      secaoPdf(doc, 'Despesas');
      tabelaPdf(doc, d.despesas.itens, COLUNAS_PDF_DRE, {
        totais: ['Total de despesas', '', '', '', formatarBrlPdf(d.despesas.total)],
      });
      secaoPdf(doc, 'Resultado');
      paresPdf(doc, [
        { rotulo: 'Receitas', valor: formatarBrlPdf(d.receitas.total) },
        { rotulo: 'Despesas', valor: formatarBrlPdf(d.despesas.total) },
        { rotulo: 'Impostos (DAS), já incluídos nas despesas', valor: formatarBrlPdf(d.impostos) },
        { rotulo: 'Resultado do período', valor: formatarBrlPdf(d.resultado), destaque: true },
        { rotulo: 'Margem', valor: pct(d.margem), destaque: true },
      ]);
      paragrafoPdf(
        doc,
        'DRE simplificada para controle gerencial do MEI. Não substitui a escrituração contábil nem a DASN-SIMEI.',
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Extrato
// ---------------------------------------------------------------------------

type LinhaExtrato = ExtratoDto['linhas'][number];

export function extratoCsv(e: ExtratoDto): ArquivoGerado {
  const linhas: (LinhaExtrato & { entrada: number | null; saida: number | null })[] = e.linhas.map(
    (l) => ({
      ...l,
      entrada: l.tipo === 'receita' ? l.valor : null,
      saida: l.tipo === 'despesa' ? l.valor : null,
    }),
  );
  return csv(
    linhas,
    [
      { titulo: 'Data', valor: 'data', tipo: 'data' },
      { titulo: 'Descrição', valor: 'descricao' },
      { titulo: 'Categoria', valor: (l) => l.categoria ?? '' },
      { titulo: 'Cliente/Fornecedor', valor: (l) => l.contato ?? '' },
      {
        titulo: 'Forma de pagamento',
        valor: (l) => (l.formaPagamento ? LABEL_FORMA_PAGAMENTO[l.formaPagamento] : ''),
      },
      { titulo: 'Status', valor: (l) => LABEL_STATUS_LANCAMENTO[l.status] },
      { titulo: 'Origem', valor: (l) => LABEL_ORIGEM_LANCAMENTO[l.origem] },
      { titulo: 'Entrada', valor: 'entrada', tipo: 'centavos' },
      { titulo: 'Saída', valor: 'saida', tipo: 'centavos' },
      { titulo: 'Saldo', valor: 'saldo', tipo: 'centavos' },
    ],
    `Extrato ${e.periodo.de} a ${e.periodo.ate}`,
  );
}

export function extratoPdf(e: ExtratoDto, emissor: EmissorPdf): Promise<ArquivoGerado> {
  const colunas: ColunaPdf<LinhaExtrato>[] = [
    { titulo: 'Data', valor: (l) => formatData(l.data), peso: 1 },
    { titulo: 'Descrição', valor: (l) => l.descricao, peso: 3.2 },
    { titulo: 'Categoria', valor: (l) => l.categoria ?? '', peso: 1.8 },
    { titulo: 'Contato', valor: (l) => l.contato ?? '', peso: 1.6 },
    {
      titulo: 'Entrada',
      valor: (l) => (l.tipo === 'receita' ? formatarBrlPdf(l.valor) : ''),
      peso: 1.3,
      alinhar: 'right',
    },
    {
      titulo: 'Saída',
      valor: (l) => (l.tipo === 'despesa' ? formatarBrlPdf(l.valor) : ''),
      peso: 1.3,
      alinhar: 'right',
    },
    { titulo: 'Saldo', valor: (l) => formatarBrlPdf(l.saldo), peso: 1.4, alinhar: 'right' },
  ];
  return pdf(
    `Extrato ${e.periodo.de} a ${e.periodo.ate}`,
    {
      titulo: 'Extrato de lançamentos',
      emissor,
      periodo: periodoTexto(e.periodo),
      orientacao: 'landscape',
    },
    (doc) => {
      paresPdf(doc, [{ rotulo: 'Saldo inicial', valor: formatarBrlPdf(e.saldoInicial) }]);
      tabelaPdf(doc, e.linhas, colunas, {
        totais: [
          'Totais',
          '',
          '',
          '',
          formatarBrlPdf(e.totais.receitas),
          formatarBrlPdf(e.totais.despesas),
          formatarBrlPdf(e.totais.saldoFinal),
        ],
      });
      paresPdf(doc, [
        { rotulo: 'Total de entradas', valor: formatarBrlPdf(e.totais.receitas) },
        { rotulo: 'Total de saídas', valor: formatarBrlPdf(e.totais.despesas) },
        { rotulo: 'Saldo final', valor: formatarBrlPdf(e.totais.saldoFinal), destaque: true },
      ]);
    },
  );
}

// ---------------------------------------------------------------------------
// DASN
// ---------------------------------------------------------------------------

type LinhaDasnMes = DasnRelatorioDto['porMes'][number];

export function dasnCsv(d: DasnRelatorioDto): ArquivoGerado {
  const linhas: LinhaDasnMes[] = [
    ...d.porMes,
    {
      competencia: 'Total',
      comercio: d.receitaComercio,
      servicos: d.receitaServicos,
      semGrupo: d.receitaSemGrupo,
      total: d.faturamentoApurado,
      dasPago: d.dasPendentes.length === 0,
    },
  ];
  return csv(
    linhas,
    [
      {
        titulo: 'Competência',
        valor: (l) => (l.competencia === 'Total' ? 'Total' : formatMesAno(l.competencia, true)),
      },
      { titulo: 'Comércio/indústria', valor: 'comercio', tipo: 'centavos' },
      { titulo: 'Serviços', valor: 'servicos', tipo: 'centavos' },
      { titulo: 'Sem grupo', valor: 'semGrupo', tipo: 'centavos' },
      { titulo: 'Total', valor: 'total', tipo: 'centavos' },
      { titulo: 'DAS pago', valor: 'dasPago', tipo: 'booleano' },
    ],
    `Relatorio DASN ${d.anoBase}`,
  );
}

export function dasnPdf(d: DasnRelatorioDto, emissor: EmissorPdf): Promise<ArquivoGerado> {
  const colunas: ColunaPdf<LinhaDasnMes>[] = [
    { titulo: 'Competência', valor: (l) => formatMesAno(l.competencia, true), peso: 1.2 },
    {
      titulo: 'Comércio/indústria',
      valor: (l) => formatarBrlPdf(l.comercio),
      peso: 1.4,
      alinhar: 'right',
    },
    { titulo: 'Serviços', valor: (l) => formatarBrlPdf(l.servicos), peso: 1.4, alinhar: 'right' },
    { titulo: 'Sem grupo', valor: (l) => formatarBrlPdf(l.semGrupo), peso: 1.2, alinhar: 'right' },
    { titulo: 'Total', valor: (l) => formatarBrlPdf(l.total), peso: 1.4, alinhar: 'right' },
    {
      titulo: 'DAS',
      valor: (l) => (l.dasPago ? 'Pago' : 'Pendente'),
      peso: 0.9,
      alinhar: 'center',
    },
  ];
  return pdf(
    `Relatorio DASN ${d.anoBase}`,
    {
      titulo: `Relatório para a DASN-SIMEI — ano-base ${d.anoBase}`,
      emissor,
      periodo: `01/01/${d.anoBase} a 31/12/${d.anoBase}`,
    },
    (doc) => {
      paresPdf(doc, [
        { rotulo: 'Receita de comércio/indústria', valor: formatarBrlPdf(d.receitaComercio) },
        { rotulo: 'Receita de serviços', valor: formatarBrlPdf(d.receitaServicos) },
        { rotulo: 'Receita sem grupo (classificar)', valor: formatarBrlPdf(d.receitaSemGrupo) },
        {
          rotulo: 'Faturamento apurado',
          valor: formatarBrlPdf(d.faturamentoApurado),
          destaque: true,
        },
        { rotulo: 'Situação da declaração', valor: LABEL_STATUS_DASN[d.status] },
        { rotulo: 'Prazo de entrega', valor: formatData(d.prazo) },
        { rotulo: 'Percentual do limite anual', valor: pct(d.percentualLimite) },
      ]);
      secaoPdf(doc, 'Faturamento por mês');
      tabelaPdf(doc, d.porMes, colunas, {
        totais: [
          'Total',
          formatarBrlPdf(d.receitaComercio),
          formatarBrlPdf(d.receitaServicos),
          formatarBrlPdf(d.receitaSemGrupo),
          formatarBrlPdf(d.faturamentoApurado),
          '',
        ],
      });
      if (d.dasPendentes.length > 0) {
        paragrafoPdf(
          doc,
          `DAS pendentes no ano-base: ${d.dasPendentes.map((c) => formatMesAno(c, true)).join(', ')}.`,
        );
      }
      if (d.alertaSemGrupo) {
        paragrafoPdf(
          doc,
          'Há receitas em categorias sem grupo DASN. Classifique-as como comércio ou serviços antes de declarar.',
        );
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Limite anual
// ---------------------------------------------------------------------------

type LinhaLimiteMes = LimiteRelatorioDto['porMes'][number];

export function limiteCsv(l: LimiteRelatorioDto): ArquivoGerado {
  return csv(
    l.porMes,
    [
      { titulo: 'Competência', valor: (m) => formatMesAno(m.competencia, true) },
      { titulo: 'Faturamento', valor: 'valor', tipo: 'centavos' },
      { titulo: 'Acumulado', valor: 'acumulado', tipo: 'centavos' },
      {
        titulo: '% do limite',
        valor: (m) => m.percentualAcumulado.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
      },
    ],
    `Limite anual ${l.ano}`,
  );
}

export function limitePdf(l: LimiteRelatorioDto, emissor: EmissorPdf): Promise<ArquivoGerado> {
  const colunas: ColunaPdf<LinhaLimiteMes>[] = [
    { titulo: 'Competência', valor: (m) => formatMesAno(m.competencia, true), peso: 1.2 },
    { titulo: 'Faturamento', valor: (m) => formatarBrlPdf(m.valor), peso: 1.4, alinhar: 'right' },
    { titulo: 'Acumulado', valor: (m) => formatarBrlPdf(m.acumulado), peso: 1.4, alinhar: 'right' },
    { titulo: '% do limite', valor: (m) => pct(m.percentualAcumulado), peso: 1, alinhar: 'right' },
  ];
  return pdf(
    `Limite anual ${l.ano}`,
    {
      titulo: `Limite anual de faturamento — ${l.ano}`,
      subtitulo: `Regime: ${LABEL_REGIME_APURACAO[l.regime]}`,
      emissor,
    },
    (doc) => {
      paresPdf(doc, [
        {
          rotulo: l.anoAbertura
            ? `Limite proporcional (${l.mesesConsiderados} meses)`
            : 'Limite anual',
          valor: formatarBrlPdf(l.limite),
        },
        { rotulo: 'Faturamento acumulado', valor: formatarBrlPdf(l.acumulado), destaque: true },
        { rotulo: 'Percentual do limite', valor: pct(l.percentual), destaque: true },
        { rotulo: 'Situação', valor: LABEL_NIVEL_LIMITE[l.nivel] },
        { rotulo: 'Restante', valor: formatarBrlPdf(l.restante) },
        { rotulo: 'Média mensal', valor: formatarBrlPdf(l.mediaMensal) },
        {
          rotulo: 'Projeção para o fim do ano',
          valor:
            l.projecao === null
              ? '—'
              : `${formatarBrlPdf(l.projecao)} (${pct(l.projecaoPercentual)})`,
        },
        { rotulo: 'Tolerância (limite + 20%)', valor: formatarBrlPdf(l.tolerancia) },
      ]);
      if (l.consequencia) paragrafoPdf(doc, l.consequencia);
      secaoPdf(doc, 'Faturamento por mês');
      tabelaPdf(doc, l.porMes, colunas);
    },
  );
}

// ---------------------------------------------------------------------------
// Lançamentos (exportação bruta)
// ---------------------------------------------------------------------------

const COLUNAS_LANCAMENTOS: ColunaCsv<LinhaLancamentoRelatorio>[] = COLUNAS_CSV_LANCAMENTOS.map(
  (coluna) => {
    const titulo = TITULOS_CSV_LANCAMENTOS[coluna];
    switch (coluna) {
      case 'data':
      case 'dataPagamento':
        return { titulo, valor: coluna, tipo: 'data' as const };
      case 'valor':
        return { titulo, valor: coluna, tipo: 'centavos' as const };
      case 'tipo':
        return { titulo, valor: (l) => LABEL_TIPO_LANCAMENTO[l.tipo] };
      case 'formaPagamento':
        return {
          titulo,
          valor: (l) => (l.formaPagamento ? LABEL_FORMA_PAGAMENTO[l.formaPagamento] : ''),
        };
      case 'status':
        return { titulo, valor: (l) => LABEL_STATUS_LANCAMENTO[l.status] };
      case 'origem':
        return { titulo, valor: (l) => LABEL_ORIGEM_LANCAMENTO[l.origem] };
      default:
        return { titulo, valor: coluna };
    }
  },
);

export function lancamentosCsv(
  linhas: readonly LinhaLancamentoRelatorio[],
  periodo: { de?: string; ate?: string },
): ArquivoGerado {
  const sufixo =
    periodo.de || periodo.ate ? ` ${periodo.de ?? 'inicio'} a ${periodo.ate ?? 'hoje'}` : '';
  return csv(linhas, COLUNAS_LANCAMENTOS, `Lancamentos${sufixo}`);
}

export function lancamentosPdf(
  linhas: readonly LinhaLancamentoRelatorio[],
  periodo: { de?: string; ate?: string },
  emissor: EmissorPdf,
): Promise<ArquivoGerado> {
  const colunas: ColunaPdf<LinhaLancamentoRelatorio>[] = [
    { titulo: 'Data', valor: (l) => formatData(l.data), peso: 1 },
    { titulo: 'Tipo', valor: (l) => LABEL_TIPO_LANCAMENTO[l.tipo], peso: 0.9 },
    { titulo: 'Descrição', valor: (l) => l.descricao, peso: 3 },
    { titulo: 'Categoria', valor: (l) => l.categoria ?? '', peso: 1.8 },
    { titulo: 'Contato', valor: (l) => l.contato ?? '', peso: 1.6 },
    { titulo: 'Status', valor: (l) => LABEL_STATUS_LANCAMENTO[l.status], peso: 0.9 },
    { titulo: 'Valor', valor: (l) => formatarBrlPdf(l.valor), peso: 1.3, alinhar: 'right' },
  ];
  const receitas = linhas.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
  const despesas = linhas.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
  const sufixo =
    periodo.de || periodo.ate ? ` ${periodo.de ?? 'inicio'} a ${periodo.ate ?? 'hoje'}` : '';
  return pdf(
    `Lancamentos${sufixo}`,
    {
      titulo: 'Lançamentos',
      emissor,
      periodo:
        periodo.de && periodo.ate ? periodoTexto({ de: periodo.de, ate: periodo.ate }) : undefined,
      orientacao: 'landscape',
    },
    (doc) => {
      tabelaPdf(doc, linhas, colunas);
      paresPdf(doc, [
        { rotulo: 'Total de receitas', valor: formatarBrlPdf(receitas) },
        { rotulo: 'Total de despesas', valor: formatarBrlPdf(despesas) },
        { rotulo: 'Resultado', valor: formatarBrlPdf(receitas - despesas), destaque: true },
      ]);
    },
  );
}

// ---------------------------------------------------------------------------
// Contas (parcelas)
// ---------------------------------------------------------------------------

type LinhaContas = ContasRelatorioDto['linhas'][number];

export function contasCsv(c: ContasRelatorioDto): ArquivoGerado {
  return csv(
    c.linhas,
    [
      { titulo: 'Tipo', valor: (l) => LABEL_TIPO_TITULO[l.tipo] },
      { titulo: 'Descrição', valor: 'descricao' },
      { titulo: 'Cliente/Fornecedor', valor: (l) => l.contato ?? '' },
      { titulo: 'Categoria', valor: (l) => l.categoria ?? '' },
      { titulo: 'Parcela', valor: 'parcela' },
      { titulo: 'Vencimento', valor: 'vencimento', tipo: 'data' },
      { titulo: 'Valor', valor: 'valor', tipo: 'centavos' },
      { titulo: 'Status', valor: (l) => LABEL_STATUS_PARCELA[l.status] },
      { titulo: 'Data de pagamento', valor: 'dataPagamento', tipo: 'data' },
      { titulo: 'Valor pago', valor: 'valorPago', tipo: 'centavos' },
      { titulo: 'Atrasada', valor: 'atrasada', tipo: 'booleano' },
      { titulo: 'Dias de atraso', valor: 'diasAtraso', tipo: 'inteiro' },
    ],
    'Contas a pagar e receber',
  );
}

export function contasPdf(c: ContasRelatorioDto, emissor: EmissorPdf): Promise<ArquivoGerado> {
  const colunas: ColunaPdf<LinhaContas>[] = [
    { titulo: 'Tipo', valor: (l) => LABEL_TIPO_TITULO[l.tipo], peso: 0.9 },
    { titulo: 'Descrição', valor: (l) => l.descricao, peso: 2.6 },
    { titulo: 'Contato', valor: (l) => l.contato ?? '', peso: 1.6 },
    { titulo: 'Parcela', valor: (l) => l.parcela, peso: 0.7, alinhar: 'center' },
    { titulo: 'Vencimento', valor: (l) => formatData(l.vencimento), peso: 1 },
    {
      titulo: 'Status',
      valor: (l) => (l.atrasada ? `Atrasada (${l.diasAtraso} d)` : LABEL_STATUS_PARCELA[l.status]),
      peso: 1.2,
    },
    { titulo: 'Valor', valor: (l) => formatarBrlPdf(l.valor), peso: 1.2, alinhar: 'right' },
  ];
  return pdf(
    'Contas a pagar e receber',
    { titulo: 'Contas a pagar e a receber', emissor, orientacao: 'landscape' },
    (doc) => {
      tabelaPdf(doc, c.linhas, colunas);
      secaoPdf(doc, 'Totais');
      paresPdf(doc, [
        { rotulo: 'A pagar em aberto', valor: formatarBrlPdf(c.totais.pagar.aberto) },
        { rotulo: 'A pagar atrasado', valor: formatarBrlPdf(c.totais.pagar.atrasado) },
        { rotulo: 'Pago', valor: formatarBrlPdf(c.totais.pagar.pago) },
        { rotulo: 'A receber em aberto', valor: formatarBrlPdf(c.totais.receber.aberto) },
        { rotulo: 'A receber atrasado', valor: formatarBrlPdf(c.totais.receber.atrasado) },
        { rotulo: 'Recebido', valor: formatarBrlPdf(c.totais.receber.pago) },
      ]);
    },
  );
}
