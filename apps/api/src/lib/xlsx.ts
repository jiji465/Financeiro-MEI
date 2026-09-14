// Exportação XLSX (Excel de verdade, via exceljs). Reaproveita a mesma declaração de colunas
// (ColunaCsv<T>) já usada pelo CSV — cada relatório só declara os campos uma vez.
import { type ColunaCsv, isIsoDate } from '@meifin/shared';
import ExcelJS from 'exceljs';

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type { ColunaCsv } from '@meifin/shared';

const FORMATO_MOEDA = 'R$ #,##0.00;[Red]-R$ #,##0.00';
const LARGURA_MINIMA = 8;
const LARGURA_MAXIMA = 60;

function valorCelula(valor: unknown, tipo: ColunaCsv<unknown>['tipo']): unknown {
  if (valor === null || valor === undefined) return null;
  switch (tipo) {
    case 'centavos':
      return typeof valor === 'number' ? valor / 100 : valor;
    case 'data':
      if (typeof valor === 'string' && isIsoDate(valor)) {
        const [ano, mes, dia] = valor.split('-').map(Number);
        return new Date(Date.UTC(ano!, mes! - 1, dia!));
      }
      return valor;
    case 'booleano':
      return valor ? 'Sim' : 'Não';
    default:
      return valor;
  }
}

/**
 * Gera um .xlsx a partir das mesmas colunas declaradas para o CSV: primeira linha em negrito,
 * 'centavos' como número/moeda real, 'data' como data real do Excel, 'booleano' como Sim/Não,
 * e largura de coluna ajustada pelo conteúdo.
 */
export async function bufferXlsx<T>(
  linhas: readonly T[],
  colunas: readonly ColunaCsv<T>[],
  opcoes: { nomeAba?: string } = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet(opcoes.nomeAba?.slice(0, 31) || 'Relatório');

  planilha.columns = colunas.map((coluna) => ({
    header: coluna.titulo,
    width: Math.min(LARGURA_MAXIMA, Math.max(LARGURA_MINIMA, coluna.titulo.length + 2)),
  }));

  const cabecalho = planilha.getRow(1);
  cabecalho.font = { bold: true };

  for (const linha of linhas) {
    const valores = colunas.map((coluna) => {
      const bruto = typeof coluna.valor === 'function' ? coluna.valor(linha) : linha[coluna.valor];
      return valorCelula(bruto, coluna.tipo);
    });
    planilha.addRow(valores);
  }

  colunas.forEach((coluna, indice) => {
    const col = planilha.getColumn(indice + 1);
    if (coluna.tipo === 'centavos') {
      col.numFmt = FORMATO_MOEDA;
    } else if (coluna.tipo === 'data') {
      col.numFmt = 'dd/mm/yyyy';
    }
    let maior = coluna.titulo.length;
    for (const linha of linhas) {
      const bruto = typeof coluna.valor === 'function' ? coluna.valor(linha) : linha[coluna.valor];
      const texto =
        coluna.tipo === 'centavos' && typeof bruto === 'number'
          ? (bruto / 100).toFixed(2)
          : String(bruto ?? '');
      if (texto.length > maior) maior = texto.length;
    }
    col.width = Math.min(LARGURA_MAXIMA, Math.max(LARGURA_MINIMA, maior + 2));
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
