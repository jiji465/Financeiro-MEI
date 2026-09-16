// Contas bancárias: CRUD, nome único por MEI, soft delete e — o miolo — o cálculo do saldo
// (saldo inicial + receitas pagas − despesas pagas da conta, agregado no banco).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { criarHoje } from '../../lib/hoje.js';

const URL = '/api/v1/contas-bancarias';
const HOJE = '2026-06-15';

interface Conta {
  id: string;
  nome: string;
  instituicao: string | null;
  tipo: 'corrente' | 'poupanca' | 'pagamento' | 'dinheiro';
  saldoInicial: number;
  ativo: boolean;
  saldo: number;
  receitas: number;
  despesas: number;
  lancamentos: number;
  createdAt: string;
  updatedAt: string;
}

interface ListaContas {
  data: Conta[];
  totais: { saldoInicial: number; saldo: number };
}

describe('contas bancárias', () => {
  let ctx: TestApp;
  let s: TenantSession;
  let categoriaReceita: string;
  let categoriaDespesa: string;

  const criarConta = async (payload: Record<string, unknown>) => {
    const res = await injectComo(ctx.app, s, { method: 'POST', url: URL, payload });
    if (res.statusCode !== 201) throw new Error(`criar conta: ${res.body}`);
    return res.json<{ data: Conta }>().data;
  };

  const obterConta = async (id: string) => {
    const res = await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${id}` });
    if (res.statusCode !== 200) throw new Error(`obter conta: ${res.body}`);
    return res.json<{ data: Conta }>().data;
  };

  const listarContas = async (query = '') =>
    (await injectComo(ctx.app, s, { method: 'GET', url: `${URL}${query}` })).json<ListaContas>();

  const criarLancamento = async (payload: Record<string, unknown>) => {
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: '/api/v1/lancamentos',
      payload,
    });
    if (res.statusCode !== 201) throw new Error(`criar lançamento: ${res.body}`);
    return res.json<{ data: { id: string } }>().data;
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

  it('lista vazia com totais zerados', async () => {
    expect(await listarContas()).toEqual({ data: [], totais: { saldoInicial: 0, saldo: 0 } });
  });

  it('POST cria a conta e o saldo nasce igual ao saldo inicial', async () => {
    const conta = await criarConta({
      nome: '  Nubank PJ ',
      instituicao: 'Nu Pagamentos S.A.',
      tipo: 'corrente',
      saldoInicial: 250_000,
    });
    expect(conta).toMatchObject({
      nome: 'Nubank PJ',
      instituicao: 'Nu Pagamentos S.A.',
      tipo: 'corrente',
      saldoInicial: 250_000,
      ativo: true,
      saldo: 250_000,
      receitas: 0,
      despesas: 0,
      lancamentos: 0,
    });
    expect(conta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('POST com nome repetido (mesmo em outra caixa) → 409 no campo nome', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { nome: 'nubank pj', tipo: 'poupanca' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: { details: { campo: string }[] } }>().error.details?.[0]?.campo).toBe(
      'nome',
    );
  });

  it('POST usa os padrões (corrente, saldo inicial zero) quando só o nome vem', async () => {
    const conta = await criarConta({ nome: 'Caixa da loja' });
    expect(conta).toMatchObject({
      tipo: 'corrente',
      saldoInicial: 0,
      saldo: 0,
      instituicao: null,
    });
  });

  it('aceita saldo inicial negativo (conta no vermelho)', async () => {
    const conta = await criarConta({ nome: 'Conta no vermelho', saldoInicial: -45_000 });
    expect(conta.saldo).toBe(-45_000);
  });

  it('POST com saldo inicial fracionado → 400 (centavos são inteiros)', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'POST',
      url: URL,
      payload: { nome: 'Fracionada', saldoInicial: 10.5 },
    });
    expect(res.statusCode).toBe(400);
  });

  describe('saldo', () => {
    let conta: Conta;
    let outra: Conta;

    beforeAll(async () => {
      conta = await criarConta({ nome: 'Conta do saldo', tipo: 'corrente', saldoInicial: 100_000 });
      outra = await criarConta({ nome: 'Conta vizinha', tipo: 'dinheiro', saldoInicial: 5_000 });

      // Na conta: +80.000 e +20.000 de receita paga, −30.000 de despesa paga.
      await criarLancamento({
        tipo: 'receita',
        data: '2026-06-01',
        valor: 80_000,
        descricao: 'Venda paga',
        categoriaId: categoriaReceita,
        contaBancariaId: conta.id,
        status: 'pago',
      });
      await criarLancamento({
        tipo: 'receita',
        data: '2026-06-02',
        valor: 20_000,
        descricao: 'Serviço pago',
        categoriaId: categoriaReceita,
        contaBancariaId: conta.id,
        status: 'pago',
      });
      await criarLancamento({
        tipo: 'despesa',
        data: '2026-06-03',
        valor: 30_000,
        descricao: 'Fornecedor pago',
        categoriaId: categoriaDespesa,
        contaBancariaId: conta.id,
        status: 'pago',
      });
      // Pendentes não entram no saldo (previsão, não dinheiro na conta).
      await criarLancamento({
        tipo: 'receita',
        data: '2026-06-20',
        valor: 500_000,
        descricao: 'Receita pendente',
        categoriaId: categoriaReceita,
        contaBancariaId: conta.id,
        status: 'pendente',
      });
      await criarLancamento({
        tipo: 'despesa',
        data: '2026-06-21',
        valor: 700_000,
        descricao: 'Despesa pendente',
        categoriaId: categoriaDespesa,
        contaBancariaId: conta.id,
        status: 'pendente',
      });
      // Lançamento sem conta: não pode entrar em conta nenhuma.
      await criarLancamento({
        tipo: 'receita',
        data: '2026-06-04',
        valor: 999_000,
        descricao: 'Receita sem conta',
        categoriaId: categoriaReceita,
        status: 'pago',
      });
    });

    it('saldo = saldo inicial + receitas pagas − despesas pagas', async () => {
      const atual = await obterConta(conta.id);
      expect(atual.receitas).toBe(100_000);
      expect(atual.despesas).toBe(30_000);
      expect(atual.saldo).toBe(100_000 + 100_000 - 30_000);
      // 3 pagos + 2 pendentes vinculados (a contagem inclui pendentes).
      expect(atual.lancamentos).toBe(5);
    });

    it('não contamina a conta vizinha nem conta lançamentos sem conta', async () => {
      const vizinha = await obterConta(outra.id);
      expect(vizinha).toMatchObject({
        receitas: 0,
        despesas: 0,
        lancamentos: 0,
        saldo: 5_000,
      });
    });

    it('marcar o pendente como pago move o dinheiro para o saldo', async () => {
      const pendente = await criarLancamento({
        tipo: 'receita',
        data: '2026-06-10',
        valor: 11_000,
        descricao: 'Vai virar pago',
        categoriaId: categoriaReceita,
        contaBancariaId: outra.id,
        status: 'pendente',
      });
      expect((await obterConta(outra.id)).saldo).toBe(5_000);

      const res = await injectComo(ctx.app, s, {
        method: 'POST',
        url: `/api/v1/lancamentos/${pendente.id}/pagar`,
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      expect((await obterConta(outra.id)).saldo).toBe(16_000);
    });

    it('excluir o lançamento devolve o saldo (soft delete sai do agregado)', async () => {
      const lancamento = await criarLancamento({
        tipo: 'despesa',
        data: '2026-06-11',
        valor: 6_000,
        descricao: 'Vai ser excluída',
        categoriaId: categoriaDespesa,
        contaBancariaId: outra.id,
        status: 'pago',
      });
      expect((await obterConta(outra.id)).saldo).toBe(10_000);

      const res = await injectComo(ctx.app, s, {
        method: 'DELETE',
        url: `/api/v1/lancamentos/${lancamento.id}`,
      });
      expect(res.statusCode).toBe(204);
      expect((await obterConta(outra.id)).saldo).toBe(16_000);
    });

    it('mudar a conta do lançamento move o valor de uma conta para a outra', async () => {
      const lancamento = await criarLancamento({
        tipo: 'receita',
        data: '2026-06-12',
        valor: 7_000,
        descricao: 'Vai mudar de conta',
        categoriaId: categoriaReceita,
        contaBancariaId: conta.id,
        status: 'pago',
      });
      const antesOrigem = (await obterConta(conta.id)).saldo;
      const antesDestino = (await obterConta(outra.id)).saldo;

      const res = await injectComo(ctx.app, s, {
        method: 'PATCH',
        url: `/api/v1/lancamentos/${lancamento.id}`,
        payload: { contaBancariaId: outra.id },
      });
      expect(res.statusCode).toBe(200);
      expect((await obterConta(conta.id)).saldo).toBe(antesOrigem - 7_000);
      expect((await obterConta(outra.id)).saldo).toBe(antesDestino + 7_000);
    });

    it('editar o saldo inicial desloca o saldo pelo mesmo valor', async () => {
      const antes = (await obterConta(conta.id)).saldo;
      const res = await injectComo(ctx.app, s, {
        method: 'PATCH',
        url: `${URL}/${conta.id}`,
        payload: { saldoInicial: 150_000 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: Conta }>().data.saldo).toBe(antes + 50_000);
    });

    it('a lista soma os saldos das contas devolvidas', async () => {
      const lista = await listarContas();
      const somaData = lista.data.reduce((acc, c) => acc + c.saldo, 0);
      expect(lista.totais.saldo).toBe(somaData);
      expect(lista.totais.saldoInicial).toBe(
        lista.data.reduce((acc, c) => acc + c.saldoInicial, 0),
      );
    });

    it('lançamento apontando para conta inexistente → 404', async () => {
      const res = await injectComo(ctx.app, s, {
        method: 'POST',
        url: '/api/v1/lancamentos',
        payload: {
          tipo: 'receita',
          data: '2026-06-13',
          valor: 1_000,
          descricao: 'Conta fantasma',
          categoriaId: categoriaReceita,
          contaBancariaId: '00000000-0000-4000-8000-000000000000',
          status: 'pago',
        },
      });
      expect(res.statusCode).toBe(404);
    });

    it('GET /lancamentos?contaBancariaId filtra só os daquela conta', async () => {
      const res = await injectComo(ctx.app, s, {
        method: 'GET',
        url: `/api/v1/lancamentos?contaBancariaId=${conta.id}&de=2026-01-01&ate=2026-12-31&pageSize=100`,
      });
      expect(res.statusCode).toBe(200);
      const lista = res.json<{ data: { contaBancariaId: string; descricao: string }[] }>();
      expect(lista.data.length).toBeGreaterThan(0);
      expect(lista.data.every((l) => l.contaBancariaId === conta.id)).toBe(true);
      expect(lista.data.map((l) => l.descricao)).not.toContain('Receita sem conta');
    });

    it('o lançamento devolve a conta bancária resumida junto', async () => {
      const res = await injectComo(ctx.app, s, {
        method: 'GET',
        url: `/api/v1/lancamentos?contaBancariaId=${conta.id}&de=2026-01-01&ate=2026-12-31`,
      });
      const primeiro = res.json<{
        data: { contaBancaria: { id: string; nome: string; tipo: string } | null }[];
      }>().data[0]!;
      expect(primeiro.contaBancaria).toEqual({
        id: conta.id,
        nome: 'Conta do saldo',
        tipo: 'corrente',
      });
    });
  });

  // Regressão: o saldo por conta nasceu lendo só `lancamentos.conta_bancaria_id`, mas os módulos
  // que criam lançamento por conta própria (baixa de parcela, pagamento do DAS, receita de nota)
  // não gravavam a conta — então quitar uma conta a pagar ou pagar o DAS não mexia em saldo nenhum.
  describe('saldo a partir das outras origens de dinheiro', () => {
    it('a baixa de uma parcela debita a conta escolhida', async () => {
      const conta = await criarConta({ nome: 'Conta da baixa', saldoInicial: 100_000 });
      const titulo = (
        await injectComo(ctx.app, s, {
          method: 'POST',
          url: '/api/v1/titulos',
          payload: {
            tipo: 'pagar',
            descricao: 'Fornecedor da baixa',
            categoriaId: categoriaDespesa,
            valorTotal: 30_000,
            dataEmissao: '2026-06-01',
            parcelas: { quantidade: 1, primeiroVencimento: '2026-06-10' },
          },
        })
      ).json<{ data: { parcelas: { id: string }[] } }>().data;

      const baixa = await injectComo(ctx.app, s, {
        method: 'POST',
        url: `/api/v1/parcelas/${titulo.parcelas[0]!.id}/baixa`,
        payload: { contaBancariaId: conta.id },
      });
      expect(baixa.statusCode).toBe(201);
      expect(
        baixa.json<{ data: { lancamento: { contaBancaria: { nome: string } | null } } }>().data
          .lancamento.contaBancaria,
      ).toEqual({ id: conta.id, nome: 'Conta da baixa', tipo: 'corrente' });

      const depois = await obterConta(conta.id);
      expect(depois.despesas).toBe(30_000);
      expect(depois.saldo).toBe(70_000);
    });

    it('o pagamento do DAS debita a conta escolhida', async () => {
      const conta = await criarConta({ nome: 'Conta do DAS', saldoInicial: 50_000 });
      const pagamento = await injectComo(ctx.app, s, {
        method: 'POST',
        url: '/api/v1/obrigacoes/das/2026-05/pagamento',
        payload: { contaBancariaId: conta.id },
      });
      expect(pagamento.statusCode).toBe(201);
      const valorPago = pagamento.json<{ data: { lancamento: { valor: number } } }>().data
        .lancamento.valor;

      const depois = await obterConta(conta.id);
      expect(depois.despesas).toBe(valorPago);
      expect(depois.saldo).toBe(50_000 - valorPago);
    });

    it('a receita gerada pela nota fiscal credita a conta escolhida', async () => {
      const conta = await criarConta({ nome: 'Conta da nota', saldoInicial: 0 });
      const res = await injectComo(ctx.app, s, {
        method: 'POST',
        url: '/api/v1/notas-fiscais',
        payload: {
          tipo: 'nfse',
          numero: '9001',
          dataEmissao: '2026-06-02',
          valor: 80_000,
          gerarReceita: true,
          categoriaId: categoriaReceita,
          contaBancariaId: conta.id,
        },
      });
      expect(res.statusCode).toBe(201);

      const depois = await obterConta(conta.id);
      expect(depois.receitas).toBe(80_000);
      expect(depois.saldo).toBe(80_000);
    });

    it('conta bancária de outro MEI na baixa → 404', async () => {
      const outro = await signupTenant(ctx.app, { email: 'outro-baixa@meifin.com.br' });
      const contaAlheia = (
        await injectComo(ctx.app, outro, {
          method: 'POST',
          url: URL,
          payload: { nome: 'Conta do vizinho' },
        })
      ).json<{ data: Conta }>().data;

      const titulo = (
        await injectComo(ctx.app, s, {
          method: 'POST',
          url: '/api/v1/titulos',
          payload: {
            tipo: 'pagar',
            descricao: 'Fornecedor do vizinho',
            categoriaId: categoriaDespesa,
            valorTotal: 5_000,
            dataEmissao: '2026-06-01',
            parcelas: { quantidade: 1, primeiroVencimento: '2026-06-20' },
          },
        })
      ).json<{ data: { parcelas: { id: string }[] } }>().data;

      const res = await injectComo(ctx.app, s, {
        method: 'POST',
        url: `/api/v1/parcelas/${titulo.parcelas[0]!.id}/baixa`,
        payload: { contaBancariaId: contaAlheia.id },
      });
      expect(res.statusCode).toBe(404);
    });

    it('nota fiscal com conta bancária mas sem gerar receita → 400 no campo', async () => {
      const conta = await criarConta({ nome: 'Conta sem receita' });
      const res = await injectComo(ctx.app, s, {
        method: 'POST',
        url: '/api/v1/notas-fiscais',
        payload: {
          tipo: 'nfse',
          numero: '9002',
          dataEmissao: '2026-06-03',
          valor: 1_000,
          gerarReceita: false,
          contaBancariaId: conta.id,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: { details: { campo: string }[] } }>().error.details[0]!.campo).toBe(
        'contaBancariaId',
      );
    });
  });

  describe('atualização e exclusão', () => {
    it('PATCH renomeia, troca tipo e desativa', async () => {
      const conta = await criarConta({ nome: 'Conta a editar', tipo: 'corrente' });
      const res = await injectComo(ctx.app, s, {
        method: 'PATCH',
        url: `${URL}/${conta.id}`,
        payload: {
          nome: 'Conta editada',
          tipo: 'poupanca',
          instituicao: 'Caixa Econômica',
          ativo: false,
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: Conta }>().data).toMatchObject({
        nome: 'Conta editada',
        tipo: 'poupanca',
        instituicao: 'Caixa Econômica',
        ativo: false,
      });
    });

    it('PATCH com nome de outra conta → 409', async () => {
      const conta = await criarConta({ nome: 'Conta original' });
      const res = await injectComo(ctx.app, s, {
        method: 'PATCH',
        url: `${URL}/${conta.id}`,
        payload: { nome: 'Nubank PJ' },
      });
      expect(res.statusCode).toBe(409);
    });

    it('PATCH com o próprio nome não dispara conflito', async () => {
      const conta = await criarConta({ nome: 'Conta que se mantém' });
      const res = await injectComo(ctx.app, s, {
        method: 'PATCH',
        url: `${URL}/${conta.id}`,
        payload: { nome: 'Conta que se mantém', saldoInicial: 1_000 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: Conta }>().data.saldoInicial).toBe(1_000);
    });

    it('?ativo=true esconde as desativadas e /opcoes também', async () => {
      const conta = await criarConta({ nome: 'Conta desativada' });
      await injectComo(ctx.app, s, {
        method: 'PATCH',
        url: `${URL}/${conta.id}`,
        payload: { ativo: false },
      });
      const ativas = await listarContas('?ativo=true');
      expect(ativas.data.map((c) => c.id)).not.toContain(conta.id);

      const opcoes = (await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/opcoes` })).json<{
        data: { id: string }[];
      }>();
      expect(opcoes.data.map((c) => c.id)).not.toContain(conta.id);
    });

    it('DELETE some da lista mas mantém o lançamento vinculado', async () => {
      const conta = await criarConta({ nome: 'Conta a excluir', saldoInicial: 1_000 });
      const lancamento = await criarLancamento({
        tipo: 'receita',
        data: '2026-06-05',
        valor: 9_000,
        descricao: 'Ficou órfão de conta',
        categoriaId: categoriaReceita,
        contaBancariaId: conta.id,
        status: 'pago',
      });

      const res = await injectComo(ctx.app, s, { method: 'DELETE', url: `${URL}/${conta.id}` });
      expect(res.statusCode).toBe(200);
      expect((await listarContas()).data.map((c) => c.id)).not.toContain(conta.id);
      expect(
        (await injectComo(ctx.app, s, { method: 'GET', url: `${URL}/${conta.id}` })).statusCode,
      ).toBe(404);

      const lido = await injectComo(ctx.app, s, {
        method: 'GET',
        url: `/api/v1/lancamentos/${lancamento.id}`,
      });
      expect(lido.statusCode).toBe(200);
      const dto = lido.json<{
        data: { contaBancariaId: string | null; contaBancaria: { nome: string } | null };
      }>().data;
      expect(dto.contaBancariaId).toBe(conta.id);
      // Mesma regra dos contatos excluídos: o histórico continua mostrando de onde saiu o dinheiro.
      expect(dto.contaBancaria?.nome).toBe('Conta a excluir');
    });

    it('DELETE de conta inexistente → 404', async () => {
      const res = await injectComo(ctx.app, s, {
        method: 'DELETE',
        url: `${URL}/00000000-0000-4000-8000-000000000000`,
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
