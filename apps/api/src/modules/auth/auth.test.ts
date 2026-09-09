import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  cookiesDe,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';

const BASE = '/api/v1/auth';

describe('auth', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /signup', () => {
    it('cria tenant, usuário, configurações e categorias padrão; devolve token e cookie', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/signup`,
        payload: {
          nome: 'Maria Serviços',
          email: 'Maria@Exemplo.com',
          senha: 'Senha@12345',
          cnpj: '12.345.678/0001-95',
          atividade: 'servicos',
          dataAbertura: '2025-03-01',
        },
      });
      expect(res.statusCode).toBe(201);
      const corpo = res.json();
      expect(corpo.accessToken).toEqual(expect.any(String));
      expect(corpo.user).toMatchObject({
        nome: 'Maria Serviços',
        email: 'maria@exemplo.com',
        role: 'owner',
      });
      expect(corpo.tenant).toMatchObject({
        nome: 'Maria Serviços',
        cnpj: '12345678000195',
        atividade: 'servicos',
        caminhoneiroTributos: null,
        dataAbertura: '2025-03-01',
      });

      const cookie = (res.cookies as Array<Record<string, unknown>>).find(
        (c) => c.name === 'refresh_token',
      );
      expect(cookie).toMatchObject({ httpOnly: true, path: '/api/v1/auth', sameSite: 'Lax' });
      expect(String(cookie?.value).length).toBeGreaterThan(30);

      const headers = { authorization: `Bearer ${corpo.accessToken}` };
      const cats = await ctx.app.inject({ method: 'GET', url: '/api/v1/categorias', headers });
      expect(cats.statusCode).toBe(200);
      const lista = cats.json<{ data: Array<{ nome: string; sistema: boolean; tipo: string }> }>()
        .data;
      expect(lista.length).toBeGreaterThanOrEqual(10);
      const das = lista.find((c) => c.sistema);
      expect(das).toMatchObject({ nome: 'Impostos e DAS', tipo: 'despesa' });
      expect(lista.some((c) => c.nome === 'Prestação de serviços')).toBe(true);
      expect(lista.some((c) => c.nome === 'Venda de produtos')).toBe(false);

      const cfg = await ctx.app.inject({ method: 'GET', url: '/api/v1/configuracoes', headers });
      expect(cfg.statusCode).toBe(200);
      expect(cfg.json().data.categoriaDasId).toBeTruthy();
    });

    it('rejeita e-mail duplicado (case-insensitive) com 409 e campo email', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/signup`,
        payload: {
          nome: 'Outra',
          email: 'MARIA@exemplo.com',
          senha: 'Senha@12345',
          atividade: 'comercio',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        error: { code: 'CONFLICT', details: [{ campo: 'email' }] },
      });
    });

    it('rejeita CNPJ duplicado com 409 e campo cnpj', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/signup`,
        payload: {
          nome: 'Outra',
          email: 'outra@exemplo.com',
          senha: 'Senha@12345',
          cnpj: '12345678000195',
          atividade: 'comercio',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        error: { code: 'CONFLICT', details: [{ campo: 'cnpj' }] },
      });
    });

    it('valida o corpo (senha curta, e-mail inválido, caminhoneiro sem tributos)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/signup`,
        payload: { nome: 'X', email: 'nao-e-email', senha: '123', atividade: 'caminhoneiro' },
      });
      expect(res.statusCode).toBe(400);
      const corpo = res.json<{ error: { code: string; details: Array<{ campo: string }> } }>();
      expect(corpo.error.code).toBe('VALIDATION_ERROR');
      const campos = corpo.error.details.map((d) => d.campo);
      expect(campos).toEqual(
        expect.arrayContaining(['nome', 'email', 'senha', 'caminhoneiroTributos']),
      );
    });

    it('CNPJ com dígitos verificadores errados → 400 no campo cnpj', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/signup`,
        payload: {
          nome: 'CNPJ Ruim',
          email: 'cnpj-ruim@exemplo.com',
          senha: 'Senha@12345',
          cnpj: '12.345.678/0001-00',
          atividade: 'comercio',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: { code: 'VALIDATION_ERROR', details: [{ campo: 'cnpj' }] },
      });
    });

    it('caminhoneiro com tributos recebe categorias próprias', async () => {
      const s = await signupTenant(ctx.app, {
        atividade: 'caminhoneiro',
        caminhoneiroTributos: 'ambos',
      });
      expect(s.tenant.atividade).toBe('caminhoneiro');
      const cats = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/categorias',
        headers: s.headers,
      });
      const nomes = cats.json<{ data: Array<{ nome: string }> }>().data.map((c) => c.nome);
      expect(nomes).toContain('Fretes e transporte');
      expect(nomes).toContain('Pedágios');
      expect(nomes).not.toContain('Transporte e deslocamento');
    });
  });

  describe('POST /login', () => {
    it('entra com e-mail (qualquer caixa) e senha corretos', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email: 'maria@EXEMPLO.com', senha: 'Senha@12345' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().user.email).toBe('maria@exemplo.com');
      expect(cookiesDe(res).refresh_token).toBeTruthy();
    });

    it('senha errada → 401 sem revelar qual campo', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email: 'maria@exemplo.com', senha: 'errada-errada' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('e-mail desconhecido → 401 com a mesma mensagem', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email: 'ninguem@exemplo.com', senha: 'Senha@12345' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.message).toBe('E-mail ou senha inválidos');
    });
  });

  describe('POST /refresh', () => {
    it('rotaciona o token, detecta reuso e derruba a cadeia', async () => {
      const s = await signupTenant(ctx.app);
      const cookie1 = s.cookies.refresh_token!;

      const r1 = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        cookies: { refresh_token: cookie1 },
      });
      expect(r1.statusCode).toBe(200);
      expect(r1.json().accessToken).toEqual(expect.any(String));
      const cookie2 = cookiesDe(r1).refresh_token!;
      expect(cookie2).toBeTruthy();
      expect(cookie2).not.toBe(cookie1);

      // O novo access token funciona
      const me = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}/me`,
        headers: { authorization: `Bearer ${r1.json().accessToken}` },
      });
      expect(me.statusCode).toBe(200);

      // Reuso do token antigo → 401 e cookie limpo
      const reuso = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        cookies: { refresh_token: cookie1 },
      });
      expect(reuso.statusCode).toBe(401);
      expect(String(reuso.headers['set-cookie'])).toMatch(/refresh_token=;/);

      // A cadeia inteira foi revogada: o token novo também não vale mais
      const r2 = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        cookies: { refresh_token: cookie2 },
      });
      expect(r2.statusCode).toBe(401);
    });

    it('sem cookie → 401; cookie inventado → 401', async () => {
      const semCookie = await ctx.app.inject({ method: 'POST', url: `${BASE}/refresh` });
      expect(semCookie.statusCode).toBe(401);
      const falso = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        cookies: { refresh_token: 'nao-existe' },
      });
      expect(falso.statusCode).toBe(401);
    });
  });

  describe('POST /logout', () => {
    it('revoga o refresh token e limpa o cookie', async () => {
      const s = await signupTenant(ctx.app);
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/logout`,
        cookies: { refresh_token: s.cookies.refresh_token! },
      });
      expect(res.statusCode).toBe(204);
      expect(String(res.headers['set-cookie'])).toMatch(/refresh_token=;/);

      const depois = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        cookies: { refresh_token: s.cookies.refresh_token! },
      });
      expect(depois.statusCode).toBe(401);
    });

    it('sem cookie também responde 204', async () => {
      const res = await ctx.app.inject({ method: 'POST', url: `${BASE}/logout` });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('forgot-password / reset-password', () => {
    let s: TenantSession;

    beforeAll(async () => {
      s = await signupTenant(ctx.app);
    });

    it('e-mail desconhecido responde 202 e não envia nada', async () => {
      ctx.mailer.limpar();
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/forgot-password`,
        payload: { email: 'ninguem@exemplo.com' },
      });
      expect(res.statusCode).toBe(202);
      expect(ctx.mailer.enviados).toHaveLength(0);
    });

    it('fluxo completo: link no mailer → reset → senha antiga inválida → sessões revogadas', async () => {
      ctx.mailer.limpar();
      const pedido = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/forgot-password`,
        payload: { email: s.email.toUpperCase() },
      });
      expect(pedido.statusCode).toBe(202);
      const email = ctx.mailer.ultimoPara(s.email);
      expect(email).toBeDefined();
      const link = /https?:\/\/\S+/.exec(email!.texto)?.[0];
      expect(link).toContain('/redefinir-senha?token=');
      const token = new URL(link!).searchParams.get('token')!;
      expect(token.length).toBeGreaterThan(30);

      const invalido = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/reset-password`,
        payload: { token: 'token-invalido', novaSenha: 'NovaSenha@1' },
      });
      expect(invalido.statusCode).toBe(422);

      const reset = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/reset-password`,
        payload: { token, novaSenha: 'NovaSenha@1' },
      });
      expect(reset.statusCode).toBe(200);

      // Token de uso único
      const reuso = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/reset-password`,
        payload: { token, novaSenha: 'Outra@12345' },
      });
      expect(reuso.statusCode).toBe(422);

      const antiga = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email: s.email, senha: s.senha },
      });
      expect(antiga.statusCode).toBe(401);

      const nova = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email: s.email, senha: 'NovaSenha@1' },
      });
      expect(nova.statusCode).toBe(200);

      const refreshAntigo = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        cookies: { refresh_token: s.cookies.refresh_token! },
      });
      expect(refreshAntigo.statusCode).toBe(401);
    });
  });

  describe('GET /me e PATCH /me/senha', () => {
    let s: TenantSession;

    beforeAll(async () => {
      s = await signupTenant(ctx.app, { nome: 'Eu Mesmo' });
    });

    it('devolve usuário e tenant do token', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: `${BASE}/me`, headers: s.headers });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        data: {
          user: { id: s.userId, tenantId: s.tenantId, nome: 'Eu Mesmo' },
          tenant: { id: s.tenantId },
        },
      });
    });

    it('sem token → 401; token inválido → 401', async () => {
      const sem = await ctx.app.inject({ method: 'GET', url: `${BASE}/me` });
      expect(sem.statusCode).toBe(401);
      expect(sem.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
      const invalido = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}/me`,
        headers: { authorization: 'Bearer abc.def.ghi' },
      });
      expect(invalido.statusCode).toBe(401);
    });

    it('senha atual errada → 400 com campo senhaAtual', async () => {
      const res = await ctx.app.inject({
        method: 'PATCH',
        url: `${BASE}/me/senha`,
        headers: s.headers,
        payload: { senhaAtual: 'errada-errada', novaSenha: 'NovaSenha@2' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: { code: 'VALIDATION_ERROR', details: [{ campo: 'senhaAtual' }] },
      });
    });

    it('troca a senha, devolve novo access token e cookie, e revoga a sessão antiga', async () => {
      const res = await ctx.app.inject({
        method: 'PATCH',
        url: `${BASE}/me/senha`,
        headers: s.headers,
        payload: { senhaAtual: s.senha, novaSenha: 'NovaSenha@2' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().accessToken).toEqual(expect.any(String));
      const novoCookie = cookiesDe(res).refresh_token!;
      expect(novoCookie).toBeTruthy();

      const antigo = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        cookies: { refresh_token: s.cookies.refresh_token! },
      });
      expect(antigo.statusCode).toBe(401);

      const novo = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        cookies: { refresh_token: novoCookie },
      });
      expect(novo.statusCode).toBe(200);

      const login = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email: s.email, senha: 'NovaSenha@2' },
      });
      expect(login.statusCode).toBe(200);
    });
  });
});
