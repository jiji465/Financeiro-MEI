// Testes dos relatórios contra uma fixture pequena com relógio fixo (hoje = 2026-09-15).
// Cobre os três formatos (json/csv/pdf) pelo menos uma vez e confere isolamento entre tenants.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { criarHoje } from '../../lib/hoje.js';
import { criarLancamentoInterno } from '../lancamentos/core.js';

const URL = '/api/v1/relatorios';
const HOJE = '2026-09-15';

interface Cat {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
}

describe('relatorios', () => {
  let ctx: TestApp;
  let s: TenantSession;
  let cats: Record<string, string>;

  const get = (url: string, headers?: Record<string, string>) =>
    injectComo(ctx.app, s, { method: 'GET', url, headers });

  beforeAll(async () => {
    ctx = await buildTestApp({}, { hoje: criarHoje(HOJE) });
    s = await signupTenant(ctx.app, { atividade: 'servicos', dataAbertura: '2026-01-10' });
    const lista = (
      await injectComo(ctx.app, s, { method: 'GET', url: '/api/v1/categorias' })
    ).json<{ data: Cat[] }>().data;
    cats = Object.fromEntries(lista.map((c) => [c.nome, c.id]));

    const db = ctx.database.db;
    const servicos = cats['Prestação de serviços']!;
    const aluguel = cats['Aluguel']!;

    await criarLancamentoInterno(db, s.tenantId, {
      tipo: 'receita',
      data: '2026-09-05',
      valor: 300_000,
      descricao: 'Serviço prestado',
      categoriaId: servicos,
      formaPagamento: 'pix',
      status: 'pago',
      origem: 'manual',
    });
    await criarLancamentoInterno(db, s.tenantId, {
      tipo: 'despesa',
      data: '2026-09-03',
      valor: 50_000,
      descricao: 'Aluguel do mês',
      categoriaId: aluguel,
      formaPagamento: 'boleto',
      status: 'pago',
      origem: 'manual',
    });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('GET /dre exige de e ate (400 sem período)', async () => {
    const res = await get(`${URL}/dre`);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /dre?formato=json calcula receitas, despesas e resultado do período', async () => {
    const res = await get(`${URL}/dre?de=2026-09-01&ate=2026-09-30`);
    expect(res.statusCode).toBe(200);
    const data = res.json<{
      data: { receitas: { total: number }; despesas: { total: number }; resultado: number };
    }>().data;
    expect(data.receitas.total).toBe(300_000);
    expect(data.despesas.total).toBe(50_000);
    expect(data.resultado).toBe(250_000);
  });

  it('GET /dre?formato=csv devolve CSV com BOM e ";"', async () => {
    const res = await get(`${URL}/dre?de=2026-09-01&ate=2026-09-30&formato=csv`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    const texto = res.rawPayload.toString('utf8');
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    expect(texto).toContain(';');
  });

  it('GET /dre?formato=pdf devolve um PDF válido', async () => {
    const res = await get(`${URL}/dre?de=2026-09-01&ate=2026-09-30&formato=pdf`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');
    expect(res.rawPayload.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('GET /extrato?formato=json calcula saldo corrido', async () => {
    const res = await get(`${URL}/extrato?de=2026-09-01&ate=2026-09-30`);
    expect(res.statusCode).toBe(200);
    const data = res.json<{
      data: { saldoInicial: number; linhas: unknown[]; totais: { saldoFinal: number } };
    }>().data;
    expect(data.saldoInicial).toBe(0);
    expect(data.linhas).toHaveLength(2);
    expect(data.totais.saldoFinal).toBe(250_000);
  });

  it('GET /dasn?ano= apura faturamento por grupo DASN', async () => {
    const res = await get(`${URL}/dasn?ano=2026`);
    expect(res.statusCode).toBe(200);
    const data = res.json<{ data: { faturamentoApurado: number; receitaServicos: number } }>().data;
    expect(data.faturamentoApurado).toBe(300_000);
    expect(data.receitaServicos).toBe(300_000);
  });

  it('GET /limite?ano= devolve o acumulado e o percentual do limite', async () => {
    const res = await get(`${URL}/limite?ano=2026`);
    expect(res.statusCode).toBe(200);
    const data = res.json<{ data: { acumulado: number; percentual: number } }>().data;
    expect(data.acumulado).toBe(300_000);
    expect(data.percentual).toBeGreaterThan(0);
  });

  it('GET /lancamentos sem formato devolve CSV por padrão', async () => {
    const res = await get(`${URL}/lancamentos?de=2026-09-01&ate=2026-09-30`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('GET /lancamentos?formato=json lista os lançamentos do período', async () => {
    const res = await get(`${URL}/lancamentos?de=2026-09-01&ate=2026-09-30&formato=json`);
    expect(res.statusCode).toBe(200);
    const data = res.json<{ data: { descricao: string }[] }>().data;
    expect(data.map((l) => l.descricao).sort()).toEqual(['Aluguel do mês', 'Serviço prestado']);
  });

  it('GET /contas devolve linhas e totais zerados sem parcelas', async () => {
    const res = await get(`${URL}/contas`);
    expect(res.statusCode).toBe(200);
    const data = res.json<{ data: { linhas: unknown[]; totais: { pagar: { aberto: number } } } }>()
      .data;
    expect(data.linhas).toEqual([]);
    expect(data.totais.pagar.aberto).toBe(0);
  });

  it('outro tenant não vê os lançamentos de A', async () => {
    const b = await signupTenant(ctx.app, { atividade: 'comercio' });
    const res = await injectComo(ctx.app, b, {
      method: 'GET',
      url: `${URL}/extrato?de=2026-09-01&ate=2026-09-30`,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json<{ data: { linhas: unknown[]; saldoInicial: number } }>().data;
    expect(data.linhas).toEqual([]);
    expect(data.saldoInicial).toBe(0);
  });
});
