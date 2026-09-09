// Geração de PDF server-side com pdfkit (A4, Helvetica — acentos em Latin-1/WinAnsi funcionam).
// Cabeçalho com nome do MEI, CNPJ, período e data de geração; tabela com linhas zebradas,
// cabeçalho repetido a cada quebra de página e linha de totais; rodapé "Página X de Y".
import { formatBRL, formatData } from '@meifin/shared';
import PDFDocument from 'pdfkit';

export type PdfDoc = PDFKit.PDFDocument;

export const PDF_CONTENT_TYPE = 'application/pdf';

export interface EmissorPdf {
  nome: string;
  nomeFantasia?: string | null;
  cnpj?: string | null;
}

export interface PdfOpcoes {
  titulo: string;
  subtitulo?: string;
  /** MEI exibido no cabeçalho (nome, nome fantasia, CNPJ). */
  emissor?: EmissorPdf;
  /** Texto do período (ex.: "01/09/2026 a 30/09/2026"). */
  periodo?: string;
  /** Data/hora de geração já formatada; padrão: agora em pt-BR. */
  geradoEm?: string;
  rodape?: string;
  orientacao?: 'portrait' | 'landscape';
}

const COR_TEXTO = '#111111';
const COR_SECUNDARIA = '#555555';
const COR_LINHA = '#cccccc';
const COR_ZEBRA = '#f3f4f6';
const COR_CABECALHO = '#e5e7eb';

/** "12.345.678/0001-90"; CNPJ alfanumérico mantém as letras. */
export function formatarCnpjPdf(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  const c = cnpj.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

/** 123456 → "R$ 1.234,56" para uso em PDFs. */
export function formatarBrlPdf(centavos: number): string {
  return formatBRL(Math.trunc(centavos));
}

/** AAAA-MM-DD → dd/MM/aaaa ("" quando vazio). */
export function formatarDataPdf(iso: string | null | undefined): string {
  return iso ? formatData(iso) : '';
}

function agoraPtBr(): string {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function larguraUtil(doc: PdfDoc): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function cabecalho(doc: PdfDoc, opcoes: PdfOpcoes) {
  const x = doc.page.margins.left;
  const largura = larguraUtil(doc);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COR_TEXTO).text(opcoes.titulo, x, doc.y);
  if (opcoes.subtitulo) {
    doc.font('Helvetica').fontSize(10).fillColor(COR_SECUNDARIA).text(opcoes.subtitulo);
  }
  doc.moveDown(0.4);
  const linhas: string[] = [];
  if (opcoes.emissor) {
    const nome = opcoes.emissor.nomeFantasia
      ? `${opcoes.emissor.nomeFantasia} (${opcoes.emissor.nome})`
      : opcoes.emissor.nome;
    linhas.push(nome);
    if (opcoes.emissor.cnpj) linhas.push(`CNPJ ${formatarCnpjPdf(opcoes.emissor.cnpj)}`);
  }
  if (opcoes.periodo) linhas.push(`Período: ${opcoes.periodo}`);
  linhas.push(`Gerado em ${opcoes.geradoEm ?? agoraPtBr()}`);
  doc.font('Helvetica').fontSize(9).fillColor(COR_SECUNDARIA);
  for (const linha of linhas) doc.text(linha, x, doc.y, { width: largura });
  doc.moveDown(0.6);
  doc
    .moveTo(x, doc.y)
    .lineTo(x + largura, doc.y)
    .lineWidth(0.8)
    .strokeColor(COR_LINHA)
    .stroke();
  doc.moveDown(0.8);
  doc.fillColor(COR_TEXTO).font('Helvetica').fontSize(10);
}

function rodape(doc: PdfDoc, opcoes: PdfOpcoes) {
  const faixa = doc.bufferedPageRange();
  const total = faixa.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(faixa.start + i);
    const y = doc.page.height - doc.page.margins.bottom + 8;
    const x = doc.page.margins.left;
    const largura = larguraUtil(doc);
    // Sem quebra automática: escrever no rodapé não pode criar página nova.
    doc.font('Helvetica').fontSize(8).fillColor(COR_SECUNDARIA);
    const esquerda = opcoes.rodape ?? 'MEI Financeiro';
    doc.text(esquerda, x, y, { width: largura / 2, lineBreak: false });
    doc.text(`Página ${i + 1} de ${total}`, x + largura / 2, y, {
      width: largura / 2,
      align: 'right',
      lineBreak: false,
    });
  }
}

/**
 * Cria o documento A4, desenha o cabeçalho, chama `desenhar(doc)`, numera as páginas e
 * devolve o Buffer final (começa com "%PDF").
 */
export function gerarPdf(
  opcoes: PdfOpcoes,
  desenhar: (doc: PdfDoc) => void | Promise<void>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: opcoes.orientacao ?? 'portrait',
      margins: { top: 40, bottom: 44, left: 40, right: 40 },
      bufferPages: true,
      info: { Title: opcoes.titulo, Producer: 'MEI Financeiro', Creator: 'MEI Financeiro' },
    });
    const partes: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => partes.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    void (async () => {
      try {
        cabecalho(doc, opcoes);
        await desenhar(doc);
        rodape(doc, opcoes);
        doc.end();
      } catch (erro) {
        reject(erro instanceof Error ? erro : new Error(String(erro)));
      }
    })();
  });
}

export interface ColunaPdf<T> {
  titulo: string;
  valor: (linha: T) => string;
  /** Largura relativa (padrão 1). */
  peso?: number;
  alinhar?: 'left' | 'right' | 'center';
}

export interface TabelaPdfOpcoes {
  /** Linhas alternadas com fundo cinza (padrão true). */
  zebra?: boolean;
  /** Linha final em negrito (mesma ordem das colunas). */
  totais?: string[];
  /** Texto quando não há linhas. */
  vazio?: string;
  fonte?: number;
}

/** Garante espaço vertical; cria página nova quando necessário. */
export function garantirEspaco(doc: PdfDoc, altura: number): void {
  if (doc.y + altura > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

/**
 * Tabela com cabeçalho (repetido em cada página), linhas zebradas, quebra automática de página
 * e linha de totais opcional. Células longas são truncadas com reticências.
 */
export function tabelaPdf<T>(
  doc: PdfDoc,
  linhas: readonly T[],
  colunas: readonly ColunaPdf<T>[],
  opcoes: TabelaPdfOpcoes = {},
): void {
  const zebra = opcoes.zebra ?? true;
  const fonte = opcoes.fonte ?? 9;
  const largura = larguraUtil(doc);
  const pesoTotal = colunas.reduce((s, c) => s + (c.peso ?? 1), 0);
  const larguras = colunas.map((c) => (largura * (c.peso ?? 1)) / pesoTotal);
  const alturaLinha = fonte + 8;
  const x0 = doc.page.margins.left;

  const desenharLinha = (
    valores: readonly string[],
    estilo: 'cabecalho' | 'zebra' | 'normal' | 'total',
  ) => {
    garantirEspaco(doc, alturaLinha);
    const y = doc.y;
    if (estilo === 'cabecalho' || estilo === 'zebra') {
      doc
        .rect(x0, y, largura, alturaLinha)
        .fillColor(estilo === 'cabecalho' ? COR_CABECALHO : COR_ZEBRA)
        .fill();
    }
    if (estilo === 'total') {
      doc
        .moveTo(x0, y)
        .lineTo(x0 + largura, y)
        .lineWidth(0.8)
        .strokeColor(COR_LINHA)
        .stroke();
    }
    doc
      .font(estilo === 'cabecalho' || estilo === 'total' ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(fonte)
      .fillColor(COR_TEXTO);
    let x = x0;
    valores.forEach((valor, i) => {
      const w = larguras[i] ?? 0;
      doc.text(valor ?? '', x + 3, y + 4, {
        width: w - 6,
        align: colunas[i]?.alinhar ?? 'left',
        lineBreak: false,
        ellipsis: true,
      });
      x += w;
    });
    doc.y = y + alturaLinha;
    doc.x = x0;
  };

  const cabecalhoTabela = () =>
    desenharLinha(
      colunas.map((c) => c.titulo),
      'cabecalho',
    );

  cabecalhoTabela();
  if (linhas.length === 0) {
    garantirEspaco(doc, alturaLinha);
    doc
      .font('Helvetica-Oblique')
      .fontSize(fonte)
      .fillColor(COR_SECUNDARIA)
      .text(opcoes.vazio ?? 'Nenhum registro no período.', x0 + 3, doc.y + 4, {
        width: largura - 6,
        lineBreak: false,
      });
    doc.y += alturaLinha;
    doc.x = x0;
  }
  linhas.forEach((linha, i) => {
    const precisaPagina = doc.y + alturaLinha > doc.page.height - doc.page.margins.bottom;
    if (precisaPagina) {
      doc.addPage();
      cabecalhoTabela();
    }
    desenharLinha(
      colunas.map((c) => c.valor(linha)),
      zebra && i % 2 === 1 ? 'zebra' : 'normal',
    );
  });
  if (opcoes.totais) desenharLinha(opcoes.totais, 'total');
  doc.font('Helvetica').fontSize(10).fillColor(COR_TEXTO);
  doc.moveDown(0.8);
}

/** Título de seção (ex.: "Receitas"). */
export function secaoPdf(doc: PdfDoc, titulo: string): void {
  garantirEspaco(doc, 30);
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COR_TEXTO)
    .text(titulo, doc.page.margins.left, doc.y);
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10);
}

export interface ParPdf {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}

/** Bloco de pares rótulo/valor alinhados (totais, resumo). */
export function paresPdf(doc: PdfDoc, pares: readonly ParPdf[]): void {
  const largura = larguraUtil(doc);
  const x0 = doc.page.margins.left;
  const altura = 18;
  for (const par of pares) {
    garantirEspaco(doc, altura);
    const y = doc.y;
    doc
      .font(par.destaque ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(par.destaque ? 11 : 10)
      .fillColor(COR_TEXTO)
      .text(par.rotulo, x0, y, { width: largura * 0.6, lineBreak: false, ellipsis: true })
      .text(par.valor, x0 + largura * 0.6, y, {
        width: largura * 0.4,
        align: 'right',
        lineBreak: false,
      });
    doc.y = y + altura;
    doc.x = x0;
  }
  doc.font('Helvetica').fontSize(10);
  doc.moveDown(0.6);
}

/** Parágrafo simples (observações, avisos). */
export function paragrafoPdf(doc: PdfDoc, texto: string): void {
  garantirEspaco(doc, 24);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COR_SECUNDARIA)
    .text(texto, doc.page.margins.left, doc.y, { width: larguraUtil(doc) });
  doc.fillColor(COR_TEXTO).fontSize(10);
  doc.moveDown(0.6);
}
