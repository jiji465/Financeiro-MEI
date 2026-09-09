import { BOM } from '@meifin/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { contatos } from '../../db/schema/contatos.js';
import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { montarMultipart } from '../lancamentos/testing.js';
import {
  hashLinha,
  interpretarCsv,
  interpretarFormaPagamento,
  interpretarTipo,
  sugerirCategoria,
} from './service.js';

const URL = '/api/v1/importacoes';

interface Cat {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
}

interface Linha {
  numero: number;
  data: string | null;
  valor: number | null;
  descricao: string;
  tipo: string | null;
  categoriaId: string | null;
  categoriaNome: string | null;
  contatoId: string | null;
  formaPagamento: string | null;
  hash: string;
  duplicada: boolean;
  erro: string | null;
}

interface Preview {
  nomeArquivo: string;
  delimitador: string;
  cabecalho: string[];
  totalLinhas: number;
  validas: number;
  comErro: number;
  duplicadas: number;
  linhas: Linha[];
}

const CSV = [
  'Data;Descrição;Valor;Contato;Pagamento',
  '05/08/2026;Consultoria de serviços;"1.500,00";Cliente Beta;Pix',
  '06/08/2026;Aluguel da sala;"-800,00";;Boleto bancário',
  '06/08/2026;Aluguel da sala;"-800,00";;Boleto bancário',
  '31/02/2026;Data quebrada;"10,00";;',
  '07/08/2026;Sem categoria óbvia;"-42,10";;cartão de crédito',
].join('\r\n');

describe('importacoes: funções puras', () => {
  const categorias: { id: string; nome: string; tipo: 'receita' | 'despesa' }[] = [
    { id: 'c1', nome: 'Prestação de serviços', tipo: 'receita' },
    { id: 'c2', nome: 'Aluguel', tipo: 'despesa' },
    { id: 'c3', nome: 'Outras despesas', tipo: 'despesa' },
  ];

  it('interpretarTipo e interpretarFormaPagamento', () => {
    expect(interpretarTipo('Receita')).toBe('receita');
    expect(interpretarTipo('D')).toBe('despesa');
    expect(interpretarTipo('crédito')).toBe('receita');
    expect(interpretarTipo('?')).toBeNull();
    expect(interpretarFormaPagamento('PIX')).toBe('pix');
    expect(interpretarFormaPagamento('Cartão de crédito')).toBe('cartao');
    expect(interpretarFormaPagamento('TED')).toBe('transferencia');
    expect(interpretarFormaPagamento('cheque')).toBe('outro');
    expect(interpretarFormaPagamento('')).toBeNull();
  });

  it('sugerirCategoria: nome exato da coluna, senão palavra do nome na descrição', () => {
    expect(sugerirCategoria(categorias, 'despesa', 'aluguel', 'qualquer')?.id).toBe('c2');
    expect(sugerirCategoria(categorias, 'despesa', undefined, 'Aluguel da sala')?.id).toBe('c2');
    expect(sugerirCategoria(categorias, 'receita', undefined, 'Serviços prestados')?.id).toBe('c1');
    // "Outras" é ignorada como palavra-chave
    expect(sugerirCategoria(categorias, 'despesa', undefined, 'outras coisas')).toBeNull();
    // nunca sugere categoria de outro tipo
    expect(sugerirCategoria(categorias, 'receita', 'Aluguel', 'Aluguel')).toBeNull();
  });

  it('hashLinha é determinístico e ignora acentos/caixa/espaços da descrição', () => {
    const a = hashLinha('t', '2026-08-05', 150_000, 'receita', 'Consultoria  de Serviços');
    const b = hashLinha('t', '2026-08-05', 150_000, 'receita', 'consultoria de servicos');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(hashLinha('outro', '2026-08-05', 150_000, 'receita', 'x')).not.toBe(a);
    expect(hashLinha('t', '2026-08-05', 150_000, 'despesa', 'x')).not.toBe(
      hashLinha('t', '2026-08-05', 150_000, 'receita', 'x'),
    );
  });

  it('interpretarCsv: modo sinal, inverterSinal, coluna de tipo e erros por linha', () => {
    const refs = { tenantId: 't', categorias, contatos: [{ id: 'k1', nome: 'Cliente Beta' }] };
    const base = { data: 'Data', valor: 'Valor', descricao: 'Descrição', contato: 'Contato' };
    const sinal = interpretarCsv(
      CSV,
      {
        ...base,
        modoTipo: 'sinal',
        statusPadrao: 'pago',
        inverterSinal: false,
        formaPagamento: 'Pagamento',
      },
      refs,
    );
    expect(sinal.delimitador).toBe(';');
    expect(sinal.cabecalho).toEqual(['Data', 'Descrição', 'Valor', 'Contato', 'Pagamento']);
    expect(sinal.linhas).toHaveLength(5);
    expect(sinal.linhas[0]).toMatchObject({
      data: '2026-08-05',
      valor: 150_000,
      tipo: 'receita',
      categoriaId: 'c1',
      contatoId: 'k1',
      formaPagamento: 'pix',
      erro: null,
    });
    expect(sinal.linhas[1]).toMatchObject({ tipo: 'despesa', valor: 80_000, categoriaId: 'c2' });
    expect(sinal.linhas[3]).toMatchObject({ data: null, erro: 'Data inválida' });
    expect(sinal.linhas[4]).toMatchObject({
      tipo: 'despesa',
      categoriaId: null,
      formaPagamento: 'cartao',
    });

    const invertido = interpretarCsv(
      CSV,
      { ...base, modoTipo: 'sinal', statusPadrao: 'pendente', inverterSinal: true },
      refs,
    );
    expect(invertido.linhas[0]?.tipo).toBe('despesa');
    expect(invertido.linhas[1]?.tipo).toBe('receita');
    expect(invertido.linhas[0]?.status).toBe('pendente');

    const fixo = interpretarCsv(
      CSV,
      {
        ...base,
        modoTipo: 'fixo',
        tipoFixo: 'despesa',
        statusPadrao: 'pago',
        inverterSinal: false,
        categoriaPadraoDespesaId: 'c3',
      },
      refs,
    );
    expect(fixo.linhas.every((l) => l.tipo === 'despesa')).toBe(true);
    expect(fixo.linhas[4]?.categoriaId).toBe('c3');

    const semDescricao = interpretarCsv(
      'Data;Valor;Descrição\n01/01/2026;abc;\n',
      {
        data: 'Data',
        valor: 'Valor',
        descricao: 'Descrição',
        modoTipo: 'coluna',
        tipo: 'Tipo',
        statusPadrao: 'pago',
        inverterSinal: false,
      },
      refs,
    );
    expect(semDescricao.linhas[0]?.erro).toBe(
      'Valor inválido; Descrição vazia; Tipo não identificado',
    );
  });
});

describe('importacoes: API', () => {
  let ctx: TestApp;
  let s: TenantSession;
  let receita: Cat;
  let aluguel: Cat;
  let preview: Preview;

  const mapeamento = {
    data: 'Data',
    valor: 'Valor',
    descricao: 'Descrição',
    contato: 'Contato',
    formaPagamento: 'Pagamento',
    modoTipo: 'sinal',
    statusPadrao: 'pago',
  };

  const enviarPreview = async (csv: string, map: unknown = mapeamento, nome = 'extrato.csv') => {
    const corpo = montarMultipart([
      { nome: 'mapeamento', valor: JSON.stringify(map) },
      { nome: 'arquivo', arquivo: { nome, mime: 'text/csv', conteudo: `${BOM}${csv}` } },
    ]);
    return injectComo(ctx.app, s, { method: 'POST', url: `${URL}/csv/preview`, ...corpo });
  };

  const lancamentos = async (query = '') =>
    (
      await injectComo(ctx.app, s, {
        method: 'GET',
        url: `/api/v1/lancamentos?origem=importacao${query}`,
      })
    ).json<{
      data: { id: string; descricao: string; importacaoId: string | null }[];
      meta: { total: number };
    }>();

  beforeAll(async () => {
    ctx = await buildTestApp();
    s = await signupTenant(ctx.app, { atividade: 'servicos' });
    const cats = (await injectComo(ctx.app, s, { method: 'GET', url: '/api/v1/categorias' })).json<{
      data: Cat[];
    }>().data;
    receita = cats.find((c) => c.nome === 'Prestação de serviços')!;
    aluguel = cats.find((c) => c.nome === 'Aluguel')!;
    await ctx.database.db
      .insert(contatos)
      .values({ tenantId: s.tenantId, tipo: 'cliente', nome: 'Cliente Beta' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('preview: multipart obrigatório, mapeamento validado', async () => {
    const semArquivo = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/csv/preview`,
      payload: { mapeamento: {} },
    });
    expect(semArquivo.statusCode).toBe(400);

    const mapRuim = await enviarPreview(CSV, { data: 'Data' });
    expect(mapRuim.statusCode).toBe(400);
    expect(mapRuim.json().error.details.map((d: { campo: string }) => d.campo)).toContain(
      'mapeamento.valor',
    );

    const jsonRuim = montarMultipart([
      { nome: 'mapeamento', valor: '{nope' },
      { nome: 'arquivo', arquivo: { nome: 'a.csv', mime: 'text/csv', conteudo: CSV } },
    ]);
    const invalido = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/csv/preview`,
      ...jsonRuim,
    });
    expect(invalido.statusCode).toBe(400);
  });

  it('preview interpreta linhas, sugere categoria/contato e marca duplicadas do próprio arquivo', async () => {
    const res = await enviarPreview(CSV);
    expect(res.statusCode).toBe(200);
    preview = res.json<{ data: Preview }>().data;
    expect(preview).toMatchObject({
      nomeArquivo: 'extrato.csv',
      delimitador: ';',
      totalLinhas: 5,
      validas: 3,
      comErro: 1,
      duplicadas: 1,
    });
    const [l1, l2, l3, l4, l5] = preview.linhas;
    expect(l1).toMatchObject({
      tipo: 'receita',
      valor: 150_000,
      categoriaId: receita.id,
      categoriaNome: receita.nome,
      formaPagamento: 'pix',
      duplicada: false,
      erro: null,
    });
    expect(l1!.contatoId).toBeTruthy();
    expect(l2).toMatchObject({ tipo: 'despesa', categoriaId: aluguel.id, duplicada: false });
    expect(l3).toMatchObject({ duplicada: true, hash: l2!.hash });
    expect(l4).toMatchObject({ erro: 'Data inválida', duplicada: false });
    expect(l5).toMatchObject({ categoriaId: null, formaPagamento: 'cartao' });
  });

  it('confirmar cria lançamentos (origem importacao), pula duplicadas e registra a importação', async () => {
    const linhas = preview.linhas
      .filter((l) => !l.erro)
      .map((l) => ({
        numero: l.numero,
        data: l.data,
        valor: l.valor,
        descricao: l.descricao,
        tipo: l.tipo,
        categoriaId: l.categoriaId ?? aluguel.id,
        contatoId: l.contatoId,
        formaPagamento: l.formaPagamento,
        status: 'pago',
        hash: l.hash,
      }));
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/csv/confirmar`,
      payload: {
        nomeArquivo: preview.nomeArquivo,
        totalLinhas: preview.totalLinhas,
        mapeamento,
        linhas,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({
      nomeArquivo: 'extrato.csv',
      formato: 'csv',
      totalLinhas: 5,
      importadas: 3,
      duplicadas: 1,
      ignoradas: 1,
    });
    const importacaoId = res.json().data.id as string;

    const criados = await lancamentos();
    expect(criados.meta.total).toBe(3);
    expect(criados.data.every((l) => l.importacaoId === importacaoId)).toBe(true);

    // Segundo preview: tudo que já entrou aparece como duplicado
    const denovo = await enviarPreview(CSV);
    expect(denovo.json().data.duplicadas).toBe(4);
    expect(denovo.json().data.validas).toBe(0);

    // Confirmar de novo (ignorando duplicadas) não cria nada
    const repetida = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/csv/confirmar`,
      payload: { nomeArquivo: 'extrato.csv', totalLinhas: 5, mapeamento, linhas },
    });
    expect(repetida.statusCode).toBe(201);
    expect(repetida.json().data).toMatchObject({ importadas: 0, duplicadas: 4 });
    expect((await lancamentos()).meta.total).toBe(3);

    // Sem ignorar duplicadas → 409 e nada é criado (transação)
    const conflito = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/csv/confirmar`,
      payload: {
        nomeArquivo: 'extrato.csv',
        totalLinhas: 5,
        mapeamento,
        linhas,
        ignorarDuplicadas: false,
      },
    });
    expect(conflito.statusCode).toBe(409);
    expect(conflito.json().error.details[0].campo).toBe('linhas.0.hash');
    expect((await lancamentos()).meta.total).toBe(3);

    const historico = await injectComo(ctx.app, s, { method: 'GET', url: URL });
    expect(historico.statusCode).toBe(200);
    expect(historico.json().meta.total).toBe(2);
    const detalhe = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${importacaoId}` });
    expect(detalhe.json().data.id).toBe(importacaoId);
  });

  it('confirmar com categoria de outro tipo → 422 apontando a linha; nada é criado', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/csv/confirmar`,
      payload: {
        nomeArquivo: 'x.csv',
        totalLinhas: 1,
        mapeamento,
        linhas: [
          {
            numero: 1,
            data: '2026-08-10',
            valor: 100,
            descricao: 'categoria errada',
            tipo: 'despesa',
            categoriaId: receita.id,
            hash: hashLinha(s.tenantId, '2026-08-10', 100, 'despesa', 'categoria errada'),
          },
        ],
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.message).toMatch(/^Linha 1:/);
    expect(res.json().error.details[0].campo).toBe('linhas.0.categoriaId');
    expect((await lancamentos()).meta.total).toBe(3);
    const historico = await injectComo(ctx.app, s, { method: 'GET', url: URL });
    expect(historico.json().meta.total).toBe(2);
  });

  it('DELETE /:id desfaz: exclui os lançamentos da importação e libera os hashes', async () => {
    const historico = await injectComo(ctx.app, s, { method: 'GET', url: URL });
    const primeira = historico.json().data.find((i: { importadas: number }) => i.importadas === 3);
    const res = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${primeira.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ id: primeira.id, removidos: 3 });
    expect((await lancamentos()).meta.total).toBe(0);

    const denovo = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${primeira.id}` });
    expect(denovo.statusCode).toBe(404);

    const previewLimpo = await enviarPreview(CSV);
    expect(previewLimpo.json().data).toMatchObject({ validas: 3, duplicadas: 1 });
  });
});
