// Notas fiscais: número único, gerarReceita cria receita via core (origem nota_fiscal),
// vínculo com lançamento existente, cancelamento com estorno, arquivo e resumo anual.
import { eq } from 'drizzle-orm';
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
import { criarLancamentoInterno } from '../lancamentos/core.js';

const HOJE = '2026-06-10';
const URL = '/api/v1/notas-fiscais';

interface Cat {
  id: string;
  tipo: 'receita' | 'despesa';
  nome: string;
}

interface Nota {
  id: string;
  tipo: string;
  numero: string;
  serie: string | null;
  status: string;
  valor: number;
  lancamentoId: string | null;
  contato: { id: string; nome: string } | null;
  arquivo: { nome: string; mime: string; tamanho: number } | null;
  provedor: string;
  chaveAcesso: string | null;
}

describe('notas fiscais', () => {
  let ctx: TestApp;
  let s: TenantSession;
  let receita: Cat;
  let despesa: Cat;
  let contatoId: string;
  let seq = 100;

  const post = (url: string, payload: Record<string, unknown>) =>
    injectComo(ctx.app, s, { method: 'POST', url, payload });
  const get = (url: string) => injectComo(ctx.app, s, { method: 'GET', url });

  async function registrar(extra: Record<string, unknown> = {}): Promise<{
    nota: Nota;
    lancamento: Record<string, unknown> | null;
  }> {
    seq += 1;
    const res = await post(URL, {
      tipo: 'nfse',
      numero: String(seq),
      dataEmissao: '2026-06-01',
      contatoId,
      valor: 150_000,
      descricao: 'Consultoria financeira',
      ...extra,
    });
    if (res.statusCode !== 201) throw new Error(`registrar: ${res.body}`);
    return res.json().data;
  }

  beforeAll(async () => {
    ctx = await buildTestApp({}, { hoje: criarHoje(HOJE) });
    s = await signupTenant(ctx.app, { atividade: 'servicos' });
    const cats = (await get('/api/v1/categorias')).json<{ data: Cat[] }>().data;
    receita = cats.find((c) => c.tipo === 'receita')!;
    despesa = cats.find((c) => c.tipo === 'despesa')!;
    const [contato] = await ctx.database.db
      .insert(contatos)
      .values({ tenantId: s.tenantId, tipo: 'cliente', nome: 'Cliente Beta' })
      .returning();
    contatoId = contato!.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('POST registra nota manual (série padrão 1) e a devolve com contato', async () => {
    const { nota, lancamento } = await registrar({ chaveAcesso: '1'.repeat(44) });
    expect(nota).toMatchObject({
      tipo: 'nfse',
      serie: '1',
      status: 'emitida',
      valor: 150_000,
      lancamentoId: null,
      provedor: 'manual',
      chaveAcesso: '1'.repeat(44),
      arquivo: null,
    });
    expect(nota.contato?.nome).toBe('Cliente Beta');
    expect(lancamento).toBeNull();
  });

  it('número + série + tipo únicos → 409 (campo numero); outra série/tipo é aceita', async () => {
    const { nota } = await registrar({ numero: '7', serie: 'A' });
    const dup = await post(URL, {
      tipo: 'nfse',
      numero: '7',
      serie: 'A',
      dataEmissao: '2026-06-02',
      valor: 100,
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.details[0].campo).toBe('numero');
    const outraSerie = await post(URL, {
      tipo: 'nfse',
      numero: '7',
      serie: 'B',
      dataEmissao: '2026-06-02',
      valor: 100,
    });
    expect(outraSerie.statusCode).toBe(201);
    const outroTipo = await post(URL, {
      tipo: 'nfe',
      numero: '7',
      serie: 'A',
      dataEmissao: '2026-06-02',
      valor: 100,
    });
    expect(outroTipo.statusCode).toBe(201);
    // PATCH para um número já usado → 409; PATCH normal → 200
    const patchDup = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${outraSerie.json().data.nota.id}`,
      payload: { serie: 'A' },
    });
    expect(patchDup.statusCode).toBe(409);
    const patch = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${nota.id}`,
      payload: { descricao: 'Editada', valor: 200 },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data).toMatchObject({ descricao: 'Editada', valor: 200, numero: '7' });
  });

  it('gerarReceita cria a receita (origem nota_fiscal, paga na emissão) e vincula; exige categoriaId de receita', async () => {
    const semCategoria = await post(URL, {
      tipo: 'nfse',
      numero: '900',
      dataEmissao: '2026-06-03',
      valor: 100,
      gerarReceita: true,
    });
    expect(semCategoria.statusCode).toBe(400);
    expect(semCategoria.json().error.details[0].campo).toBe('categoriaId');

    const tipoErrado = await post(URL, {
      tipo: 'nfse',
      numero: '901',
      dataEmissao: '2026-06-03',
      valor: 100,
      gerarReceita: true,
      categoriaId: despesa.id,
    });
    expect(tipoErrado.statusCode).toBe(422);
    // A transação desfez a nota
    const lista = await get(`${URL}?busca=901`);
    expect(lista.json().data).toHaveLength(0);

    const { nota, lancamento } = await registrar({
      numero: '902',
      gerarReceita: true,
      categoriaId: receita.id,
      dataEmissao: '2026-06-04',
      valor: 80_000,
    });
    expect(lancamento).toMatchObject({
      tipo: 'receita',
      origem: 'nota_fiscal',
      status: 'pago',
      valor: 80_000,
      data: '2026-06-04',
      dataPagamento: '2026-06-04',
      categoriaId: receita.id,
      contatoId,
      descricao: 'Consultoria financeira',
    });
    expect(nota.lancamentoId).toBe(lancamento!.id);
    const [linha] = await ctx.database.db
      .select()
      .from(lancamentos)
      .where(eq(lancamentos.id, lancamento!.id as string));
    expect(linha?.tenantId).toBe(s.tenantId);
  });

  it('lancamentoId vincula uma receita existente; despesa → 422; já vinculada → 409; POST /vincular desvincula', async () => {
    const existente = await criarLancamentoInterno(ctx.database.db, s.tenantId, {
      tipo: 'receita',
      data: '2026-05-20',
      valor: 12_345,
      descricao: 'Receita antiga',
      categoriaId: receita.id,
      formaPagamento: 'pix',
      status: 'pago',
      origem: 'manual',
    });
    const desp = await criarLancamentoInterno(ctx.database.db, s.tenantId, {
      tipo: 'despesa',
      data: '2026-05-20',
      valor: 100,
      descricao: 'Despesa',
      categoriaId: despesa.id,
      formaPagamento: 'pix',
      status: 'pago',
      origem: 'manual',
    });

    const { nota, lancamento } = await registrar({ numero: '910', lancamentoId: existente.id });
    expect(nota.lancamentoId).toBe(existente.id);
    expect(lancamento).toMatchObject({ id: existente.id, descricao: 'Receita antiga' });

    const outra = await post(URL, {
      tipo: 'nfse',
      numero: '911',
      dataEmissao: '2026-06-05',
      valor: 100,
      lancamentoId: existente.id,
    });
    expect(outra.statusCode).toBe(409);
    const comDespesa = await post(URL, {
      tipo: 'nfse',
      numero: '912',
      dataEmissao: '2026-06-05',
      valor: 100,
      lancamentoId: desp.id,
    });
    expect(comDespesa.statusCode).toBe(422);
    const ambos = await post(URL, {
      tipo: 'nfse',
      numero: '913',
      dataEmissao: '2026-06-05',
      valor: 100,
      lancamentoId: existente.id,
      gerarReceita: true,
      categoriaId: receita.id,
    });
    expect(ambos.statusCode).toBe(400);

    const desvincula = await post(`${URL}/${nota.id}/vincular`, { lancamentoId: null });
    expect(desvincula.statusCode).toBe(200);
    expect(desvincula.json().data.lancamentoId).toBeNull();
    const revincula = await post(`${URL}/${nota.id}/vincular`, { lancamentoId: existente.id });
    expect(revincula.json().data.lancamentoId).toBe(existente.id);
    const inexistente = await post(`${URL}/${nota.id}/vincular`, {
      lancamentoId: '00000000-0000-4000-8000-000000000000',
    });
    expect(inexistente.statusCode).toBe(404);
  });

  it('cancelar: status cancelada, data padrão hoje, estornarReceita exclui a receita (soft); repetido → 422', async () => {
    const { nota, lancamento } = await registrar({
      numero: '920',
      gerarReceita: true,
      categoriaId: receita.id,
    });
    const semMotivo = await post(`${URL}/${nota.id}/cancelar`, { motivoCancelamento: 'x' });
    expect(semMotivo.statusCode).toBe(400);

    const cancel = await post(`${URL}/${nota.id}/cancelar`, {
      motivoCancelamento: 'Erro na emissão',
      estornarReceita: true,
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().data.nota).toMatchObject({
      status: 'cancelada',
      dataCancelamento: HOJE,
      motivoCancelamento: 'Erro na emissão',
      lancamentoId: null,
    });
    expect(cancel.json().data.lancamentoVinculado).toEqual({ id: lancamento!.id, excluido: true });
    const [linha] = await ctx.database.db
      .select()
      .from(lancamentos)
      .where(eq(lancamentos.id, lancamento!.id as string));
    expect(linha?.deletedAt).not.toBeNull();

    const denovo = await post(`${URL}/${nota.id}/cancelar`, { motivoCancelamento: 'De novo' });
    expect(denovo.statusCode).toBe(422);
    const patch = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${nota.id}`,
      payload: { valor: 1 },
    });
    expect(patch.statusCode).toBe(422);

    // Sem estorno: receita fica e o vínculo é mantido
    const mantida = await registrar({ numero: '921', gerarReceita: true, categoriaId: receita.id });
    const cancel2 = await post(`${URL}/${mantida.nota.id}/cancelar`, {
      motivoCancelamento: 'Cliente desistiu',
      dataCancelamento: '2026-06-08',
    });
    expect(cancel2.json().data.nota.dataCancelamento).toBe('2026-06-08');
    expect(cancel2.json().data.nota.lancamentoId).toBe(mantida.lancamento!.id);
    expect(cancel2.json().data.lancamentoVinculado).toEqual({
      id: mantida.lancamento!.id,
      excluido: false,
    });
  });

  it('arquivo: upload multipart (PDF), download com content-disposition, tipo inválido → 400, remoção', async () => {
    const { nota } = await registrar({ numero: '930' });
    const semArquivo = await get(`${URL}/${nota.id}/arquivo`);
    expect(semArquivo.statusCode).toBe(404);

    const form = new FormData();
    form.append(
      'arquivo',
      new Blob(['%PDF-1.4 nota'], { type: 'application/pdf' }),
      'nota 930.pdf',
    );
    const upload = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/${nota.id}/arquivo`,
      payload: form,
    });
    expect(upload.statusCode).toBe(200);
    expect(upload.json().data).toEqual({
      nome: 'nota 930.pdf',
      mime: 'application/pdf',
      tamanho: 13,
    });

    const detalhe = await get(`${URL}/${nota.id}`);
    expect(detalhe.json().data.arquivo).toEqual({
      nome: 'nota 930.pdf',
      mime: 'application/pdf',
      tamanho: 13,
    });

    const download = await get(`${URL}/${nota.id}/arquivo`);
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(download.headers['content-disposition']).toContain("filename*=UTF-8''nota%20930.pdf");
    expect(download.body).toBe('%PDF-1.4 nota');

    const invalido = new FormData();
    invalido.append('arquivo', new Blob(['x'], { type: 'text/plain' }), 'x.txt');
    const ruim = await injectComo(ctx.app, s, {
      method: 'POST',
      url: `${URL}/${nota.id}/arquivo`,
      payload: invalido,
    });
    expect(ruim.statusCode).toBe(400);
    expect(ruim.json().error.details[0].campo).toBe('mime');

    const remover = await injectComo(ctx.app, s, {
      method: 'DELETE',
      url: `${URL}/${nota.id}/arquivo`,
    });
    expect(remover.statusCode).toBe(204);
    expect((await get(`${URL}/${nota.id}`)).json().data.arquivo).toBeNull();
  });

  it('DELETE /:id exclui (soft) e some da lista; GET → 404', async () => {
    const { nota } = await registrar({ numero: '940' });
    const del = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${nota.id}` });
    expect(del.statusCode).toBe(204);
    expect((await get(`${URL}/${nota.id}`)).statusCode).toBe(404);
    expect((await get(`${URL}?busca=940`)).json().data).toHaveLength(0);
    // número liberado para nova nota
    const nova = await post(URL, {
      tipo: 'nfse',
      numero: '940',
      dataEmissao: '2026-06-05',
      valor: 100,
    });
    expect(nova.statusCode).toBe(201);
  });

  describe('listagem e resumo em tenant isolado', () => {
    let s2: TenantSession;
    let receita2: Cat;
    const get2 = (url: string) => injectComo(ctx.app, s2, { method: 'GET', url });

    beforeAll(async () => {
      s2 = await signupTenant(ctx.app, { atividade: 'servicos' });
      receita2 = (await get2('/api/v1/categorias'))
        .json<{ data: Cat[] }>()
        .data.find((c) => c.tipo === 'receita')!;
      const criar = (payload: Record<string, unknown>) =>
        injectComo(ctx.app, s2, { method: 'POST', url: URL, payload });
      await criar({
        tipo: 'nfse',
        numero: '1',
        dataEmissao: '2026-01-15',
        valor: 1_000,
        gerarReceita: true,
        categoriaId: receita2.id,
      });
      await criar({ tipo: 'nfse', numero: '2', dataEmissao: '2026-01-20', valor: 2_000 });
      await criar({ tipo: 'nfe', numero: '3', dataEmissao: '2026-03-05', valor: 3_000 });
      const cancelada = await criar({
        tipo: 'nfce',
        numero: '4',
        dataEmissao: '2026-03-10',
        valor: 4_000,
      });
      await injectComo(ctx.app, s2, {
        method: 'POST',
        url: `${URL}/${cancelada.json().data.nota.id}/cancelar`,
        payload: { motivoCancelamento: 'Cancelada no teste' },
      });
      await criar({ tipo: 'nfse', numero: '5', dataEmissao: '2025-12-31', valor: 9_000 });
    });

    it('GET lista com filtros (tipo, status, período, semLancamento, busca) e totais', async () => {
      const todas = await get2(URL);
      expect(todas.statusCode).toBe(200);
      expect(todas.json().meta.total).toBe(5);
      expect(todas.json().totais).toEqual({ valor: 19_000, quantidade: 5 });
      expect(todas.json().data[0].numero).toBe('4'); // dataEmissao desc

      expect((await get2(`${URL}?tipo=nfse`)).json().data).toHaveLength(3);
      expect(
        (await get2(`${URL}?status=cancelada`)).json().data.map((n: Nota) => n.numero),
      ).toEqual(['4']);
      expect(
        (await get2(`${URL}?de=2026-01-01&ate=2026-01-31&ordem=asc`))
          .json()
          .data.map((n: Nota) => n.numero),
      ).toEqual(['1', '2']);
      expect(
        (await get2(`${URL}?semLancamento=true&de=2026-01-01`))
          .json()
          .data.map((n: Nota) => n.numero)
          .sort(),
      ).toEqual(['2', '3', '4']);
      expect((await get2(`${URL}?busca=3`)).json().data.map((n: Nota) => n.numero)).toEqual(['3']);
      expect((await get2(`${URL}?de=2026-02-01&ate=2026-01-01`)).statusCode).toBe(400);

      // tenant 1 não vê as notas do tenant 2
      expect(
        (await get(`${URL}?numero=1&busca=1`)).json().data.every((n: Nota) => n.numero !== '1'),
      ).toBe(true);
    });

    it('GET /resumo?ano agrega emitidas, canceladas, por tipo, por mês e sem lançamento', async () => {
      const res = await get2(`${URL}/resumo?ano=2026`);
      expect(res.statusCode).toBe(200);
      const r = res.json().data;
      expect(r.ano).toBe(2026);
      expect(r.emitidas).toEqual({ quantidade: 3, valor: 6_000 });
      expect(r.canceladas).toEqual({ quantidade: 1, valor: 4_000 });
      expect(r.semLancamento).toEqual({ quantidade: 2, valor: 5_000 });
      expect(r.porTipo).toEqual([
        { tipo: 'nfe', quantidade: 1, valor: 3_000 },
        { tipo: 'nfse', quantidade: 2, valor: 3_000 },
        { tipo: 'nfce', quantidade: 0, valor: 0 },
      ]);
      expect(r.porMes).toHaveLength(12);
      expect(r.porMes[0]).toEqual({ competencia: '2026-01', quantidade: 2, valor: 3_000 });
      expect(r.porMes[2]).toEqual({ competencia: '2026-03', quantidade: 1, valor: 3_000 });
      expect(r.porMes[11]).toEqual({ competencia: '2026-12', quantidade: 0, valor: 0 });

      const padrao = await get2(`${URL}/resumo`);
      expect(padrao.json().data.ano).toBe(2026);
      const anterior = await get2(`${URL}/resumo?ano=2025`);
      expect(anterior.json().data.emitidas).toEqual({ quantidade: 1, valor: 9_000 });
    });
  });
});
