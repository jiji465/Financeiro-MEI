import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from './helpers.js';

describe('GET /api/v1/health', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await buildTestApp();
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

  it('rota de módulo protegido ainda sem rotas devolve o envelope de erro', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/dashboard/qualquer' });
    // Módulos são stubs no Phase 0: cai no not-found handler (404). Quando P1-B/WP5 registrarem
    // rotas, o hook onRequest [app.authenticate] passa a responder 401 sem Bearer.
    expect([401, 404]).toContain(res.statusCode);
    expect(res.json()).toHaveProperty('error.code');
  });
});
