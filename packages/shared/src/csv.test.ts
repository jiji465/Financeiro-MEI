import { describe, expect, it } from 'vitest';

import {
  BOM,
  detectarDelimitador,
  parseCsvBrasileiro,
  parseDataBrasileira,
  parseNumeroBrasileiro,
  removerBom,
  toCsv,
} from './csv.js';

describe('detectarDelimitador / removerBom', () => {
  it('prefere ";" e reconhece "," e tab', () => {
    expect(detectarDelimitador('data;valor;descricao\n')).toBe(';');
    expect(detectarDelimitador('data,valor,descricao\n')).toBe(',');
    expect(detectarDelimitador('data\tvalor\n')).toBe('\t');
    expect(detectarDelimitador('a|b|c\n')).toBe('|');
    expect(detectarDelimitador('data;valor,descricao;x\n')).toBe(';');
    expect(detectarDelimitador('semseparador\n')).toBe(';');
    expect(detectarDelimitador('\n\n')).toBe(';');
    expect(detectarDelimitador('')).toBe(';');
  });

  it('removerBom', () => {
    expect(removerBom(`${BOM}abc`)).toBe('abc');
    expect(removerBom('abc')).toBe('abc');
    expect(BOM).toBe('﻿');
  });
});

describe('parseCsvBrasileiro', () => {
  it('lê CSV com BOM, ";" e linhas vazias', () => {
    const texto = `${BOM}Data;Valor;Descrição\r\n10/03/2026;1.234,56;Venda\r\n\r\n11/03/2026;-50,00; Aluguel \r\n`;
    const r = parseCsvBrasileiro(texto);
    expect(r.delimitador).toBe(';');
    expect(r.cabecalho).toEqual(['Data', 'Valor', 'Descrição']);
    expect(r.erros).toEqual([]);
    expect(r.linhas).toEqual([
      { numero: 1, campos: { Data: '10/03/2026', Valor: '1.234,56', Descrição: 'Venda' } },
      { numero: 2, campos: { Data: '11/03/2026', Valor: '-50,00', Descrição: 'Aluguel' } },
    ]);
  });

  it('detecta "," e respeita aspas', () => {
    const r = parseCsvBrasileiro('data,valor,descricao\n2026-03-10,"1,234.56","Venda, à vista"\n');
    expect(r.delimitador).toBe(',');
    expect(r.linhas[0]?.campos).toEqual({
      data: '2026-03-10',
      valor: '1,234.56',
      descricao: 'Venda, à vista',
    });
  });

  it('aceita delimitador explícito e reporta erros traduzidos', () => {
    const r = parseCsvBrasileiro('a;b\n1;2\n3\n4;5;6\n', ';');
    expect(r.linhas).toHaveLength(3);
    expect(r.erros).toEqual([
      { linha: 2, mensagem: 'Linha com menos colunas que o cabeçalho' },
      { linha: 3, mensagem: 'Linha com mais colunas que o cabeçalho' },
    ]);
  });

  it('erros de aspas', () => {
    const r = parseCsvBrasileiro('a;b\n"abc;2\n', ';');
    expect(r.erros.some((e) => e.mensagem === 'Aspas não fechadas')).toBe(true);
    const r2 = parseCsvBrasileiro('a;b\nab"c";2\n', ';');
    expect(r2.erros.every((e) => typeof e.mensagem === 'string')).toBe(true);
  });

  it('texto vazio', () => {
    const r = parseCsvBrasileiro('');
    expect(r.linhas).toEqual([]);
    expect(r.cabecalho).toEqual([]);
    expect(parseCsvBrasileiro(undefined as unknown as string).linhas).toEqual([]);
  });
});

describe('conversões', () => {
  it('parseNumeroBrasileiro', () => {
    expect(parseNumeroBrasileiro('1.234,56')).toBe(123456);
    expect(parseNumeroBrasileiro('R$ -50,00')).toBe(-5000);
    expect(parseNumeroBrasileiro('1234.56')).toBe(123456);
    expect(parseNumeroBrasileiro('x')).toBeNull();
  });

  it('parseDataBrasileira', () => {
    expect(parseDataBrasileira('10/03/2026')).toBe('2026-03-10');
    expect(parseDataBrasileira('10/03/26')).toBe('2026-03-10');
    expect(parseDataBrasileira('2026-03-10')).toBe('2026-03-10');
    expect(parseDataBrasileira(' 2026-03-10T15:00:00Z ')).toBe('2026-03-10');
    expect(parseDataBrasileira('2026-03-10 15:00')).toBe('2026-03-10');
    expect(parseDataBrasileira('2026-02-30T00:00')).toBeNull();
    expect(parseDataBrasileira('31/02/2026')).toBeNull();
    expect(parseDataBrasileira('')).toBeNull();
    expect(parseDataBrasileira(5 as unknown as string)).toBeNull();
  });
});

describe('toCsv', () => {
  interface Linha {
    data: string;
    descricao: string;
    valor: number;
    pago: boolean;
    contato: string | null;
    quantidade: number;
  }
  const linhas: Linha[] = [
    {
      data: '2026-03-10',
      descricao: 'Venda; "à vista"',
      valor: 123456,
      pago: true,
      contato: null,
      quantidade: 3,
    },
    {
      data: '2026-03-11',
      descricao: 'Aluguel',
      valor: -5000,
      pago: false,
      contato: 'Imobiliária',
      quantidade: 1,
    },
  ];

  it('gera BOM + ";" + vírgula decimal + CRLF, com aspas quando necessário', () => {
    const csv = toCsv(linhas, [
      { titulo: 'Data', valor: 'data', tipo: 'data' },
      { titulo: 'Descrição', valor: 'descricao' },
      { titulo: 'Valor', valor: 'valor', tipo: 'centavos' },
      { titulo: 'Pago', valor: 'pago', tipo: 'booleano' },
      { titulo: 'Contato', valor: 'contato' },
      { titulo: 'Qtd', valor: 'quantidade', tipo: 'inteiro' },
      { titulo: 'Tipo', valor: (l) => (l.valor >= 0 ? 'receita' : 'despesa') },
    ]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.slice(1)).toBe(
      'Data;Descrição;Valor;Pago;Contato;Qtd;Tipo\r\n' +
        '10/03/2026;"Venda; ""à vista""";1.234,56;Sim;;3;receita\r\n' +
        '11/03/2026;Aluguel;-50,00;Não;Imobiliária;1;despesa\r\n',
    );
  });

  it('opções: sem BOM, "," e LF; números sem tipo viram decimal; tipos com valor inesperado viram texto', () => {
    const csv = toCsv(
      [{ a: 1050, b: 'x', c: 7 }],
      [
        { titulo: 'A', valor: 'a' },
        { titulo: 'B', valor: 'b', tipo: 'data' },
        { titulo: 'C', valor: 'c', tipo: 'centavos' },
        { titulo: 'D', valor: 'b', tipo: 'centavos' },
        { titulo: 'E', valor: () => undefined, tipo: 'booleano' },
      ],
      { bom: false, delimitador: ',', quebraLinha: '\n' },
    );
    expect(csv).toBe('A,B,C,D,E\n"10,50",x,"0,07",x,\n');
  });

  it('sem linhas gera só o cabeçalho', () => {
    expect(toCsv([], [{ titulo: 'A', valor: () => 1 }], { bom: false })).toBe('A\r\n');
  });
});
