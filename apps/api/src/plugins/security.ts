// CORS (origens do env), cookies, helmet e rate limit (global desativado; rotas optam via config).
// P1-B (API core) ajusta CSP e limites específicos (login/forgot: 10 por 15 min).
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import fp from 'fastify-plugin';

import type { Env } from '../config/env.js';

export interface SecurityPluginOptions {
  env: Env;
}

export const securityPlugin = fp<SecurityPluginOptions>(
  async (app, { env }) => {
    await app.register(sensible);
    await app.register(cors, {
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
    await app.register(cookie, { secret: env.JWT_REFRESH_SECRET });
    await app.register(helmet, {
      // CSP fica a cargo do P1-B (Swagger UI e SPA servida por SERVE_WEB precisam de ajustes)
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    });
    await app.register(rateLimit, {
      global: false,
      max: 100,
      timeWindow: '15 minutes',
      errorResponseBuilder: () => ({
        error: {
          code: 'RATE_LIMITED',
          message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
        },
      }),
    });
  },
  { name: 'meifin-security' },
);
