// GET /dashboard/por-produto: ranking do catálogo a partir dos ITENS das vendas.
//
// O risco aqui não é a rota existir — é a soma. Uma venda tem N linhas, e uma consulta que
// junta tabelas sem cuidado multiplica valores. Os casos abaixo criam propositalmente vendas
// com várias linhas, o mesmo item repetido na mesma venda e vendas sem itens.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { criarHoje } from '../../lib/hoje.js';

const URL = '/api/v1/dashboard/por-produto';
const HOJE = '2026-09-15';
const PERIODO = 'de=2026-09-01&ate=2026-09-30';

interface ItemProduto {
  produtoServicoId: string;
  nome: string;
  tipo: 'produto' | 'servico';
  unidade: string | null;
  valor: number;
  percentual: number;
  quantidade: number;
  vendas: number;
}

interface PorProduto {
  periodo: { de: string; ate: string };
  total: number;
  itens: ItemProduto[];
}

describe('dashboard por produto', () => {
  let ctx: TestApp;
  let s: TenantSession;
  let categoriaReceita: string;
  let bolo: string;
  let corte: string;
  let brinde: string;

  const get = async (query = PERIODO): Promise<PorProduto> => {
    const res = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}?${query}` });
    if (res.statusCode !== 200) throw new Error(`por-produto: ${res.body}`);
    return res.json<{ data: PorProduto }>().data;
  };

  const criarItem = async (payload: Record<string, unknown>): Promise<string> => {
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: '/api/v1/produtos-servicos',
      payload,
    });
    if (res.statusCode !== 201) throw new Error(`criar item: ${res.body}`);
    return res.json<{ data: { id: string } }>().data.id;
  };

  const vender = async (
    valor: number,
    itens: { produtoServicoId: string; quantidade: number; valorUnitario: number }[],
    extra: Record<string, unknown> = {},
  ) => {
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: '/api/v1/lancamentos',
      payload: {
        tipo: 'receita',
        data: '2026-09-10',
        valor,
        descricao: 'Venda',
        categoriaId: categoriaReceita,
        status: 'pago',
        itens,
        ...extra,
      },
    });
    if (res.statusCode !== 201) throw new Error(`vender: ${res.body}`);
    return res.json<{ data: { id: string } }>().data;
  };

  beforeAll(async () => {
    ctx = await buildTestApp({}, { hoje: criarHoje(HOJE) });
    s = await signupTenant(ctx.app, { atividade: 'comercio_servicos' });
    const lista = (
      await injectComo(ctx.app, s, { method: 'GET', url: '/api/v1/categorias?tipo=receita' })
    ).json<{ data: { id: string }[] }>().data;
    categoriaReceita = lista[0]!.id;

    bolo = await criarItem({ tipo: 'produto', nome: 'Bolo de cenoura', unidade: 'un' });
    corte = await criarItem({ tipo: 'servico', nome: 'Corte de cabelo', unidade: 'h' });
    brinde = await criarItem({ tipo: 'produto', nome: 'Brinde', unidade: 'un' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('sem vendas com itens, devolve lista vazia e total zero', async () => {
    expect(await get()).toMatchObject({ total: 0, itens: [] });
  });

  it('soma valor e quantidade por item, sem multiplicar linhas', async () => {
    // Venda 1: 2 bolos a R$ 45 (9.000) + 1 corte a R$ 60 (6.000) = R$ 150,00
    await vender(15_000, [
      { produtoServicoId: bolo, quantidade: 2000, valorUnitario: 4500 },
      { produtoServicoId: corte, quantidade: 1000, valorUnitario: 6000 },
    ]);
    // Venda 2: 3 bolos a R$ 45 = R$ 135,00
    await vender(13_500, [{ produtoServicoId: bolo, quantidade: 3000, valorUnitario: 4500 }]);

    const r = await get();
    expect(r.total).toBe(28_500);
    expect(r.itens).toHaveLength(2);

    const [primeiro, segundo] = r.itens;
    // Ordenado por faturamento: bolo (22.500) antes do corte (6.000).
    expect(primeiro).toMatchObject({
      nome: 'Bolo de cenoura',
      tipo: 'produto',
      unidade: 'un',
      valor: 22_500,
      quantidade: 5000, // 2 + 3 unidades, em milésimos
      vendas: 2,
    });
    expect(segundo).toMatchObject({ nome: 'Corte de cabelo', valor: 6_000, vendas: 1 });
    expect(primeiro!.percentual + segundo!.percentual).toBeCloseTo(100, 1);
  });

  it('o mesmo item repetido na mesma venda conta UMA venda, mas soma as duas linhas', async () => {
    // 1 brinde a R$ 10 + 1 brinde a R$ 10 na mesma venda = R$ 20, uma venda só.
    await vender(2_000, [
      { produtoServicoId: brinde, quantidade: 1000, valorUnitario: 1000 },
      { produtoServicoId: brinde, quantidade: 1000, valorUnitario: 1000 },
    ]);
    const item = (await get()).itens.find((i) => i.nome === 'Brinde')!;
    expect(item).toMatchObject({ valor: 2_000, quantidade: 2000, vendas: 1 });
  });

  it('venda sem itens não aparece — e por isso o total fica abaixo do faturamento', async () => {
    await injectComo(ctx.app, s, {
      method: 'POST',
      url: '/api/v1/lancamentos',
      payload: {
        tipo: 'receita',
        data: '2026-09-12',
        valor: 100_000,
        descricao: 'Venda avulsa sem itens',
        categoriaId: categoriaReceita,
        status: 'pago',
      },
    });

    const r = await get();
    expect(r.itens.some((i) => i.nome.includes('avulsa'))).toBe(false);

    const resumo = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `/api/v1/dashboard/resumo?${PERIODO}`,
    });
    const receitas = resumo.json<{ data: { receitas: { valor: number } } }>().data.receitas.valor;
    expect(r.total).toBeLessThan(receitas);
  });

  it('?tipo recorta o catálogo e ?ordenarPor=quantidade muda a ordem', async () => {
    const soServicos = await get(`${PERIODO}&tipo=servico`);
    expect(soServicos.itens.map((i) => i.nome)).toEqual(['Corte de cabelo']);

    // Por quantidade: bolo (5 un) na frente do brinde (2 un) e do corte (1 h).
    const porQtd = await get(`${PERIODO}&ordenarPor=quantidade`);
    expect(porQtd.itens[0]!.nome).toBe('Bolo de cenoura');
  });

  it('?limite corta a lista mas o total continua sendo o de tudo', async () => {
    const completo = await get();
    const cortado = await get(`${PERIODO}&limite=1`);
    expect(cortado.itens).toHaveLength(1);
    expect(cortado.total).toBe(completo.total);
  });

  it('pendente só entra com somentePagos=false', async () => {
    await vender(5_000, [{ produtoServicoId: corte, quantidade: 1000, valorUnitario: 5000 }], {
      status: 'pendente',
      data: '2026-09-14',
    });

    const pagos = await get();
    const comPendentes = await get(`${PERIODO}&somentePagos=false`);
    expect(comPendentes.total).toBe(pagos.total + 5_000);
  });

  it('sem token → 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `${URL}?${PERIODO}` });
    expect(res.statusCode).toBe(401);
  });
});
