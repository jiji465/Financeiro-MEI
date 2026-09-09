// Geração de PDF server-side com pdfkit. Base do P1-B (cabeçalho + tabela simples);
// WP5 (relatórios) amplia com layouts específicos (DRE, extrato, DASN...).
import PDFDocument from 'pdfkit';

export interface PdfOpcoes {
  titulo: string;
  subtitulo?: string;
  /** Nome do MEI exibido no cabeçalho. */
  emissor?: string;
  rodape?: string;
}

export type PdfDoc = PDFKit.PDFDocument;

export const PDF_CONTENT_TYPE = 'application/pdf';

/** Cria o documento, desenha o cabeçalho, chama `desenhar(doc)` e devolve o Buffer final. */
export function gerarPdf(opcoes: PdfOpcoes, desenhar: (doc: PdfDoc) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: opcoes.titulo } });
    const partes: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => partes.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    try {
      cabecalho(doc, opcoes);
      desenhar(doc);
      if (opcoes.rodape) {
        doc.moveDown().fontSize(8).fillColor('#666666').text(opcoes.rodape, { align: 'center' });
      }
      doc.end();
    } catch (erro) {
      reject(erro);
    }
  });
}

function cabecalho(doc: PdfDoc, opcoes: PdfOpcoes) {
  doc.fontSize(16).fillColor('#111111').text(opcoes.titulo);
  if (opcoes.emissor) doc.fontSize(10).fillColor('#444444').text(opcoes.emissor);
  if (opcoes.subtitulo) doc.fontSize(10).fillColor('#444444').text(opcoes.subtitulo);
  doc.moveDown();
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#cccccc')
    .stroke();
  doc.moveDown(0.5);
  doc.fillColor('#111111');
}

export interface ColunaPdf<T> {
  titulo: string;
  valor: (linha: T) => string;
  /** Largura relativa (padrão 1). */
  peso?: number;
  alinhar?: 'left' | 'right' | 'center';
}

/** Tabela simples com cabeçalho e quebra de página automática. */
export function tabelaPdf<T>(doc: PdfDoc, linhas: readonly T[], colunas: readonly ColunaPdf<T>[]) {
  const larguraUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pesoTotal = colunas.reduce((s, c) => s + (c.peso ?? 1), 0);
  const larguras = colunas.map((c) => (larguraUtil * (c.peso ?? 1)) / pesoTotal);
  const alturaLinha = 16;

  const desenharLinha = (valores: string[], negrito: boolean) => {
    if (doc.y + alturaLinha > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    let x = doc.page.margins.left;
    doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    valores.forEach((valor, i) => {
      const largura = larguras[i] ?? 0;
      doc.text(valor, x, y, {
        width: largura - 4,
        align: colunas[i]?.alinhar ?? 'left',
        lineBreak: false,
        ellipsis: true,
      });
      x += largura;
    });
    doc.y = y + alturaLinha;
    doc.x = doc.page.margins.left;
  };

  desenharLinha(
    colunas.map((c) => c.titulo),
    true,
  );
  for (const linha of linhas) {
    desenharLinha(
      colunas.map((c) => c.valor(linha)),
      false,
    );
  }
  doc.font('Helvetica');
}

/** 123456 → "R$ 1.234,56" para uso em PDFs. */
export function formatarBrlPdf(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.trunc(centavos));
  const inteiro = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fracao = String(abs % 100).padStart(2, '0');
  return `${negativo ? '-' : ''}R$ ${inteiro},${fracao}`;
}
