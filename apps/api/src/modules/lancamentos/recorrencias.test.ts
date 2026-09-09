import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarHoje } from '../../lib/hoje.js';
import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { dataNaCompetencia, gerarRecorrenciasPendentes } from './recorrencias.service.js';

const URL = '/api/v1/recorrencias';
const HOJE = '2026-09-09';

interface Cat {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
}

interface Lanc {
  id: string;
  data: string;
  status: string;
  competencia: string | null;
  recorrenciaId: string | null;
  origem: string;
}

describe('recorrencias', () => {
  let ctx: TestApp;
  let s: TenantSession;
  let receita: Cat;
  let despesa: Cat;

  const lancamentosDe = async (recorrenciaId: string) =>
    (
      await injectComo(ctx.app, s, {
        method: 'GET',
        url: `/api/v1/lancamentos?origem=recorrencia&ordenarPor=data&ordem=asc&pageSize=200`,
      })
    )
      .json<{ data: Lanc[] }>()
      .data.filter((l) => l.recorrenciaId === recorrenciaId);

  beforeAll(async () => {
    ctx = await buildTestApp({}, { hoje: criarHoje(HOJE) });
    s = await signupTenant(ctx.app, { atividade: 'servicos' });
    const cats = (await injectComo(ctx.app, s, { method: 'GET', url: '/api/v1/categorias' })).json<{
      data: Cat[];
    }>().data;
    receita = cats.find((c) => c.tipo === 'receita')!;
    despesa = cats.find((c) => c.tipo === 'despesa' && !c.nome.includes('DAS'))!;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('dataNaCompetencia: clamp no fim do mês e nunca antes do início', () => {
    const rec = { diaDoMes: 31, dataInicio: '2026-01-31' };
    expect(dataNaCompetencia(rec, '2026-02')).toBe('2026-02-28');
    expect(dataNaCompetencia(rec, '2026-03')).toBe('2026-03-31');
    expect(dataNaCompetencia({ diaDoMes: 5, dataInicio: '2026-07-20' }, '2026-07')).toBe(
      '2026-07-20',
    );
  });

  it('POST cria e materializa as competências pendentes até hoje (primeira nunca antes do início)', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: {
        tipo: 'receita',
        valor: 300_000,
        descricao: 'Contrato mensal',
        categoriaId: receita.id,
        formaPagamento: 'transferencia',
        diaDoMes: 5,
        dataInicio: '2026-07-20',
      },
    });
    expect(res.statusCode).toBe(201);
    const rec = res.json().data;
    expect(rec).toMatchObject({
      ativo: true,
      ultimaCompetencia: '2026-09',
      categoria: { id: receita.id },
      contato: null,
    });

    const gerados = await lancamentosDe(rec.id);
    expect(gerados.map((l) => [l.data, l.competencia, l.status, l.origem])).toEqual([
      ['2026-07-20', '2026-07', 'pendente', 'recorrencia'],
      ['2026-08-05', '2026-08', 'pendente', 'recorrencia'],
      ['2026-09-05', '2026-09', 'pendente', 'recorrencia'],
    ]);
  });

  it('POST /gerar é idempotente e respeita "ate"; dataFim limita a geração', async () => {
    const lista = await injectComo(ctx.app, s, { method: 'GET', url: URL });
    const rec = lista.json().data[0];

    const denovo = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/gerar`,
      payload: {},
    });
    expect(denovo.json().data).toEqual({ geradas: 0, recorrencias: 0, competencias: [] });

    const adiante = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/gerar`,
      payload: { recorrenciaId: rec.id, ate: '2026-11' },
    });
    expect(adiante.json().data).toEqual({
      geradas: 2,
      recorrencias: 1,
      competencias: ['2026-10', '2026-11'],
    });
    expect(await lancamentosDe(rec.id)).toHaveLength(5);

    // Chamada direta (o dashboard usa esta função) continua sem duplicar.
    const direto = await gerarRecorrenciasPendentes(ctx.database.db, s.tenantId, '2026-12-31');
    expect(direto.geradas).toBe(1); // só dezembro
    const outraVez = await ctx.database.withTx((tx) =>
      gerarRecorrenciasPendentes(tx, s.tenantId, '2026-12-31'),
    );
    expect(outraVez.geradas).toBe(0);

    const comFim = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: {
        tipo: 'despesa',
        valor: 5_000,
        descricao: 'Plano trimestral',
        categoriaId: despesa.id,
        diaDoMes: 31,
        dataInicio: '2026-01-31',
        dataFim: '2026-03-15',
      },
    });
    expect(comFim.statusCode).toBe(201);
    const gerados = await lancamentosDe(comFim.json().data.id);
    expect(gerados.map((l) => l.data)).toEqual(['2026-01-31', '2026-02-28']);
    expect(comFim.json().data.ultimaCompetencia).toBe('2026-03');
  });

  it('valida: categoria de outro tipo → 422; dataFim antes do início → 400; contato inexistente → 404', async () => {
    const base = {
      tipo: 'despesa',
      valor: 100,
      descricao: 'x',
      diaDoMes: 1,
      dataInicio: '2026-09-01',
    };
    const errada = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { ...base, categoriaId: receita.id },
    });
    expect(errada.statusCode).toBe(422);

    const fim = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { ...base, categoriaId: despesa.id, dataFim: '2026-08-01' },
    });
    expect(fim.statusCode).toBe(400);
    expect(fim.json().error.details[0].campo).toBe('dataFim');

    const contato = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: {
        ...base,
        categoriaId: despesa.id,
        contatoId: '00000000-0000-4000-8000-000000000000',
      },
    });
    expect(contato.statusCode).toBe(404);
  });

  it('PATCH pausa (ativo=false) e o /gerar pula; reativar retoma; filtros ?ativo e ?tipo', async () => {
    const criada = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: {
        tipo: 'despesa',
        valor: 9_900,
        descricao: 'Streaming',
        categoriaId: despesa.id,
        diaDoMes: 15,
        dataInicio: '2026-09-01',
      },
    });
    const id = criada.json().data.id as string;
    expect(await lancamentosDe(id)).toHaveLength(1);

    const pausar = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${id}`,
      payload: { ativo: false },
    });
    expect(pausar.statusCode).toBe(200);
    expect(pausar.json().data.ativo).toBe(false);

    const gerar = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/gerar`,
      payload: { recorrenciaId: id, ate: '2026-12' },
    });
    expect(gerar.json().data.geradas).toBe(0);

    const inativas = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}?ativo=false` });
    expect(inativas.json().data.map((r: { id: string }) => r.id)).toEqual([id]);
    const receitas = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}?tipo=receita` });
    expect(receitas.json().data.every((r: { tipo: string }) => r.tipo === 'receita')).toBe(true);

    const reativar = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${id}`,
      payload: { ativo: true, valor: 10_900 },
    });
    expect(reativar.json().data).toMatchObject({ ativo: true, valor: 10_900 });
    const gerar2 = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/gerar`,
      payload: { recorrenciaId: id, ate: '2026-10' },
    });
    expect(gerar2.json().data.geradas).toBe(1);
  });

  it('DELETE remove a recorrência; lançamentos já gerados ficam (sem vínculo); inexistente → 404', async () => {
    const lista = await injectComo(ctx.app, s, { method: 'GET', url: URL });
    const rec = lista.json().data.find((r: { descricao: string }) => r.descricao === 'Streaming');
    const antes = await lancamentosDe(rec.id);
    expect(antes.length).toBeGreaterThan(0);

    const del = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${rec.id}` });
    expect(del.statusCode).toBe(204);
    const get = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${rec.id}` });
    expect(get.statusCode).toBe(404);

    const restantes = await injectComo(ctx.app, s, {
      method: 'GET',
      url: '/api/v1/lancamentos?busca=Streaming',
    });
    expect(restantes.json().meta.total).toBe(antes.length);
    expect(restantes.json().data.every((l: Lanc) => l.recorrenciaId === null)).toBe(true);

    const denovo = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${rec.id}` });
    expect(denovo.statusCode).toBe(404);
  });
});
