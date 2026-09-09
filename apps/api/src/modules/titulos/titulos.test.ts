// Contas a pagar/receber: parcelamento (Σ = total), baixa cria lançamento consistente,
// estorno restaura, cancelamento, filtros de parcelas e resumo.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { contatos } from '../../db/schema/contatos.js';
import { lancamentos } from '../../db/schema/lancamentos.js';
import { criarHoje } from '../../lib/hoje.js';

const HOJE = '2026-03-15';

interface Cat {
  id: string;
  tipo: 'receita' | 'despesa';
  nome: string;
}

interface Parcela {
  id: string;
  numero: number;
  vencimento: string;
  valor: number;
  status: string;
  lancamentoId: string | null;
  dataPagamento: string | null;
  valorPago: number | null;
  atrasada: boolean;
  diasAtraso: number;
}

interface Titulo {
  id: string;
  tipo: string;
  status: string;
  valorTotal: number;
  numeroParcelas: number;
  valorPago: number;
  valorAberto: number;
  contato: { id: string; nome: string } | null;
  categoria: { id: string; nome: string } | null;
  parcelas: Parcela[];
}

describe('titulos e parcelas', () => {
  let ctx: TestApp;
  let s: TenantSession;
  let despesa: Cat;
  let receita: Cat;
  let contatoId: string;

  const post = (url: string, payload: Record<string, unknown>) =>
    injectComo(ctx.app, s, { method: 'POST', url: `/api/v1${url}`, payload });
  const get = (url: string) => injectComo(ctx.app, s, { method: 'GET', url: `/api/v1${url}` });

  async function criarTitulo(extra: Record<string, unknown> = {}): Promise<Titulo> {
    const res = await post('/titulos', {
      tipo: 'pagar',
      descricao: 'Fornecedor X',
      categoriaId: despesa.id,
      contatoId,
      valorTotal: 10_000,
      dataEmissao: '2026-03-01',
      parcelas: { quantidade: 3, primeiroVencimento: '2026-03-31' },
      ...extra,
    });
    if (res.statusCode !== 201) throw new Error(`criarTitulo: ${res.body}`);
    return res.json<{ data: Titulo }>().data;
  }

  beforeAll(async () => {
    ctx = await buildTestApp({}, { hoje: criarHoje(HOJE) });
    s = await signupTenant(ctx.app, { atividade: 'comercio_servicos' });
    const cats = (await get('/categorias')).json<{ data: Cat[] }>().data;
    despesa = cats.find((c) => c.tipo === 'despesa' && !c.nome.includes('DAS'))!;
    receita = cats.find((c) => c.tipo === 'receita')!;
    // O módulo contatos (WP1) é paralelo: inserimos o contato direto no banco.
    const [contato] = await ctx.database.db
      .insert(contatos)
      .values({ tenantId: s.tenantId, tipo: 'fornecedor', nome: 'Distribuidora Alfa' })
      .returning();
    contatoId = contato!.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('sem token → 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/titulos' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /titulos por quantidade: parcelas mensais com clamp de fim de mês e Σ = total', async () => {
    const t = await criarTitulo();
    expect(t.status).toBe('aberto');
    expect(t.numeroParcelas).toBe(3);
    expect(t.parcelas.map((p) => p.vencimento)).toEqual(['2026-03-31', '2026-04-30', '2026-05-31']);
    expect(t.parcelas.map((p) => p.valor)).toEqual([3_333, 3_333, 3_334]);
    expect(t.parcelas.reduce((acc, p) => acc + p.valor, 0)).toBe(t.valorTotal);
    expect(t.valorAberto).toBe(10_000);
    expect(t.valorPago).toBe(0);
    expect(t.contato?.nome).toBe('Distribuidora Alfa');
    expect(t.categoria?.id).toBe(despesa.id);
    expect(t.parcelas.every((p) => !p.atrasada)).toBe(true);
  });

  it('POST /titulos por lista manual: usa os valores informados; soma diferente → 400', async () => {
    const t = await criarTitulo({
      valorTotal: 5_000,
      parcelas: {
        lista: [
          { vencimento: '2026-04-10', valor: 2_000 },
          { vencimento: '2026-05-10', valor: 3_000 },
        ],
      },
    });
    expect(t.parcelas.map((p) => [p.numero, p.valor])).toEqual([
      [1, 2_000],
      [2, 3_000],
    ]);

    const errada = await post('/titulos', {
      tipo: 'pagar',
      descricao: 'Errada',
      categoriaId: despesa.id,
      valorTotal: 5_000,
      parcelas: { lista: [{ vencimento: '2026-04-10', valor: 2_000 }] },
    });
    expect(errada.statusCode).toBe(400);
    expect(errada.json().error.details[0].campo).toBe('parcelas.lista');
  });

  it('valida referências: categoria do tipo errado → 422; contato/categoria inexistentes → 404', async () => {
    const tipoErrado = await post('/titulos', {
      tipo: 'pagar',
      descricao: 'X',
      categoriaId: receita.id,
      valorTotal: 100,
      parcelas: { quantidade: 1, primeiroVencimento: '2026-04-01' },
    });
    expect(tipoErrado.statusCode).toBe(422);
    expect(tipoErrado.json().error.details[0].campo).toBe('categoriaId');

    const semContato = await post('/titulos', {
      tipo: 'pagar',
      descricao: 'X',
      categoriaId: despesa.id,
      contatoId: '00000000-0000-4000-8000-000000000000',
      valorTotal: 100,
      parcelas: { quantidade: 1, primeiroVencimento: '2026-04-01' },
    });
    expect(semContato.statusCode).toBe(404);
  });

  it('baixa cria lançamento consistente (despesa, origem baixa, categoria/contato do título) e quita o título na última parcela', async () => {
    const t = await criarTitulo({
      descricao: 'Aluguel',
      valorTotal: 2_000,
      parcelas: { quantidade: 2, primeiroVencimento: '2026-03-10' },
    });
    const [p1, p2] = t.parcelas;

    const baixa = await post(`/parcelas/${p1!.id}/baixa`, {
      dataPagamento: '2026-03-12',
      formaPagamento: 'boleto',
      observacoes: 'pago no app',
    });
    expect(baixa.statusCode).toBe(201);
    const { parcela, lancamento, titulo } = baixa.json().data;
    expect(parcela).toMatchObject({
      status: 'paga',
      dataPagamento: '2026-03-12',
      valorPago: 1_000,
      formaPagamento: 'boleto',
      lancamentoId: lancamento.id,
    });
    expect(parcela.titulo.descricao).toBe('Aluguel');
    expect(lancamento).toMatchObject({
      tipo: 'despesa',
      origem: 'baixa',
      status: 'pago',
      valor: 1_000,
      data: '2026-03-12',
      dataPagamento: '2026-03-12',
      categoriaId: despesa.id,
      contatoId,
      parcelaId: p1!.id,
      formaPagamento: 'boleto',
      observacoes: 'pago no app',
      descricao: 'Aluguel (1/2)',
    });
    expect(titulo.status).toBe('aberto');
    expect(titulo.valorPago).toBe(1_000);
    expect(titulo.valorAberto).toBe(1_000);

    // Confere no banco: lançamento existe no tenant certo
    const [linha] = await ctx.database.db
      .select()
      .from(lancamentos)
      .where(and(eq(lancamentos.id, lancamento.id), eq(lancamentos.tenantId, s.tenantId)));
    expect(linha?.parcelaId).toBe(p1!.id);

    // Baixar de novo → 422
    const denovo = await post(`/parcelas/${p1!.id}/baixa`, {});
    expect(denovo.statusCode).toBe(422);

    // Última parcela com valor pago diferente → título quitado
    const ultima = await post(`/parcelas/${p2!.id}/baixa`, { valorPago: 950 });
    expect(ultima.statusCode).toBe(201);
    expect(ultima.json().data.titulo.status).toBe('quitado');
    expect(ultima.json().data.titulo.valorPago).toBe(1_950);
    expect(ultima.json().data.lancamento.valor).toBe(950);
    expect(ultima.json().data.parcela.dataPagamento).toBe(HOJE);
  });

  it('estorno exclui o lançamento (soft), reabre a parcela e volta o título para aberto', async () => {
    const t = await criarTitulo({
      tipo: 'receber',
      descricao: 'Serviço',
      categoriaId: receita.id,
      valorTotal: 500,
      parcelas: { quantidade: 1, primeiroVencimento: '2026-03-20' },
    });
    const p = t.parcelas[0]!;
    const baixa = await post(`/parcelas/${p.id}/baixa`, {});
    expect(baixa.statusCode).toBe(201);
    expect(baixa.json().data.lancamento.tipo).toBe('receita');
    expect(baixa.json().data.titulo.status).toBe('quitado');
    const lancamentoId = baixa.json().data.lancamento.id as string;

    const estorno = await injectComo(ctx.app, s, {
      method: 'DELETE',
      url: `/api/v1/parcelas/${p.id}/baixa`,
    });
    expect(estorno.statusCode).toBe(200);
    expect(estorno.json().data).toMatchObject({
      status: 'aberta',
      lancamentoId: null,
      dataPagamento: null,
      valorPago: null,
      formaPagamento: null,
    });
    const [linha] = await ctx.database.db
      .select()
      .from(lancamentos)
      .where(eq(lancamentos.id, lancamentoId));
    expect(linha?.deletedAt).not.toBeNull();

    const titulo = (await get(`/titulos/${t.id}`)).json<{ data: Titulo }>().data;
    expect(titulo.status).toBe('aberto');
    expect(titulo.valorAberto).toBe(500);

    // Estornar parcela aberta → 422; baixar de novo funciona (índice parcial libera o parcela_id)
    const denovo = await injectComo(ctx.app, s, {
      method: 'DELETE',
      url: `/api/v1/parcelas/${p.id}/baixa`,
    });
    expect(denovo.statusCode).toBe(422);
    const rebaixa = await post(`/parcelas/${p.id}/baixa`, {});
    expect(rebaixa.statusCode).toBe(201);
  });

  it('cancelamento: DELETE cancela parcelas abertas; com parcela paga → 422; baixa em cancelada → 422', async () => {
    const t = await criarTitulo({ descricao: 'Cancelável' });
    const del = await injectComo(ctx.app, s, {
      method: 'DELETE',
      url: `/api/v1/titulos/${t.id}`,
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().data.status).toBe('cancelado');
    expect(del.json().data.parcelas.every((p: Parcela) => p.status === 'cancelada')).toBe(true);
    const baixa = await post(`/parcelas/${t.parcelas[0]!.id}/baixa`, {});
    expect(baixa.statusCode).toBe(422);

    const pago = await criarTitulo({ descricao: 'Com paga' });
    await post(`/parcelas/${pago.parcelas[0]!.id}/baixa`, {});
    const negado = await injectComo(ctx.app, s, {
      method: 'DELETE',
      url: `/api/v1/titulos/${pago.id}`,
    });
    expect(negado.statusCode).toBe(422);

    const viaPatch = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `/api/v1/titulos/${pago.id}`,
      payload: { status: 'cancelado' },
    });
    expect(viaPatch.statusCode).toBe(422);
    expect((await get(`/titulos/${pago.id}`)).json().data.status).toBe('aberto');
  });

  it('PATCH /titulos/:id atualiza metadados; PATCH /parcelas/:id só em aberto e mantém Σ = total', async () => {
    const t = await criarTitulo({
      descricao: 'Editável',
      valorTotal: 300,
      parcelas: { quantidade: 3, primeiroVencimento: '2026-04-05' },
    });
    const patch = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `/api/v1/titulos/${t.id}`,
      payload: { descricao: 'Editada', observacoes: 'obs', contatoId: null },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data).toMatchObject({
      descricao: 'Editada',
      observacoes: 'obs',
      contatoId: null,
      contato: null,
    });

    const p = t.parcelas[1]!;
    const alterada = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `/api/v1/parcelas/${p.id}`,
      payload: { vencimento: '2026-05-20', valor: 150 },
    });
    expect(alterada.statusCode).toBe(200);
    expect(alterada.json().data).toMatchObject({ vencimento: '2026-05-20', valor: 150 });
    const titulo = (await get(`/titulos/${t.id}`)).json<{ data: Titulo }>().data;
    expect(titulo.valorTotal).toBe(350);
    expect(titulo.parcelas.reduce((acc, x) => acc + x.valor, 0)).toBe(titulo.valorTotal);

    await post(`/parcelas/${p.id}/baixa`, {});
    const negado = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `/api/v1/parcelas/${p.id}`,
      payload: { valor: 10 },
    });
    expect(negado.statusCode).toBe(422);

    const vazio = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `/api/v1/parcelas/${t.parcelas[0]!.id}`,
      payload: {},
    });
    expect(vazio.statusCode).toBe(400);
  });

  describe('listagem e resumo (tenant isolado com relógio fixo)', () => {
    let s2: TenantSession;
    let despesa2: Cat;
    let receita2: Cat;

    const get2 = (url: string) => injectComo(ctx.app, s2, { method: 'GET', url: `/api/v1${url}` });

    beforeAll(async () => {
      s2 = await signupTenant(ctx.app, { atividade: 'comercio_servicos' });
      const cats = (await get2('/categorias')).json<{ data: Cat[] }>().data;
      despesa2 = cats.find((c) => c.tipo === 'despesa')!;
      receita2 = cats.find((c) => c.tipo === 'receita')!;
      const criar = (payload: Record<string, unknown>) =>
        injectComo(ctx.app, s2, { method: 'POST', url: '/api/v1/titulos', payload });
      // Pagar: vencida (10/03, 500), hoje (15/03, 700), em 10 dias (25/03, 900), em 60 dias (14/05, 1100)
      await criar({
        tipo: 'pagar',
        descricao: 'Luz',
        categoriaId: despesa2.id,
        valorTotal: 3_200,
        parcelas: {
          lista: [
            { vencimento: '2026-03-10', valor: 500 },
            { vencimento: '2026-03-15', valor: 700 },
            { vencimento: '2026-03-25', valor: 900 },
            { vencimento: '2026-05-14', valor: 1_100 },
          ],
        },
      });
      // Receber: uma vencida (01/03, 400) já paga em 05/03 e uma aberta vencida (12/03, 600)
      const rec = await criar({
        tipo: 'receber',
        descricao: 'Cliente Y',
        categoriaId: receita2.id,
        valorTotal: 1_000,
        parcelas: {
          lista: [
            { vencimento: '2026-03-01', valor: 400 },
            { vencimento: '2026-03-12', valor: 600 },
          ],
        },
      });
      const paga = rec.json<{ data: Titulo }>().data.parcelas[0]!;
      await injectComo(ctx.app, s2, {
        method: 'POST',
        url: `/api/v1/parcelas/${paga.id}/baixa`,
        payload: { dataPagamento: '2026-03-05' },
      });
    });

    it('GET /parcelas filtra por tipo/status/atrasadas/vencimento e devolve totais', async () => {
      const abertas = await get2('/parcelas?tipo=pagar&status=aberta');
      expect(abertas.statusCode).toBe(200);
      const corpo = abertas.json();
      expect(corpo.data.map((p: Parcela) => p.vencimento)).toEqual([
        '2026-03-10',
        '2026-03-15',
        '2026-03-25',
        '2026-05-14',
      ]);
      expect(corpo.totais).toEqual({ valor: 3_200, atrasado: 500 });
      expect(corpo.data[0]).toMatchObject({ atrasada: true, diasAtraso: 5 });
      expect(corpo.data[1]).toMatchObject({ atrasada: false, diasAtraso: 0 });
      expect(corpo.data[0].titulo).toMatchObject({
        descricao: 'Luz',
        tipo: 'pagar',
        contato: null,
      });

      const atrasadas = await get2('/parcelas?atrasadas=true');
      expect(
        atrasadas
          .json()
          .data.map((p: Parcela) => p.valor)
          .sort(),
      ).toEqual([500, 600]);

      const periodo = await get2('/parcelas?vencimentoDe=2026-03-15&vencimentoAte=2026-03-31');
      expect(periodo.json().data.map((p: Parcela) => p.valor)).toEqual([700, 900]);

      const invertido = await get2('/parcelas?vencimentoDe=2026-04-01&vencimentoAte=2026-03-01');
      expect(invertido.statusCode).toBe(400);

      const pagas = await get2('/parcelas?status=paga');
      expect(pagas.json().data).toHaveLength(1);
      expect(pagas.json().data[0].dataPagamento).toBe('2026-03-05');

      // tenant 1 não enxerga nada do tenant 2
      const outro = await get('/parcelas?busca=Luz');
      expect(outro.json().data).toHaveLength(0);
    });

    it('GET /parcelas/resumo?dias=30 separa pagar/receber em atrasadas, próximas, abertas e pagas', async () => {
      const res = await get2('/parcelas/resumo?dias=30');
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual({
        dias: 30,
        pagar: {
          atrasadas: { quantidade: 1, valor: 500 },
          proximas: { quantidade: 2, valor: 1_600 },
          abertas: { quantidade: 4, valor: 3_200 },
          pagasNoPeriodo: { quantidade: 0, valor: 0 },
        },
        receber: {
          atrasadas: { quantidade: 1, valor: 600 },
          proximas: { quantidade: 0, valor: 0 },
          abertas: { quantidade: 1, valor: 600 },
          pagasNoPeriodo: { quantidade: 1, valor: 400 },
        },
      });
      const padrao = await get2('/parcelas/resumo');
      expect(padrao.json().data.dias).toBe(30);
      const invalido = await get2('/parcelas/resumo?dias=0');
      expect(invalido.statusCode).toBe(400);
    });

    it('GET /titulos filtra por tipo/status/busca/período e pagina', async () => {
      const res = await get2('/titulos?tipo=receber');
      expect(res.statusCode).toBe(200);
      expect(res.json().meta).toEqual({ page: 1, pageSize: 50, total: 1 });
      expect(res.json().data[0]).toMatchObject({
        descricao: 'Cliente Y',
        valorPago: 400,
        valorAberto: 600,
      });
      expect(res.json().data[0].parcelas).toHaveLength(2);

      const busca = await get2('/titulos?busca=luz&ordenarPor=valorTotal&ordem=asc');
      expect(busca.json().data).toHaveLength(1);
      const nenhum = await get2('/titulos?de=2027-01-01&ate=2027-12-31');
      expect(nenhum.json().data).toHaveLength(0);
      const pagina = await get2('/titulos?page=2&pageSize=1');
      expect(pagina.json().data).toHaveLength(1);
      expect(pagina.json().meta.total).toBe(2);
    });
  });
});
