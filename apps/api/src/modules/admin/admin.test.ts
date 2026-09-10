// Painel de administrador (seção 11 do plano): criação de conta pelo admin, suspender/reativar,
// promover, pedidos de acesso e resumo. Isolamento (403 para quem não é admin) fica em
// test/isolation/admin.ts — aqui o foco é o comportamento correto para quem É admin.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  injectComo,
  signupAdmin,
  signupAdminInterno,
  signupTenant,
  type TestApp,
} from '../../../test/helpers.js';

const BASE = '/api/v1/admin';

describe('admin', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /admin/contas', () => {
    it('cria tenant, usuário, configurações e categorias padrão (mesmas regras do antigo cadastro)', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const res = await injectComo(ctx.app, admin, {
        method: 'POST',
        url: `${BASE}/contas`,
        payload: {
          nome: 'Maria Serviços',
          email: 'Maria.Cliente@Exemplo.com',
          senha: 'Senha@12345',
          cnpj: '12.345.678/0001-95',
          atividade: 'servicos',
          dataAbertura: '2025-03-01',
        },
      });
      expect(res.statusCode).toBe(201);
      const corpo = res.json<{ data: { user: { email: string; role: string; admin: boolean } } }>();
      expect(corpo.data.user).toMatchObject({
        email: 'maria.cliente@exemplo.com',
        role: 'owner',
        admin: false,
      });

      const login = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'maria.cliente@exemplo.com', senha: 'Senha@12345' },
      });
      expect(login.statusCode).toBe(200);
      const headers = {
        authorization: `Bearer ${login.json<{ accessToken: string }>().accessToken}`,
      };

      const cats = await ctx.app.inject({ method: 'GET', url: '/api/v1/categorias', headers });
      const lista = cats.json<{ data: Array<{ nome: string; sistema: boolean }> }>().data;
      expect(lista.length).toBeGreaterThanOrEqual(10);
      expect(lista.some((c) => c.sistema)).toBe(true);
    });

    it('rejeita e-mail duplicado com 409', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const existente = await signupTenant(ctx.app);
      const res = await injectComo(ctx.app, admin, {
        method: 'POST',
        url: `${BASE}/contas`,
        payload: {
          nome: 'Outra',
          email: existente.email,
          senha: 'Senha@12345',
          atividade: 'comercio',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        error: { code: 'CONFLICT', details: [{ campo: 'email' }] },
      });
    });

    it('marca a solicitação como aprovada quando criada a partir de um pedido', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/solicitacoes-acesso',
        payload: { nome: 'Pedro', email: 'pedro-pedido@exemplo.com' },
      });
      const lista = await injectComo(ctx.app, admin, {
        method: 'GET',
        url: `${BASE}/solicitacoes`,
      });
      const solicitacaoId = lista
        .json<{ data: Array<{ id: string; email: string }> }>()
        .data.find((s) => s.email === 'pedro-pedido@exemplo.com')!.id;

      const criar = await injectComo(ctx.app, admin, {
        method: 'POST',
        url: `${BASE}/contas`,
        payload: {
          nome: 'Pedro',
          email: 'pedro-pedido@exemplo.com',
          senha: 'Senha@12345',
          atividade: 'comercio',
          solicitacaoId,
        },
      });
      expect(criar.statusCode).toBe(201);

      const depois = await injectComo(ctx.app, admin, {
        method: 'GET',
        url: `${BASE}/solicitacoes`,
      });
      const atualizada = depois
        .json<{ data: Array<{ id: string; status: string }> }>()
        .data.find((s) => s.id === solicitacaoId)!;
      expect(atualizada.status).toBe('aprovada');
    });
  });

  describe('suspender / reativar', () => {
    it('suspender bloqueia login e revoga sessões; reativar libera de novo', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const alvo = await signupTenant(ctx.app);

      const suspender = await injectComo(ctx.app, admin, {
        method: 'PATCH',
        url: `${BASE}/usuarios/${alvo.userId}`,
        payload: { ativo: false },
      });
      expect(suspender.statusCode).toBe(200);
      expect(suspender.json<{ data: { ativo: boolean } }>().data.ativo).toBe(false);

      const loginSuspenso = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: alvo.email, senha: alvo.senha },
      });
      expect(loginSuspenso.statusCode).toBe(401);

      const refreshAntigo = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: { refresh_token: alvo.cookies.refresh_token ?? '' },
      });
      expect(refreshAntigo.statusCode).toBe(401);

      const reativar = await injectComo(ctx.app, admin, {
        method: 'PATCH',
        url: `${BASE}/usuarios/${alvo.userId}`,
        payload: { ativo: true },
      });
      expect(reativar.statusCode).toBe(200);

      const loginDepois = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: alvo.email, senha: alvo.senha },
      });
      expect(loginDepois.statusCode).toBe(200);
    });

    it('suspender um MEI inteiro (PATCH /admin/tenants/:id) bloqueia login de todos os usuários dele', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const alvo = await signupTenant(ctx.app);

      const res = await injectComo(ctx.app, admin, {
        method: 'PATCH',
        url: `${BASE}/tenants/${alvo.tenantId}`,
        payload: { ativo: false },
      });
      expect(res.statusCode).toBe(200);

      const login = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: alvo.email, senha: alvo.senha },
      });
      expect(login.statusCode).toBe(401);
    });

    it('admin não pode suspender a própria conta nem remover o próprio acesso de admin', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);

      const semSePrio = await injectComo(ctx.app, admin, {
        method: 'PATCH',
        url: `${BASE}/usuarios/${admin.userId}`,
        payload: { ativo: false },
      });
      expect(semSePrio.statusCode).toBe(422);

      const semRemoverAdmin = await injectComo(ctx.app, admin, {
        method: 'PATCH',
        url: `${BASE}/usuarios/${admin.userId}`,
        payload: { admin: false },
      });
      expect(semRemoverAdmin.statusCode).toBe(422);
    });

    it('promove outro usuário a admin', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const alvo = await signupTenant(ctx.app);

      const res = await injectComo(ctx.app, admin, {
        method: 'PATCH',
        url: `${BASE}/usuarios/${alvo.userId}`,
        payload: { admin: true },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { admin: boolean } }>().data.admin).toBe(true);

      const login = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: alvo.email, senha: alvo.senha },
      });
      expect(login.json<{ user: { admin: boolean } }>().user.admin).toBe(true);
    });
  });

  describe('GET /admin/tenants e /admin/resumo', () => {
    it('lista tenants de dois cadastros diferentes com dados de conta (nunca lançamentos)', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const t1 = await signupTenant(ctx.app, { nome: 'Empresa Um' });
      const t2 = await signupTenant(ctx.app, { nome: 'Empresa Dois' });

      const res = await injectComo(ctx.app, admin, {
        method: 'GET',
        url: `${BASE}/tenants?pageSize=200`,
      });
      expect(res.statusCode).toBe(200);
      const nomes = res
        .json<{ data: Array<{ id: string; nome: string; emailTitular: string | null }> }>()
        .data.map((t) => t.nome);
      expect(nomes).toContain('Empresa Um');
      expect(nomes).toContain('Empresa Dois');
      void t1;
      void t2;
    });

    it('resumo conta tenants, usuários e solicitações pendentes', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      await signupTenant(ctx.app);
      const pedido = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/solicitacoes-acesso',
        payload: { nome: 'Resumo Teste', email: `resumo-${Date.now()}@exemplo.com` },
      });
      expect(pedido.statusCode).toBe(202);

      const res = await injectComo(ctx.app, admin, { method: 'GET', url: `${BASE}/resumo` });
      expect(res.statusCode).toBe(200);
      const dados = res.json<{
        data: { totalTenants: number; totalUsuarios: number; solicitacoesPendentes: number };
      }>().data;
      expect(dados.totalTenants).toBeGreaterThanOrEqual(2);
      expect(dados.solicitacoesPendentes).toBeGreaterThanOrEqual(1);
    });
  });

  describe('administrador puro (tenant interno — seção 13 do plano)', () => {
    it('POST /admin/administradores cria um admin sem MEI, que consegue logar', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const res = await injectComo(ctx.app, admin, {
        method: 'POST',
        url: `${BASE}/administradores`,
        payload: { nome: 'Novo Admin', email: 'novo-admin@exemplo.com', senha: 'Senha@12345' },
      });
      expect(res.statusCode).toBe(201);
      const corpo = res.json<{ data: { user: { email: string; admin: boolean } } }>();
      expect(corpo.data.user).toMatchObject({ email: 'novo-admin@exemplo.com', admin: true });

      const login = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'novo-admin@exemplo.com', senha: 'Senha@12345' },
      });
      expect(login.statusCode).toBe(200);
      const dados = login.json<{ user: { admin: boolean }; tenant: { interno: boolean } }>();
      expect(dados.user.admin).toBe(true);
      expect(dados.tenant.interno).toBe(true);
    });

    it('tenant interno não aparece em /admin/tenants nem conta em /admin/resumo', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const antes = await injectComo(ctx.app, admin, { method: 'GET', url: `${BASE}/resumo` });
      const totalAntes = antes.json<{ data: { totalTenants: number; totalUsuarios: number } }>()
        .data;

      const puro = await signupAdminInterno(ctx.app);

      const lista = await injectComo(ctx.app, admin, {
        method: 'GET',
        url: `${BASE}/tenants?pageSize=200`,
      });
      const ids = lista.json<{ data: Array<{ id: string }> }>().data.map((t) => t.id);
      expect(ids).not.toContain(puro.tenantId);

      const depois = await injectComo(ctx.app, admin, { method: 'GET', url: `${BASE}/resumo` });
      const totalDepois = depois.json<{ data: { totalTenants: number; totalUsuarios: number } }>()
        .data;
      expect(totalDepois.totalTenants).toBe(totalAntes.totalTenants);
      expect(totalDepois.totalUsuarios).toBe(totalAntes.totalUsuarios);
    });

    it('GET /admin/tenants/:id do tenant interno devolve 404 (tratado como inexistente)', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const puro = await signupAdminInterno(ctx.app);

      const res = await injectComo(ctx.app, admin, {
        method: 'GET',
        url: `${BASE}/tenants/${puro.tenantId}`,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /admin/usuarios/:id/redefinir-senha', () => {
    it('gera senha nova, invalida a antiga, exige troca no próximo login e revoga sessões', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const alvo = await signupTenant(ctx.app);

      const res = await injectComo(ctx.app, admin, {
        method: 'POST',
        url: `${BASE}/usuarios/${alvo.userId}/redefinir-senha`,
      });
      expect(res.statusCode).toBe(200);
      const novaSenha = res.json<{ data: { senha: string } }>().data.senha;
      expect(novaSenha).not.toBe(alvo.senha);

      const loginSenhaAntiga = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: alvo.email, senha: alvo.senha },
      });
      expect(loginSenhaAntiga.statusCode).toBe(401);

      const loginSenhaNova = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: alvo.email, senha: novaSenha },
      });
      expect(loginSenhaNova.statusCode).toBe(200);
      expect(
        loginSenhaNova.json<{ user: { deveTrocarSenha: boolean } }>().user.deveTrocarSenha,
      ).toBe(true);

      const refreshAntigo = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: { refresh_token: alvo.cookies.refresh_token ?? '' },
      });
      expect(refreshAntigo.statusCode).toBe(401);
    });

    it('admin não pode redefinir a própria senha por esta rota (422)', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const res = await injectComo(ctx.app, admin, {
        method: 'POST',
        url: `${BASE}/usuarios/${admin.userId}/redefinir-senha`,
      });
      expect(res.statusCode).toBe(422);
    });

    it('404 para usuário inexistente', async () => {
      const admin = await signupAdmin(ctx.app, ctx.database);
      const res = await injectComo(ctx.app, admin, {
        method: 'POST',
        url: `${BASE}/usuarios/00000000-0000-4000-8000-000000000000/redefinir-senha`,
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
