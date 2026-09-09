// Rota pública /api/v1/solicitacoes-acesso — cadastro deixou de ser self-service (seção 11 do
// plano): quem quer acesso preenche este formulário; o admin decide criar a conta depois de
// entrar em contato por fora do sistema (ver modules/admin). Rate limit igual ao de login/
// forgot-password para evitar spam.
import { criarSolicitacaoBody, criarSolicitacaoResponse, errorResponse } from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { RATE_LIMIT_AUTH } from '../../plugins/security.js';
import * as repo from './repository.js';

const TAGS = ['solicitacoes'];

export const solicitacoesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/solicitacoes-acesso',
    {
      config: { rateLimit: RATE_LIMIT_AUTH },
      schema: {
        tags: TAGS,
        summary: 'Registra um pedido de acesso (sem criar conta)',
        body: criarSolicitacaoBody,
        response: { 202: criarSolicitacaoResponse, 400: errorResponse, 429: errorResponse },
      },
    },
    async (request, reply) => {
      await repo.inserir(app.db, {
        nome: request.body.nome,
        email: request.body.email,
        telefone: request.body.telefone ?? null,
        atividade: request.body.atividade ?? null,
        mensagem: request.body.mensagem ?? null,
      });
      return reply
        .status(202)
        .send({ data: { mensagem: 'Recebemos seu pedido. Entraremos em contato em breve.' } });
    },
  );
};
