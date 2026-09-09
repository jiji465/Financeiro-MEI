import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  cookiesDe,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import * as authRepo from './repository.js';

const BASE = '/api/v1/auth';

describe('auth', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  // POST /signup foi removido: cadastro deixou de ser self-service (seção 11 do plano). A
  // criação de conta de verdade agora é POST /admin/contas (só admin) — testada em
  // modules/admin/admin.test.ts. Aqui só confirmamos que a rota pública realmente sumiu.
  it('POST /signup não existe mais publicamente', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: `${BASE}/signup`,
      payload: { nome: 'X', email: 'x@exemplo.com', senha: 'Senha@12345', atividade: 'servicos' },
    });
    expect(res.statusCode).toBe(404);
  });

  describe('POST /login', () => {
    let maria: TenantSession;

    beforeAll(async () => {
      maria = await signupTenant(ctx.app, { nome: 'Maria Serviços', email: 'maria@exemplo.com' });
    });

    it('entra com e-mail (qualquer caixa) e senha corretos', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email: 'MARIA@Exemplo.com', senha: maria.senha },
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

    it('conta suspensa (ativo=false) → 401', async () => {
      const s = await signupTenant(ctx.app);
      await authRepo.atualizarUser(ctx.database.db, s.userId, { ativo: false });
      const res = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email: s.email, senha: s.senha },
      });
      expect(res.statusCode).toBe(401);
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
