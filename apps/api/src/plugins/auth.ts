// Access token JWT HS256 (@fastify/jwt) + app.authenticate. Stub do Phase 0: P1-B (API core)
// implementa emissão/refresh/revogação no módulo auth; o contrato do payload já é o final.
import fjwt from '@fastify/jwt';
import type { UserRole } from '@meifin/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import type { Env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

/** Payload do access token. `sub` = user id. */
export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
  /** Administrador da plataforma (painel /admin), independente de `role`. */
  admin: boolean;
}

export interface AuthPluginOptions {
  env: Env;
}

export const authPlugin = fp<AuthPluginOptions>(
  async (app, { env }) => {
    await app.register(fjwt, {
      secret: env.JWT_ACCESS_SECRET,
      sign: { algorithm: 'HS256', expiresIn: env.JWT_ACCESS_TTL },
      verify: { algorithms: ['HS256'] },
    });

    app.decorateRequest('tenantId', '');

    app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        throw new UnauthorizedError('Token inválido ou expirado');
      }
      const payload = request.user;
      if (!payload?.tenantId || !payload.sub) {
        throw new UnauthorizedError('Token sem identificação de tenant');
      }
      request.tenantId = payload.tenantId;
    });

    // Usar sempre depois de app.authenticate (registry.ts: requiresAuth + requiresAdmin).
    app.decorate('requireAdmin', async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.user?.admin) {
        throw new ForbiddenError('Acesso restrito a administradores');
      }
    });
  },
  { name: 'meifin-auth', dependencies: ['meifin-db'] },
);
