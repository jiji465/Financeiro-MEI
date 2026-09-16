// Recibo em PDF de uma receita recebida.
//
// É o documento que o MEI entrega a quem pagou: "recebi de FULANO a importância de X". Por isso
// só faz sentido para RECEITA JÁ PAGA — numa despesa quem emite recibo é a outra parte, e numa
// receita pendente não há o que declarar recebido.
//
// Não é nota fiscal e não substitui uma: o rodapé diz isso, para ninguém usar no lugar errado.
import {
  formatBRL,
  formatData,
  LABEL_FORMA_PAGAMENTO,
  valorPorExtenso,
  type FormaPagamento,
} from '@meifin/shared';

import {
  type EmissorPdf,
  formatarCnpjPdf,
  gerarPdf,
  larguraUtil,
  paragrafoPdf,
  type PdfDoc,
} from '../../lib/pdf.js';

export interface DadosRecibo {
  numero: string;
  emissor: EmissorPdf;
  /** Cidade/UF do MEI, para a linha "local e data"; vazio quando não cadastrado. */
  local: string | null;
  pagador: string | null;
  /** Documento do pagador (CPF/CNPJ), quando houver. */
  pagadorDocumento: string | null;
  valor: number;
  data: string;
  descricao: string;
  formaPagamento: FormaPagamento | null;
  observacoes: string | null;
}

const COR_TEXTO = '#111111';
const COR_SECUNDARIA = '#555555';
const COR_LINHA = '#cccccc';

function caixaValor(doc: PdfDoc, valor: number): void {
  const x = doc.page.margins.left;
  const largura = larguraUtil(doc);
  const altura = 46;
  const y = doc.y;
  doc.roundedRect(x, y, largura, altura, 6).lineWidth(1).strokeColor(COR_LINHA).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(COR_TEXTO)
    .text(formatBRL(valor), x + 14, y + 13, { width: largura - 28, lineBreak: false });
  doc.y = y + altura + 16;
  doc.x = x;
}

function linhaAssinatura(doc: PdfDoc, dados: DadosRecibo): void {
  const largura = larguraUtil(doc);
  const x = doc.page.margins.left;
  // Assinatura centralizada, com uma folga acima para o papel não ficar apertado quando impresso.
  doc.y += 48;
  const y = doc.y;
  const larguraLinha = Math.min(300, largura);
  const x0 = x + (largura - larguraLinha) / 2;
  doc
    .moveTo(x0, y)
    .lineTo(x0 + larguraLinha, y)
    .lineWidth(0.8)
    .strokeColor(COR_LINHA)
    .stroke();
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COR_TEXTO)
    .text(dados.emissor.nomeFantasia ?? dados.emissor.nome, x0, y + 6, {
      width: larguraLinha,
      align: 'center',
    });
  if (dados.emissor.cnpj) {
    doc
      .fontSize(9)
      .fillColor(COR_SECUNDARIA)
      .text(`CNPJ ${formatarCnpjPdf(dados.emissor.cnpj)}`, x0, doc.y, {
        width: larguraLinha,
        align: 'center',
      });
  }
}

export function gerarReciboPdf(dados: DadosRecibo): Promise<Buffer> {
  const pagador = dados.pagador ?? '—';
  const documento = dados.pagadorDocumento ? ` (${dados.pagadorDocumento})` : '';
  const forma = dados.formaPagamento ? LABEL_FORMA_PAGAMENTO[dados.formaPagamento] : null;

  return gerarPdf(
    {
      titulo: 'Recibo',
      subtitulo: `Nº ${dados.numero}`,
      emissor: dados.emissor,
      rodape: 'Recibo — não substitui nota fiscal',
    },
    (doc) => {
      caixaValor(doc, dados.valor);

      const largura = larguraUtil(doc);
      const x = doc.page.margins.left;

      doc.font('Helvetica').fontSize(11).fillColor(COR_TEXTO);
      doc.text(
        `Recebi de ${pagador}${documento} a importância de ${valorPorExtenso(dados.valor)}, ` +
          `referente a ${dados.descricao}.`,
        x,
        doc.y,
        { width: largura, align: 'justify', lineGap: 3 },
      );
      doc.moveDown(0.8);

      if (forma) {
        doc.fontSize(10).fillColor(COR_SECUNDARIA).text(`Forma de pagamento: ${forma}`, x, doc.y, {
          width: largura,
        });
        doc.moveDown(0.4);
      }

      if (dados.observacoes) paragrafoPdf(doc, dados.observacoes);

      doc.moveDown(0.4);
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(COR_TEXTO)
        .text(
          dados.local ? `${dados.local}, ${formatData(dados.data)}.` : `${formatData(dados.data)}.`,
          x,
          doc.y,
          { width: largura },
        );

      linhaAssinatura(doc, dados);
    },
  );
}
