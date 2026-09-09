import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from './helpers.js';

describe('GET /api/v1/health e infraestrutura', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    // SWAGGER ligado só aqui: garante que todos os schemas zod (inclusive z.stringbool das
    // query strings do shared) são conversíveis para OpenAPI.
    ctx = await buildTestApp({ SWAGGER: 'true' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('responde ok com o driver pglite', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'pglite', versao: expect.any(String) });
  });

  it('rota inexistente devolve o envelope de erro', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/nao-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('rota de módulo protegido sem Bearer devolve 401 (ou 404 se o módulo ainda é stub)', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/dashboard/qualquer' });
    expect([401, 404]).toContain(res.statusCode);
    expect(res.json()).toHaveProperty('error.code');
    const protegida = await ctx.app.inject({ method: 'GET', url: '/api/v1/categorias' });
    expect(protegida.statusCode).toBe(401);
  });

  it('corpo JSON inválido devolve 400 no envelope', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{ "email": ',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('gera o OpenAPI em /docs/json com as rotas dos módulos', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json<{ openapi: string; paths: Record<string, unknown> }>();
    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/health',
        '/api/v1/auth/signup',
        '/api/v1/auth/refresh',
        '/api/v1/auth/me/senha',
        '/api/v1/categorias',
        '/api/v1/categorias/{id}',
        '/api/v1/configuracoes',
      ]),
    );
    // Rotas de coleção registradas como '' (sem barra final duplicada na documentação)
    expect(Object.keys(doc.paths)).not.toContain('/api/v1/categorias/');
  });
});
