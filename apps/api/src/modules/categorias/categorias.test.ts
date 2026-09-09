import { CATEGORIA_DAS_NOME, categoriasPadraoPara } from '@meifin/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { criarLancamentoInterno } from '../lancamentos/core.js';
import { getCategoriaSistema } from './core.js';

const URL = '/api/v1/categorias';

interface Cat {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  grupoDasn: string | null;
  sistema: boolean;
  ativo: boolean;
  padrao: boolean;
  cor: string | null;
}

describe('categorias', () => {
  let ctx: TestApp;
  let s: TenantSession;

  const listar = async (query = '') =>
    (await injectComo(ctx.app, s, { method: 'GET', url: `${URL}${query}` })).json<{ data: Cat[] }>()
      .data;

  beforeAll(async () => {
    ctx = await buildTestApp();
    s = await signupTenant(ctx.app, { atividade: 'comercio_servicos' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('template padrão (comércio + serviços) = CATEGORIAS_PADRAO do shared, DAS de sistema', async () => {
    const lista = await listar();
    const esperadas = categoriasPadraoPara('comercio_servicos');
    expect(lista.length).toBe(esperadas.length);
    expect(lista.length).toBeGreaterThanOrEqual(10);
    expect(lista.every((c) => c.padrao)).toBe(true);
    expect(new Set(lista.map((c) => c.nome))).toEqual(new Set(esperadas.map((c) => c.nome)));
    expect(lista.find((c) => c.nome === 'Venda de produtos')?.grupoDasn).toBe('comercio');
    expect(lista.find((c) => c.nome === 'Prestação de serviços')?.grupoDasn).toBe('servicos');
    const das = lista.filter((c) => c.sistema);
    expect(das).toHaveLength(1);
    expect(das[0]).toMatchObject({ nome: CATEGORIA_DAS_NOME, tipo: 'despesa' });
    // lista sem meta (listaResponse)
    const bruto = await injectComo(ctx.app, s, { method: 'GET', url: URL });
    expect(bruto.json()).not.toHaveProperty('meta');
  });

  it('sem token → 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: URL });
    expect(res.statusCode).toBe(401);
  });

  it('POST cria; nome duplicado (case-insensitive) no mesmo tipo → 409', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { nome: 'Consultoria', tipo: 'receita', grupoDasn: 'servicos', cor: '#12AB56' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({
      nome: 'Consultoria',
      tipo: 'receita',
      grupoDasn: 'servicos',
      cor: '#12ab56',
      padrao: false,
      sistema: false,
      ativo: true,
    });
    expect(res.json().data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const dup = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { nome: 'CONSULTORIA', tipo: 'receita' },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toMatchObject({ error: { code: 'CONFLICT', details: [{ campo: 'nome' }] } });

    // Mesmo nome em outro tipo é permitido
    const outroTipo = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { nome: 'Consultoria', tipo: 'despesa' },
    });
    expect(outroTipo.statusCode).toBe(201);
    expect(outroTipo.json().data.grupoDasn).toBeNull();
  });

  it('valida corpo e parâmetros (grupo DASN em despesa, cor inválida, id não-uuid → 400)', async () => {
    const grupo = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { nome: 'X', tipo: 'despesa', grupoDasn: 'comercio' },
    });
    expect(grupo.statusCode).toBe(400);
    expect(grupo.json().error.details[0].campo).toBe('grupoDasn');

    const cor = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { nome: 'X', tipo: 'receita', cor: 'vermelho' },
    });
    expect(cor.statusCode).toBe(400);
    expect(cor.json().error.details[0].campo).toBe('cor');

    const id = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/nao-uuid` });
    expect(id.statusCode).toBe(400);
  });

  it('GET/PATCH por id; inexistente → 404', async () => {
    const [cat] = (await listar()).filter((c) => !c.sistema && c.tipo === 'despesa');
    const get = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${cat!.id}` });
    expect(get.statusCode).toBe(200);
    expect(get.json().data.id).toBe(cat!.id);

    const patch = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${cat!.id}`,
      payload: { nome: 'Renomeada', icone: 'star', ordem: 42 },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data).toMatchObject({ nome: 'Renomeada', icone: 'star', ordem: 42 });

    const naoExiste = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/00000000-0000-4000-8000-000000000000`,
    });
    expect(naoExiste.statusCode).toBe(404);
  });

  it('categoria de sistema: não desativa nem exclui (409); cor pode mudar', async () => {
    const das = (await listar()).find((c) => c.sistema)!;
    const desativar = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${das.id}`,
      payload: { ativo: false },
    });
    expect(desativar.statusCode).toBe(409);
    const excluir = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${das.id}` });
    expect(excluir.statusCode).toBe(409);
    const cor = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${das.id}`,
      payload: { cor: '#000000' },
    });
    expect(cor.statusCode).toBe(200);
    expect(cor.json().data.cor).toBe('#000000');
  });

  it('DELETE sem referências exclui de verdade; com lançamentos só desativa', async () => {
    const criada = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { nome: 'Temporária', tipo: 'despesa' },
    });
    const id = criada.json().data.id as string;
    const del = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${id}` });
    expect(del.statusCode).toBe(200);
    expect(del.json().data).toEqual({
      id,
      excluida: true,
      desativada: false,
      lancamentosVinculados: 0,
    });
    const depois = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${id}` });
    expect(depois.statusCode).toBe(404);

    const usada = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { nome: 'Usada', tipo: 'despesa' },
    });
    const usadaId = usada.json().data.id as string;
    await criarLancamentoInterno(ctx.database.db, s.tenantId, {
      tipo: 'despesa',
      data: '2026-01-10',
      valor: 1000,
      descricao: 'gasto',
      categoriaId: usadaId,
      formaPagamento: 'pix',
      status: 'pago',
      origem: 'manual',
    });
    const del2 = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${usadaId}` });
    expect(del2.statusCode).toBe(200);
    expect(del2.json().data).toEqual({
      id: usadaId,
      excluida: false,
      desativada: true,
      lancamentosVinculados: 1,
    });

    // Some da lista padrão; aparece com ?todas=true ou ?ativo=false
    expect((await listar()).some((c) => c.id === usadaId)).toBe(false);
    expect((await listar('?todas=true')).find((c) => c.id === usadaId)?.ativo).toBe(false);
    const inativas = await listar('?ativo=false');
    expect(inativas.every((c) => !c.ativo)).toBe(true);
    expect(inativas.some((c) => c.id === usadaId)).toBe(true);

    // Reativar via PATCH
    const reativar = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${usadaId}`,
      payload: { ativo: true },
    });
    expect(reativar.json().data.ativo).toBe(true);
  });

  it('filtros ?tipo= e ?busca=', async () => {
    const receitas = await listar('?tipo=receita');
    expect(receitas.length).toBeGreaterThan(0);
    expect(receitas.every((c) => c.tipo === 'receita')).toBe(true);
    const busca = await listar('?busca=consult');
    expect(busca.length).toBeGreaterThan(0);
    expect(busca.every((c) => c.nome.toLowerCase().includes('consult'))).toBe(true);
  });

  it('getCategoriaSistema devolve a categoria DAS ligada em configuracoes e a recria se sumir', async () => {
    const das = await getCategoriaSistema(ctx.database.db, s.tenantId, 'das');
    expect(das).toMatchObject({ nome: CATEGORIA_DAS_NOME, sistema: true, tenantId: s.tenantId });

    // Simula perda: desliga a configuração e apaga a categoria via SQL bruto
    await ctx.database.db.execute(
      sql`update configuracoes set categoria_das_id = null where tenant_id = ${s.tenantId}`,
    );
    await ctx.database.db.execute(sql`delete from categorias where id = ${das.id}`);

    const recriada = await getCategoriaSistema(ctx.database.db, s.tenantId, 'das');
    expect(recriada.id).not.toBe(das.id);
    expect(recriada).toMatchObject({ nome: CATEGORIA_DAS_NOME, sistema: true, tipo: 'despesa' });
    const cfg = await injectComo(ctx.app, s, { method: 'GET', url: '/api/v1/configuracoes' });
    expect(cfg.json().data.categoriaDasId).toBe(recriada.id);
  });
});
