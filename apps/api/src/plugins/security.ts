// CORS (origens do env, com credenciais), cookies, helmet e rate limit.
// Rate limit global: 300 req/min por IP. Rotas de auth sensíveis (login, forgot-password)
// declaram limites mais estritos via config.rateLimit (10 por 15 min). Nos testes o rate limit
// é desligado por BuildAppOptions.rateLimit=false (o teste específico liga de novo).
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import fp from 'fastify-plugin';

import type { Env } from '../config/env.js';
import { RateLimitedError } from '../lib/errors.js';

export interface SecurityPluginOptions {
  env: Env;
  /** Registra o @fastify/rate-limit (padrão: true). */
  rateLimit?: boolean;
}

export const RATE_LIMIT_GLOBAL = { max: 300, timeWindow: '1 minute' } as const;
/** Para login e forgot-password (seção 4 do plano). */
export const RATE_LIMIT_AUTH = { max: 10, timeWindow: '15 minutes' } as const;

export const securityPlugin = fp<SecurityPluginOptions>(
  async (app, { env, rateLimit: habilitarRateLimit = true }) => {
    await app.register(sensible);
    await app.register(cors, {
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition'],
    });
    await app.register(cookie, { secret: env.JWT_REFRESH_SECRET });
    await app.register(helmet, {
      // CSP desligada: Swagger UI (/docs) e a SPA servida por SERVE_WEB carregam scripts inline.
      // Em produção o frontend fica na Vercel, e a API só devolve JSON.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    });
    if (habilitarRateLimit) {
      await app.register(rateLimit, {
        global: true,
        max: RATE_LIMIT_GLOBAL.max,
        timeWindow: RATE_LIMIT_GLOBAL.timeWindow,
        // O plugin faz `throw` do retorno: precisa ser um Error com status (AppError → 429 no handler).
        errorResponseBuilder: () => new RateLimitedError(),
      });
    }
  },
  { name: 'meifin-security' },
);
