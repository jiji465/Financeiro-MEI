import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { contatos } from '../../db/schema/contatos.js';
import { criarHoje } from '../../lib/hoje.js';
import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { criarLancamentoInterno } from './core.js';
import { montarMultipart } from './testing.js';

const URL = '/api/v1/lancamentos';
const HOJE = '2026-09-09';

interface Cat {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
}

interface Lanc {
  id: string;
  tipo: string;
  data: string;
  valor: number;
  descricao: string;
  status: string;
  dataPagamento: string | null;
  origem: string;
  categoria: { id: string; nome: string; cor: string | null } | null;
  contato: { id: string; nome: string } | null;
  anexo: { nome: string; mime: string; tamanho: number } | null;
  competencia: string | null;
  recorrenciaId: string | null;
  formaPagamento: string | null;
}

interface Lista {
  data: Lanc[];
  meta: { page: number; pageSize: number; total: number };
  totais: { receitas: number; despesas: number; saldo: number };
}

describe('lancamentos', () => {
  let ctx: TestApp;
  let s: TenantSession;
  let receita: Cat;
  let despesa: Cat;
  let clienteId: string;

  const post = (payload: Record<string, unknown>) =>
    injectComo(ctx.app, s, { method: 'POST', url: URL, payload });
  const listar = async (query = '') =>
    (await injectComo(ctx.app, s, { method: 'GET', url: `${URL}${query}` })).json<Lista>();

  beforeAll(async () => {
    ctx = await buildTestApp({}, { hoje: criarHoje(HOJE) });
    s = await signupTenant(ctx.app, { atividade: 'comercio_servicos' });
    const cats = (await injectComo(ctx.app, s, { method: 'GET', url: '/api/v1/categorias' })).json<{
      data: Cat[];
    }>().data;
    receita = cats.find((c) => c.tipo === 'receita')!;
    despesa = cats.find((c) => c.tipo === 'despesa' && c.nome === 'Aluguel')!;
    const [cliente] = await ctx.database.db
      .insert(contatos)
      .values({ tenantId: s.tenantId, tipo: 'cliente', nome: 'Cliente Alfa' })
      .returning();
    clienteId = cliente!.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('sem token → 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: URL });
    expect(res.statusCode).toBe(401);
  });

  it('POST cria receita paga com categoria/contato embutidos e data de pagamento = data', async () => {
    const res = await post({
      tipo: 'receita',
      data: '2026-09-01',
      valor: 150_000,
      descricao: 'Consultoria mensal',
      categoriaId: receita.id,
      contatoId: clienteId,
      formaPagamento: 'pix',
      status: 'pago',
    });
    expect(res.statusCode).toBe(201);
    const l = res.json<{ data: Lanc }>().data;
    expect(l).toMatchObject({
      tipo: 'receita',
      valor: 150_000,
      status: 'pago',
      dataPagamento: '2026-09-01',
      origem: 'manual',
      categoria: { id: receita.id, nome: receita.nome },
      contato: { id: clienteId, nome: 'Cliente Alfa' },
      anexo: null,
    });
  });

  it('POST valida: categoria de outro tipo → 422; pendente com data de pagamento → 400; valor 0 → 400', async () => {
    const tipoErrado = await post({
      tipo: 'despesa',
      data: '2026-09-02',
      valor: 100,
      descricao: 'x',
      categoriaId: receita.id,
    });
    expect(tipoErrado.statusCode).toBe(422);
    expect(tipoErrado.json().error.details[0].campo).toBe('categoriaId');

    const pendente = await post({
      tipo: 'despesa',
      data: '2026-09-02',
      valor: 100,
      descricao: 'x',
      categoriaId: despesa.id,
      status: 'pendente',
      dataPagamento: '2026-09-02',
    });
    expect(pendente.statusCode).toBe(400);
    expect(pendente.json().error.details[0].campo).toBe('dataPagamento');

    const zero = await post({
      tipo: 'despesa',
      data: '2026-09-02',
      valor: 0,
      descricao: 'x',
      categoriaId: despesa.id,
    });
    expect(zero.statusCode).toBe(400);
  });

  it('GET lista com filtros, ordenação, paginação e totais do filtro', async () => {
    await post({
      tipo: 'despesa',
      data: '2026-09-05',
      valor: 80_000,
      descricao: 'Aluguel da sala',
      categoriaId: despesa.id,
      formaPagamento: 'boleto',
      status: 'pendente',
    });
    await post({
      tipo: 'despesa',
      data: '2026-08-05',
      valor: 80_000,
      descricao: 'Aluguel da sala (agosto)',
      categoriaId: despesa.id,
      formaPagamento: 'boleto',
      status: 'pago',
    });

    const todos = await listar('?ordenarPor=data&ordem=asc');
    expect(todos.meta.total).toBe(3);
    expect(todos.data.map((l) => l.data)).toEqual(['2026-08-05', '2026-09-01', '2026-09-05']);
    expect(todos.totais).toEqual({ receitas: 150_000, despesas: 160_000, saldo: -10_000 });

    const setembro = await listar('?de=2026-09-01&ate=2026-09-30');
    expect(setembro.meta.total).toBe(2);
    expect(setembro.totais).toEqual({ receitas: 150_000, despesas: 80_000, saldo: 70_000 });

    expect((await listar('?tipo=receita')).data).toHaveLength(1);
    expect((await listar('?status=pendente')).data.map((l) => l.descricao)).toEqual([
      'Aluguel da sala',
    ]);
    expect((await listar('?busca=AGOSTO')).data).toHaveLength(1);
    expect((await listar(`?contatoId=${clienteId}`)).data).toHaveLength(1);
    expect((await listar('?formaPagamento=boleto')).data).toHaveLength(2);
    expect((await listar(`?categoriaId=${despesa.id}`)).data).toHaveLength(2);

    const pagina = await listar('?pageSize=2&page=2&ordenarPor=valor&ordem=desc');
    expect(pagina.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
    expect(pagina.data).toHaveLength(1);
    // totais continuam sendo do filtro inteiro, não da página
    expect(pagina.totais.receitas).toBe(150_000);

    const invalido = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}?de=2026-09-30&ate=2026-09-01`,
    });
    expect(invalido.statusCode).toBe(400);
  });

  it('GET/PATCH por id: pendente → pago preenche data de pagamento; categoria errada → 422', async () => {
    const pendente = (await listar('?status=pendente')).data[0]!;
    const get = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${pendente.id}` });
    expect(get.statusCode).toBe(200);

    const patch = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${pendente.id}`,
      payload: { status: 'pago', valor: 81_000, descricao: 'Aluguel setembro' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data).toMatchObject({
      status: 'pago',
      dataPagamento: '2026-09-05',
      valor: 81_000,
      descricao: 'Aluguel setembro',
    });

    const volta = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${pendente.id}`,
      payload: { status: 'pendente' },
    });
    expect(volta.json().data.dataPagamento).toBeNull();

    const errada = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${pendente.id}`,
      payload: { categoriaId: receita.id },
    });
    expect(errada.statusCode).toBe(422);

    const naoExiste = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/${randomUUID()}`,
    });
    expect(naoExiste.statusCode).toBe(404);
  });

  it('origem das/baixa: só descrição e observações podem mudar (422 no resto)', async () => {
    const das = await criarLancamentoInterno(ctx.database.db, s.tenantId, {
      tipo: 'despesa',
      data: '2026-09-20',
      valor: 8_605,
      descricao: 'DAS 08/2026',
      categoriaId: despesa.id,
      formaPagamento: 'boleto',
      status: 'pago',
      origem: 'das',
      competencia: '2026-08-01',
    });
    const bloqueado = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${das.id}`,
      payload: { valor: 1, descricao: 'ok' },
    });
    expect(bloqueado.statusCode).toBe(422);
    expect(bloqueado.json().error.details).toEqual([
      { campo: 'valor', mensagem: expect.any(String) },
    ]);

    const permitido = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${das.id}`,
      payload: { descricao: 'DAS agosto', observacoes: 'pago no app' },
    });
    expect(permitido.statusCode).toBe(200);
    expect(permitido.json().data).toMatchObject({
      descricao: 'DAS agosto',
      observacoes: 'pago no app',
      competencia: '2026-08',
    });

    const excluir = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${das.id}` });
    expect(excluir.statusCode).toBe(422);
  });

  it('DELETE: vinculado a parcela → 422; normal → 204 e some da lista', async () => {
    const baixa = await criarLancamentoInterno(ctx.database.db, s.tenantId, {
      tipo: 'receita',
      data: '2026-09-03',
      valor: 500,
      descricao: 'Parcela 1/3',
      categoriaId: receita.id,
      formaPagamento: 'pix',
      status: 'pago',
      origem: 'baixa',
      parcelaId: randomUUID(),
    });
    const bloqueado = await injectComo(ctx.app, s, {
      method: 'DELETE',
      url: `${URL}/${baixa.id}`,
    });
    expect(bloqueado.statusCode).toBe(422);
    expect(bloqueado.json().error.details[0].campo).toBe('parcelaId');

    const criado = await post({
      tipo: 'despesa',
      data: '2026-09-06',
      valor: 1_000,
      descricao: 'temporário',
      categoriaId: despesa.id,
    });
    const id = criado.json().data.id as string;
    const del = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${id}` });
    expect(del.statusCode).toBe(204);
    const depois = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${id}` });
    expect(depois.statusCode).toBe(404);
    expect((await listar('?busca=temporário')).meta.total).toBe(0);
  });

  it('POST /:id/pagar usa hoje como data de pagamento; pagar de novo → 409', async () => {
    const criado = await post({
      tipo: 'receita',
      data: '2026-09-07',
      valor: 2_000,
      descricao: 'a receber',
      categoriaId: receita.id,
      status: 'pendente',
    });
    const id = criado.json().data.id as string;
    const pagar = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/${id}/pagar`,
      payload: { formaPagamento: 'dinheiro' },
    });
    expect(pagar.statusCode).toBe(200);
    expect(pagar.json().data).toMatchObject({
      status: 'pago',
      dataPagamento: HOJE,
      formaPagamento: 'dinheiro',
    });
    const denovo = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/${id}/pagar`,
      payload: {},
    });
    expect(denovo.statusCode).toBe(409);
  });

  it('anexo: upload (multipart) → download com content-type → remoção; mime inválido → 400', async () => {
    const criado = await post({
      tipo: 'despesa',
      data: '2026-09-08',
      valor: 3_000,
      descricao: 'com anexo',
      categoriaId: despesa.id,
    });
    const id = criado.json().data.id as string;
    const conteudo = Buffer.from('%PDF-1.4\n%teste\n');

    const semArquivo = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/${id}/anexo`,
      payload: { x: 1 },
    });
    expect(semArquivo.statusCode).toBe(400);

    const invalido = montarMultipart([
      { nome: 'arquivo', arquivo: { nome: 'nota.txt', mime: 'text/plain', conteudo: 'oi' } },
    ]);
    const mimeRuim = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/${id}/anexo`,
      ...invalido,
    });
    expect(mimeRuim.statusCode).toBe(400);
    expect(mimeRuim.json().error.details[0].campo).toBe('arquivo');

    const ok = montarMultipart([
      { nome: 'arquivo', arquivo: { nome: 'nota fiscal.pdf', mime: 'application/pdf', conteudo } },
    ]);
    const upload = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/${id}/anexo`,
      ...ok,
    });
    expect(upload.statusCode).toBe(200);
    expect(upload.json().data.anexo).toEqual({
      nome: 'nota fiscal.pdf',
      mime: 'application/pdf',
      tamanho: conteudo.length,
    });

    const download = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${id}/anexo` });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(download.headers['content-disposition']).toContain('nota%20fiscal.pdf');
    expect(download.rawPayload.equals(conteudo)).toBe(true);

    const remover = await injectComo(ctx.app, s, {
      method: 'DELETE',
      url: `${URL}/${id}/anexo`,
    });
    expect(remover.statusCode).toBe(204);
    const semAnexo = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${id}/anexo` });
    expect(semAnexo.statusCode).toBe(404);
    const detalhe = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${id}` });
    expect(detalhe.json().data.anexo).toBeNull();
  });

  it('GET /resumo devolve pagos/pendentes por tipo e saldos', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/resumo?de=2026-09-01&ate=2026-09-30`,
    });
    expect(res.statusCode).toBe(200);
    const r = res.json().data;
    expect(r.periodo).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
    expect(r.receitas.quantidade).toBeGreaterThanOrEqual(2);
    expect(r.receitas.total).toBe(r.receitas.pagos + r.receitas.pendentes);
    expect(r.despesas.total).toBe(r.despesas.pagos + r.despesas.pendentes);
    expect(r.saldo).toBe(r.receitas.pagos - r.despesas.pagos);
    expect(r.saldoPrevisto).toBe(r.receitas.total - r.despesas.total);

    const invalido = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/resumo` });
    expect(invalido.statusCode).toBe(400);
  });

  it('POST com recorrência cria a recorrência, o primeiro lançamento e materializa até hoje', async () => {
    const res = await post({
      tipo: 'despesa',
      data: '2026-06-10',
      valor: 12_000,
      descricao: 'Internet',
      categoriaId: despesa.id,
      formaPagamento: 'boleto',
      status: 'pago',
      recorrencia: { diaDoMes: 10 },
    });
    expect(res.statusCode).toBe(201);
    const primeiro = res.json<{ data: Lanc }>().data;
    expect(primeiro).toMatchObject({
      origem: 'recorrencia',
      competencia: '2026-06',
      status: 'pago',
    });
    expect(primeiro.recorrenciaId).toBeTruthy();

    const gerados = await listar(`?origem=recorrencia&ordenarPor=data&ordem=asc&busca=Internet`);
    expect(gerados.data.map((l) => [l.data, l.status])).toEqual([
      ['2026-06-10', 'pago'],
      ['2026-07-10', 'pendente'],
      ['2026-08-10', 'pendente'],
      ['2026-09-10', 'pendente'],
    ]);

    const rec = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `/api/v1/recorrencias/${primeiro.recorrenciaId}`,
    });
    expect(rec.json().data).toMatchObject({
      diaDoMes: 10,
      dataInicio: '2026-06-10',
      ultimaCompetencia: '2026-09',
      ativo: true,
    });

    const gerar = await injectComo(ctx.app, s, {
      method: 'POST',
      url: '/api/v1/recorrencias/gerar',
      payload: {},
    });
    expect(gerar.statusCode).toBe(200);
    expect(gerar.json().data.geradas).toBe(0);

    const fimAntes = await post({
      tipo: 'despesa',
      data: '2026-06-10',
      valor: 1,
      descricao: 'x',
      categoriaId: despesa.id,
      recorrencia: { diaDoMes: 10, dataFim: '2026-05-01' },
    });
    expect(fimAntes.statusCode).toBe(400);
  });
});
