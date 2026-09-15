// Catálogo de produtos/serviços e itens de lançamento: CRUD, nome único por MEI, soft delete que
// preserva a venda antiga e — o miolo — o arredondamento do total do item e a regra de que a soma
// dos itens tem que bater com o valor do lançamento.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { criarHoje } from '../../lib/hoje.js';

const URL = '/api/v1/produtos-servicos';
const HOJE = '2026-06-15';

interface Produto {
  id: string;
  tipo: 'produto' | 'servico';
  nome: string;
  descricao: string | null;
  precoPadrao: number | null;
  unidade: string | null;
  ativo: boolean;
  lancamentos: number;
  createdAt: string;
  updatedAt: string;
}

interface Item {
  id: string;
  produtoServicoId: string;
  produtoServico: { id: string; nome: string; tipo: string; unidade: string | null } | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

interface Lancamento {
  id: string;
  valor: number;
  itens: Item[];
}

interface DetalheErro {
  error: { message: string; details?: { campo: string; mensagem: string }[] };
}

describe('produtos, serviços e itens do lançamento', () => {
  let ctx: TestApp;
  let s: TenantSession;
  let categoriaReceita: string;
  let categoriaDespesa: string;

  const criarProduto = async (payload: Record<string, unknown>) => {
    const res = await injectComo(ctx.app, s, { method: 'POST', url: URL, payload });
    if (res.statusCode !== 201) throw new Error(`criar produto: ${res.body}`);
    return res.json<{ data: Produto }>().data;
  };

  const listar = async (query = '') =>
    (await injectComo(ctx.app, s, { method: 'GET', url: `${URL}${query}` })).json<{
      data: Produto[];
    }>().data;

  const postLancamento = (payload: Record<string, unknown>) =>
    injectComo(ctx.app, s, { method: 'POST', url: '/api/v1/lancamentos', payload });

  const criarLancamento = async (payload: Record<string, unknown>) => {
    const res = await postLancamento(payload);
    if (res.statusCode !== 201) throw new Error(`criar lançamento: ${res.body}`);
    return res.json<{ data: Lancamento }>().data;
  };

  const obterLancamento = async (id: string) => {
    const res = await injectComo(ctx.app, s, { method: 'GET', url: `/api/v1/lancamentos/${id}` });
    if (res.statusCode !== 200) throw new Error(`obter lançamento: ${res.body}`);
    return res.json<{ data: Lancamento }>().data;
  };

  const baseReceita = (valor: number, itens?: unknown) => ({
    tipo: 'receita',
    data: '2026-06-10',
    valor,
    descricao: 'Venda de balcão',
    categoriaId: categoriaReceita,
    status: 'pago',
    ...(itens === undefined ? {} : { itens }),
  });

  beforeAll(async () => {
    ctx = await buildTestApp({}, { hoje: criarHoje(HOJE) });
    s = await signupTenant(ctx.app, { atividade: 'comercio_servicos' });
    const cats = (await injectComo(ctx.app, s, { method: 'GET', url: '/api/v1/categorias' })).json<{
      data: { id: string; tipo: string; sistema: boolean }[];
    }>().data;
    categoriaReceita = cats.find((c) => c.tipo === 'receita')!.id;
    categoriaDespesa = cats.find((c) => c.tipo === 'despesa' && !c.sistema)!.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  // -------------------------------------------------------------- catálogo

  it('sem token → 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: URL });
    expect(res.statusCode).toBe(401);
  });

  it('lista vazia', async () => {
    expect(await listar()).toEqual([]);
  });

  it('POST cria produto com preço padrão e unidade', async () => {
    const bolo = await criarProduto({
      tipo: 'produto',
      nome: '  Bolo de cenoura ',
      descricao: 'Bolo caseiro de 1,2 kg',
      precoPadrao: 4_500,
      unidade: 'un',
    });
    expect(bolo).toMatchObject({
      tipo: 'produto',
      nome: 'Bolo de cenoura',
      precoPadrao: 4_500,
      unidade: 'un',
      ativo: true,
      lancamentos: 0,
    });
    expect(bolo.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('POST cria serviço sem preço padrão (o valor é combinado a cada venda)', async () => {
    const corte = await criarProduto({ tipo: 'servico', nome: 'Corte de cabelo', unidade: 'un' });
    expect(corte).toMatchObject({ tipo: 'servico', precoPadrao: null, unidade: 'un' });
  });

  it('POST com nome repetido (mesmo em outra caixa) → 409 no campo nome', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { tipo: 'servico', nome: 'bolo DE cenoura' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<DetalheErro>().error.details?.[0]?.campo).toBe('nome');
  });

  it('GET ?tipo e ?busca filtram o catálogo', async () => {
    expect((await listar('?tipo=produto')).map((p) => p.nome)).toEqual(['Bolo de cenoura']);
    expect((await listar('?tipo=servico')).map((p) => p.nome)).toEqual(['Corte de cabelo']);
    expect((await listar('?busca=cenoura')).map((p) => p.nome)).toEqual(['Bolo de cenoura']);
    expect(await listar('?busca=nada-com-esse-nome')).toEqual([]);
  });

  it('GET /opcoes traz só os ativos, com preço e unidade', async () => {
    const res = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/opcoes` });
    expect(res.statusCode).toBe(200);
    const data = res.json<{ data: { nome: string; precoPadrao: number | null }[] }>().data;
    expect(data.map((o) => o.nome)).toEqual(['Bolo de cenoura', 'Corte de cabelo']);
  });

  // ------------------------------------------------------- itens e totais

  it('itens gravam o total calculado pela API, com arredondamento half-up', async () => {
    const [bolo] = await listar('?busca=cenoura');
    const queijo = await criarProduto({
      tipo: 'produto',
      nome: 'Queijo artesanal',
      precoPadrao: 1_033,
      unidade: 'kg',
    });

    // 3 bolos (R$ 45,00) = R$ 135,00 e 1,5 kg de queijo (R$ 10,33) = 1.549,5 centavos → R$ 15,50.
    const itens = [
      { produtoServicoId: bolo!.id, quantidade: 3000, valorUnitario: 4_500 },
      { produtoServicoId: queijo.id, quantidade: 1500, valorUnitario: 1_033 },
    ];
    const lancamento = await criarLancamento(baseReceita(13_500 + 1_550, itens));

    expect(lancamento.itens).toHaveLength(2);
    expect(lancamento.itens[0]).toMatchObject({ quantidade: 3000, valorTotal: 13_500 });
    expect(lancamento.itens[1]).toMatchObject({ quantidade: 1500, valorTotal: 1_550 });
    expect(lancamento.itens[0]?.produtoServico?.nome).toBe('Bolo de cenoura');
    expect(lancamento.itens[1]?.produtoServico?.unidade).toBe('kg');
    // Reabrir o lançamento devolve os itens na mesma ordem.
    expect(await obterLancamento(lancamento.id)).toMatchObject({ valor: 15_050 });
  });

  it('soma dos itens diferente do valor do lançamento → 422 no campo itens', async () => {
    const [bolo] = await listar('?busca=cenoura');
    const res = await postLancamento(
      baseReceita(10_000, [{ produtoServicoId: bolo!.id, quantidade: 3000, valorUnitario: 4_500 }]),
    );
    expect(res.statusCode).toBe(422);
    const erro = res.json<DetalheErro>().error;
    expect(erro.details?.[0]?.campo).toBe('itens');
    expect(erro.message).toContain('R$ 135,00');
    expect(erro.message).toContain('R$ 100,00');
  });

  it('o 422 desfaz o lançamento inteiro (nada de venda gravada sem os itens dela)', async () => {
    const antes = (
      await injectComo(ctx.app, s, {
        method: 'GET',
        url: '/api/v1/lancamentos?busca=Venda%20com%20soma%20errada',
      })
    ).json<{ meta: { total: number } }>().meta.total;
    const [bolo] = await listar('?busca=cenoura');
    const res = await postLancamento({
      ...baseReceita(1, [{ produtoServicoId: bolo!.id, quantidade: 1000, valorUnitario: 4_500 }]),
      descricao: 'Venda com soma errada',
    });
    expect(res.statusCode).toBe(422);
    const depois = (
      await injectComo(ctx.app, s, {
        method: 'GET',
        url: '/api/v1/lancamentos?busca=Venda%20com%20soma%20errada',
      })
    ).json<{ meta: { total: number } }>().meta.total;
    expect(depois).toBe(antes);
  });

  it('lançamento sem itens continua válido (o caso comum)', async () => {
    const lancamento = await criarLancamento(baseReceita(7_000));
    expect(lancamento.itens).toEqual([]);
  });

  it('despesa também aceita itens (compra de insumos do mesmo catálogo)', async () => {
    const [bolo] = await listar('?busca=cenoura');
    const res = await postLancamento({
      tipo: 'despesa',
      data: '2026-06-11',
      valor: 9_000,
      descricao: 'Compra de bolos para revenda',
      categoriaId: categoriaDespesa,
      status: 'pago',
      itens: [{ produtoServicoId: bolo!.id, quantidade: 2000, valorUnitario: 4_500 }],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ data: Lancamento }>().data.itens).toHaveLength(1);
  });

  it('PATCH troca os itens e o valor juntos', async () => {
    const [bolo] = await listar('?busca=cenoura');
    const lancamento = await criarLancamento(
      baseReceita(4_500, [{ produtoServicoId: bolo!.id, quantidade: 1000, valorUnitario: 4_500 }]),
    );
    const res = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `/api/v1/lancamentos/${lancamento.id}`,
      payload: {
        valor: 9_000,
        itens: [{ produtoServicoId: bolo!.id, quantidade: 2000, valorUnitario: 4_500 }],
      },
    });
    expect(res.statusCode).toBe(200);
    const atualizado = res.json<{ data: Lancamento }>().data;
    expect(atualizado.valor).toBe(9_000);
    expect(atualizado.itens).toHaveLength(1);
    expect(atualizado.itens[0]?.quantidade).toBe(2000);
  });

  it('PATCH com itens: [] limpa os itens do lançamento', async () => {
    const [bolo] = await listar('?busca=cenoura');
    const lancamento = await criarLancamento(
      baseReceita(4_500, [{ produtoServicoId: bolo!.id, quantidade: 1000, valorUnitario: 4_500 }]),
    );
    const res = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `/api/v1/lancamentos/${lancamento.id}`,
      payload: { itens: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: Lancamento }>().data.itens).toEqual([]);
  });

  it('PATCH que muda só o valor de um lançamento com itens → 422 (a soma deixaria de fechar)', async () => {
    const [bolo] = await listar('?busca=cenoura');
    const lancamento = await criarLancamento(
      baseReceita(4_500, [{ produtoServicoId: bolo!.id, quantidade: 1000, valorUnitario: 4_500 }]),
    );
    const res = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `/api/v1/lancamentos/${lancamento.id}`,
      payload: { valor: 5_000 },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<DetalheErro>().error.details?.[0]?.campo).toBe('itens');
    // E o valor antigo continua lá: a transação inteira foi desfeita.
    expect((await obterLancamento(lancamento.id)).valor).toBe(4_500);
  });

  it('PATCH de descrição em lançamento com itens não mexe nos itens', async () => {
    const [bolo] = await listar('?busca=cenoura');
    const lancamento = await criarLancamento(
      baseReceita(4_500, [{ produtoServicoId: bolo!.id, quantidade: 1000, valorUnitario: 4_500 }]),
    );
    const res = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `/api/v1/lancamentos/${lancamento.id}`,
      payload: { descricao: 'Venda do sábado' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: Lancamento }>().data.itens).toHaveLength(1);
  });

  it('item apontando para id que não existe → 404', async () => {
    const res = await postLancamento(
      baseReceita(4_500, [
        {
          produtoServicoId: '99999999-9999-4999-8999-999999999999',
          quantidade: 1000,
          valorUnitario: 4_500,
        },
      ]),
    );
    expect(res.statusCode).toBe(404);
  });

  it('quantidade zero, negativa ou fracionada → 400 (a validação é do schema)', async () => {
    const [bolo] = await listar('?busca=cenoura');
    for (const quantidade of [0, -1000, 1.5]) {
      const res = await postLancamento(
        baseReceita(4_500, [{ produtoServicoId: bolo!.id, quantidade, valorUnitario: 4_500 }]),
      );
      expect(res.statusCode, `quantidade ${quantidade}`).toBe(400);
    }
  });

  it('o total mandado pelo cliente é ignorado: quem calcula é a API', async () => {
    const [bolo] = await listar('?busca=cenoura');
    const lancamento = await criarLancamento(
      baseReceita(4_500, [
        {
          produtoServicoId: bolo!.id,
          quantidade: 1000,
          valorUnitario: 4_500,
          valorTotal: 1, // ignorado pelo schema
        },
      ]),
    );
    expect(lancamento.itens[0]?.valorTotal).toBe(4_500);
  });

  // ---------------------------------------------------- uso e soft delete

  it('a contagem de uso conta lançamentos distintos, não linhas', async () => {
    const pastel = await criarProduto({ tipo: 'produto', nome: 'Pastel', precoPadrao: 1_000 });
    await criarLancamento(
      baseReceita(3_000, [
        { produtoServicoId: pastel.id, quantidade: 1000, valorUnitario: 1_000 },
        { produtoServicoId: pastel.id, quantidade: 2000, valorUnitario: 1_000 },
      ]),
    );
    const res = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${pastel.id}` });
    expect(res.json<{ data: Produto }>().data.lancamentos).toBe(1);
  });

  it('PATCH desativa: some das opções, continua na lista', async () => {
    const [pastel] = await listar('?busca=Pastel');
    const res = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${pastel!.id}`,
      payload: { ativo: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: Produto }>().data.ativo).toBe(false);

    const opcoes = (await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/opcoes` })).json<{
      data: { id: string }[];
    }>().data;
    expect(opcoes.map((o) => o.id)).not.toContain(pastel!.id);
    expect((await listar()).map((p) => p.id)).toContain(pastel!.id);
  });

  it('DELETE é soft: o item some do catálogo mas a venda antiga continua mostrando o que vendeu', async () => {
    const brigadeiro = await criarProduto({
      tipo: 'produto',
      nome: 'Brigadeiro',
      precoPadrao: 300,
    });
    const venda = await criarLancamento(
      baseReceita(1_500, [
        { produtoServicoId: brigadeiro.id, quantidade: 5000, valorUnitario: 300 },
      ]),
    );

    const del = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${brigadeiro.id}` });
    expect(del.statusCode).toBe(200);
    expect((await listar()).map((p) => p.id)).not.toContain(brigadeiro.id);
    expect(
      (await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${brigadeiro.id}` })).statusCode,
    ).toBe(404);

    const depois = await obterLancamento(venda.id);
    expect(depois.itens).toHaveLength(1);
    expect(depois.itens[0]?.valorTotal).toBe(1_500);
    expect(depois.itens[0]?.produtoServico?.nome).toBe('Brigadeiro');
  });

  it('nome excluído pode ser reaproveitado (a unicidade só vale entre os não excluídos)', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { tipo: 'produto', nome: 'Brigadeiro', precoPadrao: 350 },
    });
    expect(res.statusCode).toBe(201);
  });

  it('a lista de lançamentos já traz os itens de cada linha', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'GET',
      url: '/api/v1/lancamentos?busca=Venda%20de%20balc',
    });
    expect(res.statusCode).toBe(200);
    const data = res.json<{ data: Lancamento[] }>().data;
    expect(data.some((l) => l.itens.length > 0)).toBe(true);
    for (const l of data.filter((x) => x.itens.length > 0)) {
      expect(l.itens.reduce((soma, i) => soma + i.valorTotal, 0)).toBe(l.valor);
    }
  });

  it('excluir o lançamento não derruba o item do catálogo', async () => {
    const [bolo] = await listar('?busca=cenoura');
    const venda = await criarLancamento(
      baseReceita(4_500, [{ produtoServicoId: bolo!.id, quantidade: 1000, valorUnitario: 4_500 }]),
    );
    const del = await injectComo(ctx.app, s, {
      method: 'DELETE',
      url: `/api/v1/lancamentos/${venda.id}`,
    });
    expect(del.statusCode).toBe(204);
    const res = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${bolo!.id}` });
    expect(res.statusCode).toBe(200);
  });
});
