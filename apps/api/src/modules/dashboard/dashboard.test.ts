// Testes do dashboard contra uma fixture pequena com relógio fixo (hoje = 2026-09-15).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { contatos } from '../../db/schema/contatos.js';
import { parcelas, titulos } from '../../db/schema/titulos.js';
import { criarHoje } from '../../lib/hoje.js';
import { criarLancamentoInterno } from '../lancamentos/core.js';

const URL = '/api/v1/dashboard';
const HOJE = '2026-09-15';

interface Cat {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
}

describe('dashboard', () => {
  let ctx: TestApp;
  let s: TenantSession;
  let cats: Record<string, string>;

  const get = async <T>(url: string): Promise<{ status: number; data: T }> => {
    const res = await injectComo(ctx.app, s, { method: 'GET', url });
    return { status: res.statusCode, data: res.json<{ data: T }>().data };
  };

  beforeAll(async () => {
    ctx = await buildTestApp({}, { hoje: criarHoje(HOJE) });
    s = await signupTenant(ctx.app, { atividade: 'servicos', dataAbertura: '2026-06-15' });
    const lista = (
      await injectComo(ctx.app, s, { method: 'GET', url: '/api/v1/categorias' })
    ).json<{ data: Cat[] }>().data;
    cats = Object.fromEntries(lista.map((c) => [c.nome, c.id]));

    const db = ctx.database.db;
    const [cliente] = await db
      .insert(contatos)
      .values({ tenantId: s.tenantId, tipo: 'cliente', nome: 'Cliente X' })
      .returning();

    const servicos = cats['Prestação de serviços']!;
    const aluguel = cats['Aluguel']!;
    const lanc = (
      tipo: 'receita' | 'despesa',
      data: string,
      valor: number,
      status: 'pago' | 'pendente' = 'pago',
      contatoId: string | null = null,
    ) =>
      criarLancamentoInterno(db, s.tenantId, {
        tipo,
        data,
        valor,
        descricao: `${tipo} ${data}`,
        categoriaId: tipo === 'receita' ? servicos : aluguel,
        contatoId,
        formaPagamento: 'pix',
        status,
        origem: 'manual',
      });

    // Setembro (período atual)
    await lanc('receita', '2026-09-05', 300_000, 'pago', cliente!.id);
    await lanc('receita', '2026-09-10', 200_000);
    await lanc('despesa', '2026-09-03', 100_000);
    await lanc('receita', '2026-09-25', 150_000, 'pendente');
    // Agosto (período anterior)
    await lanc('receita', '2026-08-10', 400_000);
    await lanc('despesa', '2026-08-12', 50_000);
    // Julho (só entra no saldo inicial)
    await lanc('receita', '2026-07-01', 100_000);

    // Títulos: a receber em 2 parcelas (set/out) e a pagar vencido em 01/09
    const [receber] = await db
      .insert(titulos)
      .values({
        tenantId: s.tenantId,
        tipo: 'receber',
        descricao: 'Projeto site',
        contatoId: cliente!.id,
        categoriaId: servicos,
        valorTotal: 120_000,
        numeroParcelas: 2,
        dataEmissao: '2026-08-20',
      })
      .returning();
    await db.insert(parcelas).values([
      {
        tenantId: s.tenantId,
        tituloId: receber!.id,
        numero: 1,
        vencimento: '2026-09-20',
        valor: 60_000,
      },
      {
        tenantId: s.tenantId,
        tituloId: receber!.id,
        numero: 2,
        vencimento: '2026-10-20',
        valor: 60_000,
      },
    ]);
    const [pagar] = await db
      .insert(titulos)
      .values({
        tenantId: s.tenantId,
        tipo: 'pagar',
        descricao: 'Aluguel sala',
        categoriaId: aluguel,
        valorTotal: 80_000,
        numeroParcelas: 1,
        dataEmissao: '2026-08-25',
      })
      .returning();
    await db.insert(parcelas).values({
      tenantId: s.tenantId,
      tituloId: pagar!.id,
      numero: 1,
      vencimento: '2026-09-01',
      valor: 80_000,
    });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('GET /resumo sem período usa o mês atual e compara com o mês anterior', async () => {
    const { status, data } = await get<{
      periodo: { de: string; ate: string };
      receitas: { valor: number; anterior: number; variacao: number | null };
      despesas: { valor: number; anterior: number; variacao: number | null };
      saldo: { valor: number; anterior: number; variacao: number | null };
      receitasPendentes: number;
      despesasPendentes: number;
      saldoPrevisto: number;
      quantidadeLancamentos: number;
      limite: {
        ano: number;
        limite: number;
        acumulado: number;
        percentual: number;
        nivel: string;
      } | null;
      proximosVencimentos: {
        tipo: string;
        data: string;
        atrasado: boolean;
        competencia: string | null;
      }[];
    }>(`${URL}/resumo`);
    expect(status).toBe(200);
    expect(data.periodo).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
    expect(data.receitas).toEqual({ valor: 500_000, anterior: 400_000, variacao: 25 });
    expect(data.despesas).toEqual({ valor: 100_000, anterior: 50_000, variacao: 100 });
    expect(data.saldo).toEqual({ valor: 400_000, anterior: 350_000, variacao: 14.29 });
    expect(data.receitasPendentes).toBe(210_000);
    expect(data.despesasPendentes).toBe(80_000);
    expect(data.saldoPrevisto).toBe(530_000);
    expect(data.quantidadeLancamentos).toBe(4);

    // Limite: ano de abertura (junho) → 7 × limite mensal proporcional; regime competência soma pendentes.
    expect(data.limite).toMatchObject({
      ano: 2026,
      limite: 675_000 * 7,
      acumulado: 1_150_000,
      nivel: 'ok',
    });
    expect(data.limite?.percentual).toBeCloseTo(24.34, 1);

    // Vencimentos: DAS jun/jul (atrasados), DAS ago (vence 21/09), parcela a pagar vencida, parcela a receber 20/09.
    const tipos = data.proximosVencimentos.map(
      (v) => `${v.tipo}:${v.data}:${v.atrasado ? 'A' : 'N'}`,
    );
    expect(tipos).toEqual([
      'das:2026-07-20:A',
      'das:2026-08-20:A',
      'parcela_pagar:2026-09-01:A',
      'parcela_receber:2026-09-20:N',
      'das:2026-09-21:N',
    ]);
    expect(data.proximosVencimentos[0]?.competencia).toBe('2026-06');
    const datas = data.proximosVencimentos.map((v) => v.data);
    expect([...datas].sort()).toEqual(datas);
  });

  it('GET /resumo com período explícito', async () => {
    const { data } = await get<{
      receitas: { valor: number; anterior: number; variacao: number | null };
    }>(`${URL}/resumo?de=2026-08-01&ate=2026-08-31`);
    expect(data.receitas).toEqual({ valor: 400_000, anterior: 100_000, variacao: 300 });
  });

  it('GET /resumo rejeita de > ate', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/resumo?de=2026-09-30&ate=2026-09-01`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /fluxo-caixa por mês: saldo inicial, realizado, previsto e projetado', async () => {
    const { data } = await get<{
      saldoInicial: number;
      periodos: {
        periodo: string;
        receitas: number;
        despesas: number;
        receitasPrevistas: number;
        despesasPrevistas: number;
        saldoAcumulado: number;
        saldoProjetado: number;
      }[];
      saldoFinal: number;
      saldoProjetado: number;
    }>(`${URL}/fluxo-caixa?de=2026-09-01&ate=2026-09-30&agrupamento=mes`);
    expect(data.saldoInicial).toBe(450_000);
    expect(data.periodos).toHaveLength(1);
    expect(data.periodos[0]).toMatchObject({
      periodo: '2026-09',
      receitas: 500_000,
      despesas: 100_000,
      receitasPrevistas: 210_000,
      despesasPrevistas: 80_000,
      saldoAcumulado: 850_000,
      saldoProjetado: 980_000,
    });
    expect(data.saldoFinal).toBe(850_000);
    expect(data.saldoProjetado).toBe(980_000);
  });

  it('GET /fluxo-caixa por dia desloca previstos vencidos para hoje e respeita incluirPrevisao=false', async () => {
    const { data } = await get<{
      periodos: { periodo: string; despesasPrevistas: number; receitasPrevistas: number }[];
    }>(`${URL}/fluxo-caixa?de=2026-09-01&ate=2026-09-30&agrupamento=dia`);
    expect(data.periodos).toHaveLength(30);
    expect(data.periodos.find((p) => p.periodo === '2026-09-01')?.despesasPrevistas).toBe(0);
    expect(data.periodos.find((p) => p.periodo === HOJE)?.despesasPrevistas).toBe(80_000);
    expect(data.periodos.find((p) => p.periodo === '2026-09-20')?.receitasPrevistas).toBe(60_000);

    const sem = await get<{
      periodos: { receitasPrevistas: number }[];
      saldoProjetado: number;
      saldoFinal: number;
    }>(`${URL}/fluxo-caixa?de=2026-09-01&ate=2026-09-30&agrupamento=mes&incluirPrevisao=false`);
    expect(sem.data.periodos[0]?.receitasPrevistas).toBe(0);
    expect(sem.data.saldoProjetado).toBe(sem.data.saldoFinal);
  });

  it('GET /por-categoria e /por-contato', async () => {
    const cat = await get<{
      total: number;
      itens: { nome: string; valor: number; percentual: number; quantidade: number }[];
    }>(`${URL}/por-categoria?de=2026-09-01&ate=2026-09-30&tipo=despesa`);
    expect(cat.data.total).toBe(100_000);
    expect(cat.data.itens).toEqual([
      expect.objectContaining({ nome: 'Aluguel', valor: 100_000, percentual: 100, quantidade: 1 }),
    ]);

    const con = await get<{
      total: number;
      itens: { contatoId: string | null; nome: string; valor: number; percentual: number }[];
    }>(`${URL}/por-contato?de=2026-09-01&ate=2026-09-30&tipo=receita`);
    expect(con.data.total).toBe(500_000);
    expect(con.data.itens.map((i) => [i.nome, i.valor, i.percentual])).toEqual([
      ['Cliente X', 300_000, 60],
      ['Sem contato', 200_000, 40],
    ]);
    expect(con.data.itens[1]?.contatoId).toBeNull();

    // limite=1 agrega o resto em "Outras"
    const top = await get<{ itens: { nome: string; valor: number }[] }>(
      `${URL}/por-contato?de=2026-09-01&ate=2026-09-30&tipo=receita&limite=1`,
    );
    expect(top.data.itens.map((i) => i.nome)).toEqual(['Cliente X', 'Outras']);
  });

  it('GET /comparativo-mensal?meses=3', async () => {
    const { data } = await get<{
      meses: {
        competencia: string;
        receitas: number;
        despesas: number;
        saldo: number;
        receitasPendentes: number;
      }[];
      totais: { receitas: number; despesas: number; saldo: number };
      medias: { receitas: number; despesas: number; saldo: number };
    }>(`${URL}/comparativo-mensal?meses=3`);
    expect(data.meses.map((m) => m.competencia)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(data.meses[0]).toMatchObject({ receitas: 100_000, despesas: 0, saldo: 100_000 });
    expect(data.meses[1]).toMatchObject({ receitas: 400_000, despesas: 50_000, saldo: 350_000 });
    expect(data.meses[2]).toMatchObject({
      receitas: 500_000,
      despesas: 100_000,
      saldo: 400_000,
      receitasPendentes: 150_000,
    });
    expect(data.totais).toEqual({ receitas: 1_000_000, despesas: 150_000, saldo: 850_000 });
    expect(data.medias).toEqual({ receitas: 333_333, despesas: 50_000, saldo: 283_333 });
  });

  it('outro tenant vê tudo zerado', async () => {
    const b = await signupTenant(ctx.app, { atividade: 'comercio' });
    const res = await injectComo(ctx.app, b, { method: 'GET', url: `${URL}/resumo` });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.receitas.valor).toBe(0);
    expect(data.quantidadeLancamentos).toBe(0);
    expect(data.proximosVencimentos.filter((v: { tipo: string }) => v.tipo !== 'das')).toEqual([]);
  });
});
