// Painel de administrador (plataforma, não por tenant). Escopo deliberadamente limitado a dados
// de conta — nunca lançamentos, saldo ou faturamento de um tenant (seção 11 do plano).
import { z } from 'zod';

import { ATIVIDADES } from '../constants.js';
import {
  booleanoQuery,
  isoDate,
  itemResponse,
  paginacaoQuery,
  paginado,
  textoCurto,
  uuid,
} from './common.js';
import { email, senha, signupBody } from './auth.js';

export const adminUsuarioDto = z.object({
  id: uuid,
  nome: z.string(),
  email: z.string(),
  admin: z.boolean(),
  ativo: z.boolean(),
  deveTrocarSenha: z.boolean(),
  ultimoLoginAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminUsuarioDto = z.infer<typeof adminUsuarioDto>;

export const adminTenantDto = z.object({
  id: uuid,
  nome: z.string(),
  atividade: z.enum(ATIVIDADES),
  temCnpj: z.boolean(),
  dataAbertura: isoDate.nullable(),
  ativo: z.boolean(),
  createdAt: z.string(),
  /** Titular (primeiro usuário) — para contato rápido e ações (suspender/promover) pelo admin. */
  titularId: uuid.nullable(),
  emailTitular: z.string().nullable(),
  titularEhAdmin: z.boolean(),
  totalUsuarios: z.number().int(),
});
export type AdminTenantDto = z.infer<typeof adminTenantDto>;

export const adminTenantDetalheDto = adminTenantDto.extend({
  usuarios: z.array(adminUsuarioDto),
});
export type AdminTenantDetalheDto = z.infer<typeof adminTenantDetalheDto>;

export const listarTenantsQuery = paginacaoQuery.extend({
  busca: textoCurto.optional(),
  ativo: booleanoQuery.optional(),
});
export type ListarTenantsQuery = z.infer<typeof listarTenantsQuery>;

export const atualizarTenantBody = z.object({ ativo: z.boolean() });
export type AtualizarTenantBody = z.infer<typeof atualizarTenantBody>;

export const atualizarUsuarioAdminBody = z.object({
  ativo: z.boolean().optional(),
  admin: z.boolean().optional(),
});
export type AtualizarUsuarioAdminBody = z.infer<typeof atualizarUsuarioAdminBody>;

export const resumoPlataformaDto = z.object({
  totalTenants: z.number().int(),
  totalUsuarios: z.number().int(),
  tenantsAtivos: z.number().int(),
  tenantsSuspensos: z.number().int(),
  cadastrosUltimos30Dias: z.number().int(),
  solicitacoesPendentes: z.number().int(),
});
export type ResumoPlataformaDto = z.infer<typeof resumoPlataformaDto>;

/**
 * Criação de conta pelo admin (mesmo formulário do antigo cadastro público). `signupBody` tem um
 * `.refine()` (ZodEffects), que não suporta `.extend()` — usa `.and()` (interseção) para
 * acrescentar o campo opcional sem duplicar as regras de validação.
 */
export const criarContaAdminBody = signupBody.and(
  z.object({
    /** Se veio de um pedido de acesso, marca-o como aprovado ao criar a conta. */
    solicitacaoId: uuid.optional(),
  }),
);
export type CriarContaAdminBody = z.infer<typeof criarContaAdminBody>;

/** Cria outro administrador puro (sem MEI) direto pelo painel — sem precisar de terminal. */
export const criarAdministradorBody = z.object({
  nome: z.string().trim().min(2, 'Informe o nome').max(120),
  email,
  senha,
});
export type CriarAdministradorBody = z.infer<typeof criarAdministradorBody>;

/** Resposta de POST /admin/usuarios/:id/redefinir-senha — único lugar em que uma senha em claro
 * sai da API, para o admin repassar à pessoa por fora do sistema. */
export const redefinirSenhaResponse = itemResponse(z.object({ senha: z.string() }));
export type RedefinirSenhaResponse = z.infer<typeof redefinirSenhaResponse>;

export const adminUsuarioResponse = itemResponse(adminUsuarioDto);
export type AdminUsuarioResponse = z.infer<typeof adminUsuarioResponse>;
export const adminTenantResponse = itemResponse(adminTenantDetalheDto);
export type AdminTenantResponse = z.infer<typeof adminTenantResponse>;
export const listaAdminTenantsResponse = paginado(adminTenantDto);
export type ListaAdminTenantsResponse = z.infer<typeof listaAdminTenantsResponse>;
export const resumoPlataformaResponse = itemResponse(resumoPlataformaDto);
export type ResumoPlataformaResponse = z.infer<typeof resumoPlataformaResponse>;
