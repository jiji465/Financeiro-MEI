import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { lancamentos } from '../../db/schema/lancamentos.js';
import { notasFiscais } from '../../db/schema/notas-fiscais.js';
import { parcelas, titulos } from '../../db/schema/titulos.js';
import { criarHoje } from '../../lib/hoje.js';
import { criarLancamentoInterno } from '../lancamentos/core.js';

const URL = '/api/v1/contatos';
const HOJE = '2026-06-15';

interface Contato {
  id: string;
  tipo: 'cliente' | 'fornecedor' | 'ambos';
  nome: string;
  documento: string | null;
  tipoDocumento: 'cpf' | 'cnpj' | null;
  email: string | null;
  telefone: string | null;
  endereco: Record<string, string | null>;
  observacoes: string | null;
  ativo: boolean;
  createdAt: string;
}

interface Lista<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

describe('contatos', () => {
  let ctx: TestApp;
  let s: TenantSession;
  let categoriaReceita: string;
  let categoriaDespesa: string;

  const listar = async (query = '') =>
    (await injectComo(ctx.app, s, { method: 'GET', url: `${URL}${query}` })).json<Lista<Contato>>();

  const criar = async (payload: Record<string, unknown>) => {
    const res = await injectComo(ctx.app, s, { method: 'POST', url: URL, payload });
    if (res.statusCode !== 201) throw new Error(`criar contato: ${res.body}`);
    return res.json<{ data: Contato }>().data;
  };

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

  it('sem token → 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: URL });
    expect(res.statusCode).toBe(401);
  });

  it('lista vazia com meta de paginação', async () => {
    const lista = await listar();
    expect(lista).toEqual({ data: [], meta: { page: 1, pageSize: 50, total: 0 } });
  });

  it('POST cria com documento normalizado, e-mail em minúsculas e endereço', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: {
        tipo: 'cliente',
        nome: '  Maria da Silva ',
        documento: '529.982.247-25',
        email: 'Maria@Exemplo.com.br',
        telefone: '(11) 98765-4321',
        endereco: {
          logradouro: 'Rua das Flores',
          numero: '10',
          bairro: 'Centro',
          cidade: 'São Paulo',
          uf: 'SP',
          cep: '01310-100',
        },
        observacoes: 'Paga sempre em dia',
      },
    });
    expect(res.statusCode).toBe(201);
    const c = res.json<{ data: Contato }>().data;
    expect(c).toMatchObject({
      tipo: 'cliente',
      nome: 'Maria da Silva',
      documento: '52998224725',
      tipoDocumento: 'cpf',
      email: 'maria@exemplo.com.br',
      telefone: '11987654321',
      endereco: {
        logradouro: 'Rua das Flores',
        numero: '10',
        complemento: null,
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01310100',
      },
      observacoes: 'Paga sempre em dia',
      ativo: true,
    });
    expect(c.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('aceita CNPJ (inclusive alfanumérico) e contato sem documento', async () => {
    const cnpj = await criar({
      tipo: 'fornecedor',
      nome: 'Papelaria',
      documento: '11.222.333/0001-81',
    });
    expect(cnpj).toMatchObject({ documento: '11222333000181', tipoDocumento: 'cnpj' });

    const semDoc = await criar({ tipo: 'ambos', nome: 'Zé do Frete' });
    expect(semDoc).toMatchObject({ documento: null, tipoDocumento: null, email: null });
    expect(semDoc.endereco).toEqual({
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
      cep: null,
    });
  });

  it('CPF/CNPJ com dígito errado → 400 campo documento; formato errado também', async () => {
    const cpf = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { tipo: 'cliente', nome: 'Inválido', documento: '529.982.247-26' },
    });
    expect(cpf.statusCode).toBe(400);
    expect(cpf.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR', details: [{ campo: 'documento' }] },
    });
    expect(cpf.json().error.details[0].mensagem).toMatch(/CPF inválido/);

    const cnpj = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { tipo: 'cliente', nome: 'Inválido', documento: '11.222.333/0001-80' },
    });
    expect(cnpj.statusCode).toBe(400);
    expect(cnpj.json().error.details[0]).toMatchObject({ campo: 'documento' });
    expect(cnpj.json().error.details[0].mensagem).toMatch(/CNPJ inválido/);

    const formato = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { tipo: 'cliente', nome: 'Inválido', documento: '123' },
    });
    expect(formato.statusCode).toBe(400);
    expect(formato.json().error.details[0].campo).toBe('documento');

    // Nome curto e tipo inválido também são barrados pelo schema
    const nome = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { tipo: 'parceiro', nome: 'A' },
    });
    expect(nome.statusCode).toBe(400);
    const campos = (nome.json().error.details as { campo: string }[]).map((d) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['tipo', 'nome']));
  });

  it('documento duplicado no mesmo MEI → 409 campo documento (com máscara diferente)', async () => {
    const dup = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { tipo: 'fornecedor', nome: 'Outra Maria', documento: '52998224725' },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toMatchObject({
      error: { code: 'CONFLICT', details: [{ campo: 'documento' }] },
    });
    expect(dup.json().error.message).toContain('Maria da Silva');

    // Outro MEI pode cadastrar o mesmo documento
    const outro = await signupTenant(ctx.app);
    const res = await injectComo(ctx.app, outro, {
      method: 'POST',
      url: URL,
      payload: { tipo: 'cliente', nome: 'Maria em outro MEI', documento: '52998224725' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('GET /:id, PATCH (documento novo, limpar endereço, inativar) e 404/400', async () => {
    const criado = await criar({
      tipo: 'cliente',
      nome: 'Carlos Editável',
      documento: '123.456.789-09',
      endereco: { cidade: 'Campinas', uf: 'SP' },
    });

    const get = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${criado.id}` });
    expect(get.statusCode).toBe(200);
    expect(get.json().data.id).toBe(criado.id);

    const patch = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${criado.id}`,
      payload: {
        nome: 'Carlos Editado',
        tipo: 'ambos',
        documento: '11.444.777/0001-61',
        email: null,
        endereco: {},
        observacoes: '',
      },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data).toMatchObject({
      nome: 'Carlos Editado',
      tipo: 'ambos',
      documento: '11444777000161',
      tipoDocumento: 'cnpj',
      email: null,
      observacoes: null,
      endereco: { cidade: null, uf: null },
    });

    // Mesmo documento no próprio registro não conflita
    const mesmo = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${criado.id}`,
      payload: { documento: '11444777000161' },
    });
    expect(mesmo.statusCode).toBe(200);

    // Documento de outro contato → 409
    const conflito = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${criado.id}`,
      payload: { documento: '11222333000181' },
    });
    expect(conflito.statusCode).toBe(409);
    expect(conflito.json().error.details[0].campo).toBe('documento');

    // Documento inválido no PATCH → 400
    const invalido = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${criado.id}`,
      payload: { documento: '11444777000160' },
    });
    expect(invalido.statusCode).toBe(400);

    // Limpar documento com null
    const limpar = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${criado.id}`,
      payload: { documento: null },
    });
    expect(limpar.json().data).toMatchObject({ documento: null, tipoDocumento: null });

    // Inativar: some da lista padrão, aparece em ?ativo=false
    const inativar = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${criado.id}`,
      payload: { ativo: false },
    });
    expect(inativar.json().data.ativo).toBe(false);
    expect((await listar()).data.some((c) => c.id === criado.id)).toBe(false);
    const inativos = await listar('?ativo=false');
    expect(inativos.data.map((c) => c.id)).toEqual([criado.id]);

    const naoExiste = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/00000000-0000-4000-8000-000000000000`,
    });
    expect(naoExiste.statusCode).toBe(404);
    const idInvalido = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/nao-uuid` });
    expect(idInvalido.statusCode).toBe(400);
  });

  it('filtros: ?tipo= inclui "ambos", ?busca= por nome/documento/e-mail, ordenação e paginação', async () => {
    const clientes = await listar('?tipo=cliente');
    expect(clientes.data.map((c) => c.nome).sort()).toEqual(['Maria da Silva', 'Zé do Frete']);
    const fornecedores = await listar('?tipo=fornecedor');
    expect(fornecedores.data.map((c) => c.nome).sort()).toEqual(['Papelaria', 'Zé do Frete']);
    const ambos = await listar('?tipo=ambos');
    expect(ambos.data.map((c) => c.nome)).toEqual(['Zé do Frete']);

    expect((await listar('?busca=maria')).data.map((c) => c.nome)).toEqual(['Maria da Silva']);
    expect((await listar('?busca=529.982')).data.map((c) => c.nome)).toEqual(['Maria da Silva']);
    expect((await listar('?busca=EXEMPLO.COM')).data.map((c) => c.nome)).toEqual([
      'Maria da Silva',
    ]);
    expect((await listar('?busca=%25')).data).toEqual([]);

    const porNome = await listar();
    expect(porNome.data.map((c) => c.nome)).toEqual(['Maria da Silva', 'Papelaria', 'Zé do Frete']);
    const desc = await listar('?ordenarPor=createdAt&ordem=desc');
    expect(desc.data.map((c) => c.nome)).toEqual(['Zé do Frete', 'Papelaria', 'Maria da Silva']);

    const pagina = await listar('?pageSize=2&page=2');
    expect(pagina.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
    expect(pagina.data.map((c) => c.nome)).toEqual(['Zé do Frete']);

    const invalido = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}?tipo=parceiro` });
    expect(invalido.statusCode).toBe(400);
  });

  it('GET /opcoes devolve lista enxuta (sem meta), só ativos, filtrável por tipo', async () => {
    const res = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/opcoes?tipo=cliente` });
    expect(res.statusCode).toBe(200);
    const corpo = res.json<{ data: Record<string, unknown>[]; meta?: unknown }>();
    expect(corpo).not.toHaveProperty('meta');
    expect(corpo.data.map((c) => c.nome)).toEqual(['Maria da Silva', 'Zé do Frete']);
    expect(Object.keys(corpo.data[0]!).sort()).toEqual(['documento', 'id', 'nome', 'tipo']);
    const busca = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/opcoes?busca=pape` });
    expect(busca.json().data.map((c: { nome: string }) => c.nome)).toEqual(['Papelaria']);
  });

  it('histórico e resumo: lançamentos, parcelas em aberto e notas do contato', async () => {
    const contato = await criar({ tipo: 'ambos', nome: 'Cliente com histórico' });
    const outro = await criar({ tipo: 'cliente', nome: 'Outro cliente' });
    const db = ctx.database.db;
    const base = {
      categoriaId: categoriaReceita,
      formaPagamento: 'pix' as const,
      origem: 'manual' as const,
      contatoId: contato.id,
    };
    await criarLancamentoInterno(db, s.tenantId, {
      ...base,
      tipo: 'receita',
      data: '2026-01-10',
      valor: 100_00,
      descricao: 'Venda janeiro',
      status: 'pago',
    });
    await criarLancamentoInterno(db, s.tenantId, {
      ...base,
      tipo: 'receita',
      data: '2026-05-20',
      valor: 250_00,
      descricao: 'Venda maio',
      status: 'pago',
    });
    // Pendente vencido (antes de HOJE) → a receber e atrasado
    await criarLancamentoInterno(db, s.tenantId, {
      ...base,
      tipo: 'receita',
      data: '2026-06-01',
      valor: 40_00,
      descricao: 'Receita pendente atrasada',
      status: 'pendente',
    });
    // Pendente futuro → só a receber
    await criarLancamentoInterno(db, s.tenantId, {
      ...base,
      tipo: 'receita',
      data: '2026-07-01',
      valor: 60_00,
      descricao: 'Receita pendente futura',
      status: 'pendente',
    });
    await criarLancamentoInterno(db, s.tenantId, {
      ...base,
      categoriaId: categoriaDespesa,
      tipo: 'despesa',
      data: '2026-03-05',
      valor: 30_00,
      descricao: 'Compra',
      status: 'pago',
    });
    await criarLancamentoInterno(db, s.tenantId, {
      ...base,
      categoriaId: categoriaDespesa,
      tipo: 'despesa',
      data: '2026-06-10',
      valor: 20_00,
      descricao: 'Despesa pendente atrasada',
      status: 'pendente',
    });
    // Lançamento excluído não conta
    const excluido = await criarLancamentoInterno(db, s.tenantId, {
      ...base,
      tipo: 'receita',
      data: '2026-04-01',
      valor: 999_00,
      descricao: 'Excluído',
      status: 'pago',
    });
    await db
      .update(lancamentos)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(lancamentos.id, excluido.id));
    // Lançamento de outro contato não conta
    await criarLancamentoInterno(db, s.tenantId, {
      ...base,
      contatoId: outro.id,
      tipo: 'receita',
      data: '2026-02-02',
      valor: 500_00,
      descricao: 'De outro',
      status: 'pago',
    });

    // Título a receber com 2 parcelas abertas (uma vencida) + título a pagar
    const [tituloReceber] = await db
      .insert(titulos)
      .values({
        tenantId: s.tenantId,
        tipo: 'receber',
        descricao: 'Parcelado',
        contatoId: contato.id,
        categoriaId: categoriaReceita,
        valorTotal: 300_00,
        numeroParcelas: 3,
        dataEmissao: '2026-05-01',
      })
      .returning();
    await db.insert(parcelas).values([
      {
        tenantId: s.tenantId,
        tituloId: tituloReceber!.id,
        numero: 1,
        vencimento: '2026-05-01',
        valor: 100_00,
        status: 'paga',
      },
      {
        tenantId: s.tenantId,
        tituloId: tituloReceber!.id,
        numero: 2,
        vencimento: '2026-06-01',
        valor: 100_00,
        status: 'aberta',
      },
      {
        tenantId: s.tenantId,
        tituloId: tituloReceber!.id,
        numero: 3,
        vencimento: '2026-07-01',
        valor: 100_00,
        status: 'aberta',
      },
    ]);
    const [tituloPagar] = await db
      .insert(titulos)
      .values({
        tenantId: s.tenantId,
        tipo: 'pagar',
        descricao: 'Fornecimento',
        contatoId: contato.id,
        categoriaId: categoriaDespesa,
        valorTotal: 80_00,
        numeroParcelas: 1,
        dataEmissao: '2026-06-01',
      })
      .returning();
    await db.insert(parcelas).values({
      tenantId: s.tenantId,
      tituloId: tituloPagar!.id,
      numero: 1,
      vencimento: '2026-08-01',
      valor: 80_00,
      status: 'aberta',
    });
    await db.insert(notasFiscais).values([
      {
        tenantId: s.tenantId,
        tipo: 'nfse',
        numero: '1',
        dataEmissao: '2026-05-20',
        contatoId: contato.id,
        valor: 250_00,
      },
      {
        tenantId: s.tenantId,
        tipo: 'nfse',
        numero: '2',
        dataEmissao: '2026-05-21',
        contatoId: contato.id,
        valor: 10_00,
        deletedAt: new Date().toISOString(),
      },
    ]);

    // Histórico completo, ordenado por data desc, com categoria e contato embutidos
    const historico = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/${contato.id}/lancamentos`,
    });
    expect(historico.statusCode).toBe(200);
    const corpo = historico.json<{
      data: {
        descricao: string;
        data: string;
        categoria: { id: string; nome: string } | null;
        contato: { id: string; nome: string; tipo: string } | null;
      }[];
      meta: { total: number };
      totais: { receitas: number; despesas: number; saldo: number };
    }>();
    expect(corpo.meta.total).toBe(6);
    expect(corpo.data.map((l) => l.descricao)).toEqual([
      'Receita pendente futura',
      'Despesa pendente atrasada',
      'Receita pendente atrasada',
      'Venda maio',
      'Compra',
      'Venda janeiro',
    ]);
    expect(corpo.data[0]?.categoria?.id).toBe(categoriaReceita);
    expect(corpo.data[0]?.contato).toEqual({ id: contato.id, nome: contato.nome, tipo: 'ambos' });
    expect(corpo.totais).toEqual({ receitas: 450_00, despesas: 50_00, saldo: 400_00 });

    // Período e paginação
    const periodo = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/${contato.id}/lancamentos?de=2026-03-01&ate=2026-05-31&pageSize=1&page=2`,
    });
    const p = periodo.json<{ data: { descricao: string }[]; meta: { total: number } }>();
    expect(p.meta.total).toBe(2);
    expect(p.data.map((l) => l.descricao)).toEqual(['Compra']);
    const periodoInvalido = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/${contato.id}/lancamentos?de=2026-05-31&ate=2026-03-01`,
    });
    expect(periodoInvalido.statusCode).toBe(400);

    // Resumo
    const resumo = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/${contato.id}/resumo`,
    });
    expect(resumo.statusCode).toBe(200);
    expect(resumo.json().data).toEqual({
      contatoId: contato.id,
      totalReceitas: 350_00,
      totalDespesas: 30_00,
      saldo: 320_00,
      quantidadeLancamentos: 6,
      primeiroLancamento: '2026-01-10',
      ultimoLancamento: '2026-07-01',
      aReceber: 40_00 + 60_00 + 100_00 + 100_00,
      aPagar: 20_00 + 80_00,
      atrasadoReceber: 40_00 + 100_00,
      atrasadoPagar: 20_00,
      notasFiscais: 1,
    });

    // Contato sem nada → zeros
    const vazio = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/${outro.id}/resumo`,
    });
    expect(vazio.json().data).toMatchObject({
      totalReceitas: 500_00,
      totalDespesas: 0,
      quantidadeLancamentos: 1,
      aReceber: 0,
      aPagar: 0,
      notasFiscais: 0,
    });
    const semNada = await criar({ tipo: 'cliente', nome: 'Sem movimento' });
    const zeros = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/${semNada.id}/resumo`,
    });
    expect(zeros.json().data).toMatchObject({
      totalReceitas: 0,
      saldo: 0,
      quantidadeLancamentos: 0,
      primeiroLancamento: null,
      ultimoLancamento: null,
    });

    const historicoInexistente = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `${URL}/00000000-0000-4000-8000-000000000000/lancamentos`,
    });
    expect(historicoInexistente.statusCode).toBe(404);
  });

  it('DELETE faz soft delete: some das listas/opções, 404 depois, lançamentos permanecem', async () => {
    const contato = await criar({
      tipo: 'fornecedor',
      nome: 'Para excluir',
      documento: '98765432100',
    });
    await criarLancamentoInterno(ctx.database.db, s.tenantId, {
      tipo: 'despesa',
      data: '2026-06-01',
      valor: 10_00,
      descricao: 'Compra do excluído',
      categoriaId: categoriaDespesa,
      contatoId: contato.id,
      formaPagamento: 'pix',
      status: 'pago',
      origem: 'manual',
    });

    const del = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${contato.id}` });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toEqual({ data: { ok: true } });

    expect((await listar()).data.some((c) => c.id === contato.id)).toBe(false);
    expect((await listar('?ativo=false')).data.some((c) => c.id === contato.id)).toBe(false);
    const opcoes = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/opcoes` });
    expect(opcoes.json().data.some((c: { id: string }) => c.id === contato.id)).toBe(false);

    for (const url of [
      `${URL}/${contato.id}`,
      `${URL}/${contato.id}/resumo`,
      `${URL}/${contato.id}/lancamentos`,
    ]) {
      const res = await injectComo(ctx.app, s, { method: 'GET', url });
      expect(res.statusCode, url).toBe(404);
    }
    const patch = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: `${URL}/${contato.id}`,
      payload: { nome: 'Ressuscitado' },
    });
    expect(patch.statusCode).toBe(404);
    const del2 = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${contato.id}` });
    expect(del2.statusCode).toBe(404);

    // O documento fica livre para um novo cadastro
    const novo = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { tipo: 'fornecedor', nome: 'Recadastrado', documento: '98765432100' },
    });
    expect(novo.statusCode).toBe(201);

    // O lançamento continua existindo e apontando para o contato excluído
    const linhas = await ctx.database.db
      .select({ contatoId: lancamentos.contatoId, deletedAt: lancamentos.deletedAt })
      .from(lancamentos)
      .where(eq(lancamentos.contatoId, contato.id));
    expect(linhas).toEqual([{ contatoId: contato.id, deletedAt: null }]);
  });
});
