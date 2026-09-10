// Rotas /api/v1/admin/*. Todo o módulo exige requiresAuth + requiresAdmin (registry.ts) —
// nenhuma rota aqui é alcançável sem um usuário com admin=true.
import {
  type AdminTenantDetalheDto,
  type AdminUsuarioDto,
  adminTenantResponse,
  adminUsuarioResponse,
  atualizarSolicitacaoBody,
  atualizarTenantBody,
  atualizarUsuarioAdminBody,
  authResponse,
  criarAdministradorBody,
  criarContaAdminBody,
  errorResponse,
  idParam,
  itemResponse,
  listaAdminTenantsResponse,
  listaSolicitacoesResponse,
  listarSolicitacoesQuery,
  listarTenantsQuery,
  redefinirSenhaResponse,
  resumoPlataformaResponse,
  type SolicitacaoDto,
  solicitacaoResponse,
} from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { NotFoundError } from '../../lib/errors.js';
import type { TenantRow } from '../../db/schema/tenants.js';
import type { UserRow } from '../../db/schema/auth.js';
import type { SolicitacaoAcessoRow } from '../../db/schema/solicitacoes.js';
import type { TenantComResumo } from './repository.js';
import { criarAdminService } from './service.js';

const TAGS = ['admin'];

function toAdminUsuarioDto(u: UserRow): AdminUsuarioDto {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    admin: u.admin,
    ativo: u.ativo,
    deveTrocarSenha: u.deveTrocarSenha,
    ultimoLoginAt: u.ultimoLoginAt,
    createdAt: u.createdAt,
  };
}

function toAdminTenantDto(t: TenantComResumo) {
  return {
    id: t.tenant.id,
    nome: t.tenant.nome,
    atividade: t.tenant.atividade,
    temCnpj: Boolean(t.tenant.cnpj),
    dataAbertura: t.tenant.dataAbertura,
    ativo: t.tenant.ativo,
    createdAt: t.tenant.createdAt,
    titularId: t.titularId,
    emailTitular: t.emailTitular,
    titularEhAdmin: t.titularEhAdmin,
    totalUsuarios: t.totalUsuarios,
  };
}

function toAdminTenantDetalheDto(dados: {
  tenant: TenantRow;
  usuarios: UserRow[];
}): AdminTenantDetalheDto {
  const titular = dados.usuarios.find((u) => u.role === 'owner') ?? dados.usuarios[0];
  return {
    id: dados.tenant.id,
    nome: dados.tenant.nome,
    atividade: dados.tenant.atividade,
    temCnpj: Boolean(dados.tenant.cnpj),
    dataAbertura: dados.tenant.dataAbertura,
    ativo: dados.tenant.ativo,
    createdAt: dados.tenant.createdAt,
    titularId: titular?.id ?? null,
    emailTitular: titular?.email ?? null,
    titularEhAdmin: titular?.admin ?? false,
    totalUsuarios: dados.usuarios.length,
    usuarios: dados.usuarios.map(toAdminUsuarioDto),
  };
}

function toSolicitacaoDto(s: SolicitacaoAcessoRow): SolicitacaoDto {
  return {
    id: s.id,
    nome: s.nome,
    email: s.email,
    telefone: s.telefone,
    atividade: s.atividade,
    mensagem: s.mensagem,
    status: s.status,
    observacaoAdmin: s.observacaoAdmin,
    createdAt: s.createdAt,
  };
}

export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = criarAdminService({
    database: app.database,
    env: app.env,
    mailer: app.mailer,
    sign: (payload) => app.jwt.sign(payload),
  });

  app.get(
    '/resumo',
    {
      schema: {
        tags: TAGS,
        summary: 'Números gerais da plataforma',
        response: { 200: resumoPlataformaResponse },
      },
    },
    async () => ({ data: await service.resumo() }),
  );

  app.get(
    '/tenants',
    {
      schema: {
        tags: TAGS,
        summary: 'Lista todos os MEIs cadastrados',
        querystring: listarTenantsQuery,
        response: { 200: listaAdminTenantsResponse },
      },
    },
    async (request) => {
      const { page, pageSize, busca, ativo } = request.query;
      const { linhas, total } = await service.listarTenants({ page, pageSize, busca, ativo });
      return { data: linhas.map(toAdminTenantDto), meta: { page, pageSize, total } };
    },
  );

  app.get(
    '/tenants/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Detalhe de um MEI e seus usuários',
        params: idParam,
        response: { 200: adminTenantResponse, 404: errorResponse },
      },
    },
    async (request) => {
      const dados = await service.buscarTenant(request.params.id);
      if (!dados) throw new NotFoundError('MEI não encontrado');
      return { data: toAdminTenantDetalheDto(dados) };
    },
  );

  app.patch(
    '/tenants/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Suspende ou reativa um MEI (bloqueia/libera o login de todos os usuários dele)',
        params: idParam,
        body: atualizarTenantBody,
        response: { 200: adminTenantResponse, 404: errorResponse },
      },
    },
    async (request) => {
      const atualizado = await service.definirAtivoTenant(request.params.id, request.body.ativo);
      if (!atualizado) throw new NotFoundError('MEI não encontrado');
      const dados = await service.buscarTenant(request.params.id);
      if (!dados) throw new NotFoundError('MEI não encontrado');
      return { data: toAdminTenantDetalheDto(dados) };
    },
  );

  app.patch(
    '/usuarios/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Suspende/reativa um usuário ou promove/remove administrador',
        params: idParam,
        body: atualizarUsuarioAdminBody,
        response: { 200: adminUsuarioResponse, 404: errorResponse, 422: errorResponse },
      },
    },
    async (request) => {
      const atualizado = await service.atualizarUsuario(
        request.params.id,
        request.body,
        request.user.sub,
      );
      if (!atualizado) throw new NotFoundError('Usuário não encontrado');
      return { data: toAdminUsuarioDto(atualizado) };
    },
  );

  app.get(
    '/solicitacoes',
    {
      schema: {
        tags: TAGS,
        summary: 'Lista os pedidos de acesso',
        querystring: listarSolicitacoesQuery,
        response: { 200: listaSolicitacoesResponse },
      },
    },
    async (request) => {
      const { page, pageSize, status } = request.query;
      const { linhas, total } = await service.listarSolicitacoes({ page, pageSize, status });
      return { data: linhas.map(toSolicitacaoDto), meta: { page, pageSize, total } };
    },
  );

  app.patch(
    '/solicitacoes/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Marca um pedido de acesso como aprovado/recusado',
        params: idParam,
        body: atualizarSolicitacaoBody,
        response: { 200: solicitacaoResponse, 404: errorResponse },
      },
    },
    async (request) => {
      const atualizada = await service.atualizarSolicitacao(request.params.id, request.body);
      if (!atualizada) throw new NotFoundError('Pedido de acesso não encontrado');
      return { data: toSolicitacaoDto(atualizada) };
    },
  );

  app.post(
    '/contas',
    {
      schema: {
        tags: TAGS,
        summary: 'Cria uma conta de verdade (tenant + usuário + categorias padrão)',
        body: criarContaAdminBody,
        response: {
          201: itemResponse(z.object({ user: authResponse.shape.user })),
          400: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const resultado = await service.criarConta(request.body, {
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      });
      return reply.status(201).send({ data: resultado });
    },
  );

  app.post(
    '/administradores',
    {
      schema: {
        tags: TAGS,
        summary: 'Cria outro administrador puro (sem MEI), sem precisar de terminal',
        body: criarAdministradorBody,
        response: {
          201: itemResponse(z.object({ user: authResponse.shape.user })),
          409: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const resultado = await service.criarAdministrador(request.body);
      return reply.status(201).send({ data: resultado });
    },
  );

  app.post(
    '/usuarios/:id/redefinir-senha',
    {
      schema: {
        tags: TAGS,
        summary: 'Gera uma nova senha temporária para o usuário e revoga as sessões dele',
        params: idParam,
        response: { 200: redefinirSenhaResponse, 404: errorResponse, 422: errorResponse },
      },
    },
    async (request) => {
      const senha = await service.redefinirSenha(request.params.id, request.user.sub);
      if (senha === null) throw new NotFoundError('Usuário não encontrado');
      return { data: { senha } };
    },
  );
};
