import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../../../test/helpers.js';

const BASE = '/api/v1/solicitacoes-acesso';

describe('solicitações de acesso', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('registra um pedido sem exigir autenticação e sem criar conta', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: BASE,
      payload: {
        nome: 'Ana Interessada',
        email: 'Ana.Interessada@Exemplo.com',
        telefone: '(11) 98888-0000',
        atividade: 'servicos',
        mensagem: 'Quero saber mais.',
      },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({
      data: { mensagem: 'Recebemos seu pedido. Entraremos em contato em breve.' },
    });

    const loginComEsseEmail = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'ana.interessada@exemplo.com', senha: 'qualquer' },
    });
    expect(loginComEsseEmail.statusCode).toBe(401);
  });

  it('nome e e-mail são obrigatórios; telefone/atividade/mensagem são opcionais', async () => {
    const minimo = await ctx.app.inject({
      method: 'POST',
      url: BASE,
      payload: { nome: 'Só Nome e E-mail', email: 'minimo@exemplo.com' },
    });
    expect(minimo.statusCode).toBe(202);

    const semNome = await ctx.app.inject({
      method: 'POST',
      url: BASE,
      payload: { email: 'sem-nome@exemplo.com' },
    });
    expect(semNome.statusCode).toBe(400);
  });

  it('a mesma pessoa pode pedir mais de uma vez', async () => {
    const payload = { nome: 'Repetido', email: 'repetido@exemplo.com' };
    const r1 = await ctx.app.inject({ method: 'POST', url: BASE, payload });
    const r2 = await ctx.app.inject({ method: 'POST', url: BASE, payload });
    expect(r1.statusCode).toBe(202);
    expect(r2.statusCode).toBe(202);
  });
});
