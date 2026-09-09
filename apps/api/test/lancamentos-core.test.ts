// modules/lancamentos/core.ts (congelado): criação/exclusão interna de lançamentos com checagens
// de tenant e de tipo de categoria.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { lancamentos } from '../src/db/schema/lancamentos.js';
import { NotFoundError, UnprocessableError, ValidationError } from '../src/lib/errors.js';
import { forTenant } from '../src/lib/tenant-db.js';
import {
  criarLancamentoInterno,
  excluirLancamentoInterno,
} from '../src/modules/lancamentos/core.js';
import { buildTestApp, signupTenant, type TenantSession, type TestApp } from './helpers.js';

interface Cat {
  id: string;
  tipo: 'receita' | 'despesa';
  nome: string;
}

async function categoriasDe(ctx: TestApp, s: TenantSession): Promise<Cat[]> {
  const res = await ctx.app.inject({
    method: 'GET',
    url: '/api/v1/categorias',
    headers: s.headers,
  });
  return res.json<{ data: Cat[] }>().data;
}

describe('criarLancamentoInterno / excluirLancamentoInterno', () => {
  let ctx: TestApp;
  let a: TenantSession;
  let b: TenantSession;
  let receitaA: Cat;
  let despesaA: Cat;

  beforeAll(async () => {
    ctx = await buildTestApp();
    a = await signupTenant(ctx.app, { atividade: 'servicos' });
    b = await signupTenant(ctx.app, { atividade: 'servicos' });
    const cats = await categoriasDe(ctx, a);
    receitaA = cats.find((c) => c.tipo === 'receita')!;
    despesaA = cats.find((c) => c.tipo === 'despesa')!;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('cria receita paga com data de pagamento = data por padrão', async () => {
    const criado = await ctx.database.withTx((tx) =>
      criarLancamentoInterno(tx, a.tenantId, {
        tipo: 'receita',
        data: '2026-03-10',
        valor: 50_000,
        descricao: '  Serviço prestado  ',
        categoriaId: receitaA.id,
        formaPagamento: 'pix',
        status: 'pago',
        origem: 'manual',
      }),
    );
    expect(criado.tenantId).toBe(a.tenantId);
    expect(criado.descricao).toBe('Serviço prestado');
    expect(criado.dataPagamento).toBe('2026-03-10');
    expect(criado.valor).toBe(50_000);
    expect(criado.origem).toBe('manual');
    expect(criado.deletedAt).toBeNull();
  });

  it('despesa pendente fica sem data de pagamento e guarda competência/origem', async () => {
    const criado = await criarLancamentoInterno(ctx.database.db, a.tenantId, {
      tipo: 'despesa',
      data: '2026-04-20',
      valor: 8_605,
      descricao: 'DAS 03/2026',
      categoriaId: despesaA.id,
      formaPagamento: 'boleto',
      status: 'pendente',
      origem: 'das',
      competencia: '2026-03-01',
    });
    expect(criado.dataPagamento).toBeNull();
    expect(criado.competencia).toBe('2026-03-01');
    expect(criado.origem).toBe('das');
  });

  it('rejeita valor não positivo, data inválida e descrição vazia com ValidationError', async () => {
    await expect(
      criarLancamentoInterno(ctx.database.db, a.tenantId, {
        tipo: 'receita',
        data: '2026-02-30',
        valor: 0,
        descricao: '',
        categoriaId: receitaA.id,
        formaPagamento: 'pix',
        status: 'pago',
        origem: 'manual',
      }),
    ).rejects.toMatchObject({
      constructor: ValidationError,
      details: expect.arrayContaining([
        expect.objectContaining({ campo: 'valor' }),
        expect.objectContaining({ campo: 'data' }),
        expect.objectContaining({ campo: 'descricao' }),
      ]),
    });
  });

  it('categoria de outro tipo → UnprocessableError', async () => {
    await expect(
      criarLancamentoInterno(ctx.database.db, a.tenantId, {
        tipo: 'despesa',
        data: '2026-03-10',
        valor: 100,
        descricao: 'errado',
        categoriaId: receitaA.id,
        formaPagamento: 'pix',
        status: 'pago',
        origem: 'manual',
      }),
    ).rejects.toBeInstanceOf(UnprocessableError);
  });

  it('categoria de outro tenant → NotFoundError (nunca vaza)', async () => {
    await expect(
      criarLancamentoInterno(ctx.database.db, b.tenantId, {
        tipo: 'receita',
        data: '2026-03-10',
        valor: 100,
        descricao: 'cross-tenant',
        categoriaId: receitaA.id,
        formaPagamento: 'pix',
        status: 'pago',
        origem: 'manual',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('contato inexistente → NotFoundError', async () => {
    await expect(
      criarLancamentoInterno(ctx.database.db, a.tenantId, {
        tipo: 'receita',
        data: '2026-03-10',
        valor: 100,
        descricao: 'sem contato',
        categoriaId: receitaA.id,
        contatoId: '00000000-0000-4000-8000-000000000000',
        formaPagamento: 'pix',
        status: 'pago',
        origem: 'manual',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('excluirLancamentoInterno faz soft delete e some das leituras scoped', async () => {
    const criado = await criarLancamentoInterno(ctx.database.db, a.tenantId, {
      tipo: 'receita',
      data: '2026-03-11',
      valor: 999,
      descricao: 'a excluir',
      categoriaId: receitaA.id,
      formaPagamento: 'pix',
      status: 'pago',
      origem: 'manual',
    });
    // Outro tenant não consegue excluir
    await expect(
      excluirLancamentoInterno(ctx.database.db, b.tenantId, criado.id),
    ).rejects.toBeInstanceOf(NotFoundError);

    await excluirLancamentoInterno(ctx.database.db, a.tenantId, criado.id);
    const [bruto] = await ctx.database.db
      .select()
      .from(lancamentos)
      .where(eq(lancamentos.id, criado.id));
    expect(bruto!.deletedAt).not.toBeNull();

    const tdb = forTenant(ctx.database.db, a.tenantId);
    expect(await tdb.findByIdOrNull(lancamentos, criado.id)).toBeNull();
    expect(
      await tdb.findByIdOrNull(lancamentos, criado.id, { incluirExcluidos: true }),
    ).not.toBeNull();
    await expect(
      excluirLancamentoInterno(ctx.database.db, a.tenantId, criado.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
