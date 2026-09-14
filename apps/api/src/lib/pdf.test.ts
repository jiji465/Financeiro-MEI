import { describe, expect, it } from 'vitest';

import { garantirEspaco, gerarPdf, tabelaPdf } from './pdf.js';

function contarPaginas(buffer: Buffer): number {
  const texto = buffer.toString('latin1');
  const paginas = texto.match(/\/Type\s*\/Page[^s]/g);
  return paginas ? paginas.length : 0;
}

describe('gerarPdf', () => {
  it('um relatório curto gera 1 página, sem página extra em branco pro rodapé', async () => {
    const buffer = await gerarPdf({ titulo: 'Relatório de teste' }, (doc) => {
      doc.text('Conteúdo qualquer.');
    });
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(contarPaginas(buffer)).toBe(1);
  });

  it('conteúdo que força quebra de página soma o rodapé sem criar páginas extras', async () => {
    const buffer = await gerarPdf({ titulo: 'Relatório longo' }, (doc) => {
      garantirEspaco(doc, doc.page.height);
      doc.text('Página 2.');
    });
    expect(contarPaginas(buffer)).toBe(2);
  });
});

describe('tabelaPdf', () => {
  it('célula mais larga que a coluna não faz a tabela crescer além de 1 página', async () => {
    const linhas = [{ nome: 'Um nome de contato bem longo que não caberia numa coluna estreita' }];
    const buffer = await gerarPdf({ titulo: 'Tabela' }, (doc) => {
      tabelaPdf(doc, linhas, [{ titulo: 'Nome', valor: (l: (typeof linhas)[number]) => l.nome }]);
    });
    expect(contarPaginas(buffer)).toBe(1);
  });
});
