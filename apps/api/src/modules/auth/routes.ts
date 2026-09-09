// Rotas /api/v1/auth. Access token no corpo; refresh token opaco em cookie httpOnly
// (path /api/v1/auth, sameSite=lax, secure em produção). Login e forgot-password: 10 req / 15 min.
import {
  API_PREFIX,
  authResponse,
  changePasswordBody,
  errorResponse,
  forgotPasswordBody,
  loginBody,
  meResponse,
  refreshResponse,
  resetPasswordBody,
  signupBody,
} from '@meifin/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { RATE_LIMIT_AUTH } from '../../plugins/security.js';
import { criarAuthService, type SessaoMeta } from './service.js';

export const REFRESH_COOKIE = 'refresh_token';
export const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

const TAGS = ['auth'];

const mensagemResponse = z.object({ data: z.object({ mensagem: z.string() }) });

function metaDe(request: FastifyRequest): SessaoMeta {
  return { userAgent: request.headers['user-agent'], ip: request.ip };
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = criarAuthService({
    database: app.database,
    env: app.env,
    mailer: app.mailer,
    sign: (payload) => app.jwt.sign(payload),
  });

  const setRefreshCookie = (reply: FastifyReply, token: string) =>
    reply.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: app.env.IS_PRODUCTION,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: app.env.JWT_REFRESH_TTL_DAYS * 86_400,
    });

  const clearRefreshCookie = (reply: FastifyReply) =>
    reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });

  app.post(
    '/signup',
    {
      schema: {
        tags: TAGS,
        summary: 'Cria a conta do MEI (tenant + usuário + categorias padrão)',
        body: signupBody,
        response: { 201: authResponse, 400: errorResponse, 409: errorResponse },
      },
    },
    async (request, reply) => {
      const { refreshToken, ...corpo } = await service.signup(request.body, metaDe(request));
      setRefreshCookie(reply, refreshToken);
      return reply.status(201).send(corpo);
    },
  );

  app.post(
    '/login',
    {
      config: { rateLimit: RATE_LIMIT_AUTH },
      schema: {
        tags: TAGS,
        summary: 'Entra com e-mail e senha',
        body: loginBody,
        response: { 200: authResponse, 401: errorResponse, 429: errorResponse },
      },
    },
    async (request, reply) => {
      const { refreshToken, ...corpo } = await service.login(request.body, metaDe(request));
      setRefreshCookie(reply, refreshToken);
      return corpo;
    },
  );

  app.post(
    '/refresh',
    {
      schema: {
        tags: TAGS,
        summary: 'Renova o access token usando o cookie de refresh (rotação)',
        response: { 200: refreshResponse, 401: errorResponse },
      },
    },
    async (request, reply) => {
      try {
        const sessao = await service.refresh(request.cookies[REFRESH_COOKIE], metaDe(request));
        setRefreshCookie(reply, sessao.refreshToken);
        return { accessToken: sessao.accessToken };
      } catch (erro) {
        clearRefreshCookie(reply);
        throw erro;
      }
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        tags: TAGS,
        summary: 'Encerra a sessão (revoga o refresh token e limpa o cookie)',
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await service.logout(request.cookies[REFRESH_COOKIE]);
      clearRefreshCookie(reply);
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/forgot-password',
    {
      config: { rateLimit: RATE_LIMIT_AUTH },
      schema: {
        tags: TAGS,
        summary: 'Envia link de redefinição de senha (sempre 202)',
        body: forgotPasswordBody,
        response: { 202: mensagemResponse, 400: errorResponse, 429: errorResponse },
      },
    },
    async (request, reply) => {
      await service.forgotPassword(request.body.email);
      return reply
        .status(202)
        .send({ data: { mensagem: 'Se o e-mail estiver cadastrado, enviaremos as instruções.' } });
    },
  );

  app.post(
    '/reset-password',
    {
      schema: {
        tags: TAGS,
        summary: 'Redefine a senha com o token do link (revoga todas as sessões)',
        body: resetPasswordBody,
        response: { 200: mensagemResponse, 400: errorResponse, 422: errorResponse },
      },
    },
    async (request, reply) => {
      await service.resetPassword(request.body);
      clearRefreshCookie(reply);
      return { data: { mensagem: 'Senha redefinida. Entre com a nova senha.' } };
    },
  );

  app.get(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: TAGS,
        summary: 'Usuário e MEI autenticados',
        security: [{ bearerAuth: [] }],
        response: { 200: meResponse, 401: errorResponse },
      },
    },
    async (request) => ({ data: await service.me(request.user.sub) }),
  );

  app.patch(
    '/me/senha',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: TAGS,
        summary: 'Troca a senha (revoga as outras sessões)',
        security: [{ bearerAuth: [] }],
        body: changePasswordBody,
        response: { 200: refreshResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request, reply) => {
      const sessao = await service.alterarSenha(request.user.sub, request.body, metaDe(request));
      setRefreshCookie(reply, sessao.refreshToken);
      return { accessToken: sessao.accessToken };
    },
  );
};
