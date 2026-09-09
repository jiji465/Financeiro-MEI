// Rate limit ligado de propósito (padrão nos testes é desligado): login e forgot-password
// aceitam 10 tentativas por 15 minutos por IP e depois respondem 429 no envelope padrão.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, signupTenant, type TenantSession, type TestApp } from './helpers.js';

describe('rate limit em rotas de auth', () => {
  let ctx: TestApp;
  let sessao: TenantSession;

  beforeAll(async () => {
    ctx = await buildTestApp({}, { rateLimit: true });
    sessao = await signupTenant(ctx.app);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('bloqueia a 11ª tentativa de login em 15 minutos', async () => {
    // signupTenant() já fez 1 login de verdade (para obter um refresh_token real) — conta como a
    // 1ª tentativa desta janela. Faltam 9 tentativas válidas até estourar o limite de 10.
    let ultimo = 0;
    for (let i = 0; i < 11; i++) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: sessao.email, senha: 'errada-errada' },
      });
      ultimo = res.statusCode;
      if (i < 9) expect(res.statusCode).toBe(401);
    }
    expect(ultimo).toBe(429);
  });

  it('a 429 vem no envelope { error: { code: RATE_LIMITED } }', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: sessao.email, senha: sessao.senha },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
  });

  it('rotas normais seguem o limite global (300/min) e continuam respondendo', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('300');
  });
});
