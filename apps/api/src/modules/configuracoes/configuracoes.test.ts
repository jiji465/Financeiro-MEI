import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';

const URL = '/api/v1/configuracoes';

const ENDERECO_VAZIO = {
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  cidade: null,
  uf: null,
  cep: null,
};

describe('configuracoes', () => {
  let ctx: TestApp;
  let s: TenantSession;

  beforeAll(async () => {
    ctx = await buildTestApp();
    s = await signupTenant(ctx.app, {
      nome: 'João Comércio',
      atividade: 'comercio',
      cnpj: '11222333000181',
    });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('GET devolve dados do MEI e padrões (regime competência, alertas 7 dias, categoria DAS, preferências)', async () => {
    const res = await injectComo(ctx.app, s, { method: 'GET', url: URL });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data).toMatchObject({
      mei: {
        id: s.tenantId,
        nome: 'João Comércio',
        cnpj: '11222333000181',
        atividade: 'comercio',
        caminhoneiroTributos: null,
        endereco: ENDERECO_VAZIO,
        ativo: true,
      },
      regimeApuracao: 'competencia',
      diasAlertaVencimento: 7,
      diasAlertaDas: 7,
      mostrarProjecao: true,
      preferencias: {
        tema: 'sistema',
        ocultarValores: false,
        paginaInicial: '/',
        mostrarBoasVindas: true,
      },
    });
    expect(data.mei.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(data.categoriaDasId).toEqual(expect.any(String));
    const cat = await injectComo(ctx.app, s, {
      method: 'GET',
      url: `/api/v1/categorias/${data.categoriaDasId}`,
    });
    expect(cat.json().data).toMatchObject({ nome: 'Impostos e DAS', sistema: true });
  });

  it('sem token → 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: URL });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH atualiza dados do MEI (mei.*) e preferências de uma vez', async () => {
    const res = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: {
        mei: {
          nomeFantasia: 'Loja do João',
          telefone: '(11) 99999-1234',
          dataAbertura: '2024-06-15',
          endereco: { cidade: 'Campinas', uf: 'SP', cep: '13010-000' },
        },
        regimeApuracao: 'caixa',
        diasAlertaVencimento: 3,
        mostrarProjecao: false,
        preferencias: { tema: 'escuro' },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({
      mei: {
        nomeFantasia: 'Loja do João',
        telefone: '11999991234',
        dataAbertura: '2024-06-15',
        endereco: { ...ENDERECO_VAZIO, cidade: 'Campinas', uf: 'SP', cep: '13010000' },
      },
      regimeApuracao: 'caixa',
      diasAlertaVencimento: 3,
      diasAlertaDas: 7,
      mostrarProjecao: false,
      preferencias: {
        tema: 'escuro',
        ocultarValores: false,
        paginaInicial: '/',
        mostrarBoasVindas: true,
      },
    });
    // Observação: `preferencias.partial()` do shared aplica os defaults às chaves omitidas
    // (zod 4), então o cliente deve mandar o objeto completo para não "resetar" as demais.
    const completo = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: {
        preferencias: {
          tema: 'escuro',
          ocultarValores: true,
          paginaInicial: '/lancamentos',
          mostrarBoasVindas: false,
        },
      },
    });
    expect(completo.json().data.preferencias).toEqual({
      tema: 'escuro',
      ocultarValores: true,
      paginaInicial: '/lancamentos',
      mostrarBoasVindas: false,
    });
    const get = await injectComo(ctx.app, s, { method: 'GET', url: URL });
    expect(get.json().data.regimeApuracao).toBe('caixa');
  });

  it('atividade caminhoneiro exige tributos (422); depois aceita e limpa ao voltar', async () => {
    const semTributos = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { mei: { atividade: 'caminhoneiro' } },
    });
    expect(semTributos.statusCode).toBe(422);
    expect(semTributos.json().error.details[0].campo).toBe('mei.caminhoneiroTributos');

    const ok = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { mei: { atividade: 'caminhoneiro', caminhoneiroTributos: 'icms' } },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.mei).toMatchObject({
      atividade: 'caminhoneiro',
      caminhoneiroTributos: 'icms',
    });

    const volta = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { mei: { atividade: 'servicos' } },
    });
    expect(volta.json().data.mei).toMatchObject({
      atividade: 'servicos',
      caminhoneiroTributos: null,
    });
  });

  it('CNPJ de outro MEI → 409; dígitos errados → 400; formato inválido → 400; remover → null', async () => {
    await signupTenant(ctx.app, { cnpj: '11444777000161' });
    const dup = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { mei: { cnpj: '11.444.777/0001-61' } },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.details[0].campo).toBe('mei.cnpj');

    const digitos = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { mei: { cnpj: '12345678000100' } },
    });
    expect(digitos.statusCode).toBe(400);
    expect(digitos.json().error.details[0].campo).toBe('mei.cnpj');

    const formato = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { mei: { cnpj: '123' } },
    });
    expect(formato.statusCode).toBe(400);

    const limpo = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { mei: { cnpj: null } },
    });
    expect(limpo.statusCode).toBe(200);
    expect(limpo.json().data.mei.cnpj).toBeNull();
  });

  it('categoriaDasId: receita → 422; inexistente → 404; despesa própria → ok', async () => {
    const cats = await injectComo(ctx.app, s, { method: 'GET', url: '/api/v1/categorias' });
    const lista = cats.json<{ data: Array<{ id: string; tipo: string; sistema: boolean }> }>().data;
    const receita = lista.find((c) => c.tipo === 'receita')!;
    const despesa = lista.find((c) => c.tipo === 'despesa' && !c.sistema)!;

    const rec = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { categoriaDasId: receita.id },
    });
    expect(rec.statusCode).toBe(422);

    const nao = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { categoriaDasId: '00000000-0000-4000-8000-000000000000' },
    });
    expect(nao.statusCode).toBe(404);

    const ok = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { categoriaDasId: despesa.id },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.categoriaDasId).toBe(despesa.id);
  });

  it('corpo vazio é aceito (no-op); valores fora da faixa e UF inválida → 400', async () => {
    const vazio = await injectComo(ctx.app, s, { method: 'PATCH', url: URL, payload: {} });
    expect(vazio.statusCode).toBe(200);
    const fora = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { diasAlertaDas: 500 },
    });
    expect(fora.statusCode).toBe(400);
    const uf = await injectComo(ctx.app, s, {
      method: 'PATCH',
      url: URL,
      payload: { mei: { endereco: { uf: 'XX' } } },
    });
    expect(uf.statusCode).toBe(400);
  });
});
