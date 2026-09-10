// Regras do painel de administrador (seção 11 do plano). Sem acesso a lançamentos/saldo/
// faturamento de nenhum tenant — só dados de conta.
import type {
  AtualizarSolicitacaoBody,
  AuthUser,
  CriarAdministradorBody,
  CriarContaAdminBody,
} from '@meifin/shared';

import type { Env } from '../../config/env.js';
import type { Database } from '../../db/index.js';
import { UnprocessableError } from '../../lib/errors.js';
import type { Mailer } from '../../lib/mailer.js';
import type { AccessTokenPayload } from '../../plugins/auth.js';
import * as authRepo from '../auth/repository.js';
import { criarAuthService, type SessaoMeta } from '../auth/service.js';
import * as solicitacoesRepo from '../solicitacoes/repository.js';
import * as repo from './repository.js';

export interface AdminDeps {
  database: Database;
  env: Pick<Env, 'APP_URL' | 'JWT_REFRESH_TTL_DAYS' | 'PASSWORD_RESET_TTL_MINUTES'>;
  mailer: Mailer;
  sign: (payload: AccessTokenPayload) => string;
}

export function criarAdminService(deps: AdminDeps) {
  const { database } = deps;
  const db = database.db;
  const authService = criarAuthService(deps);

  async function resumo() {
    return repo.resumoPlataforma(db);
  }

  async function listarTenants(opcoes: repo.ListarTenantsOpcoes) {
    return repo.listarTenants(db, opcoes);
  }

  async function buscarTenant(tenantId: string) {
    return repo.buscarTenantComUsuarios(db, tenantId);
  }

  async function definirAtivoTenant(tenantId: string, ativo: boolean) {
    return repo.definirAtivoTenant(db, tenantId, ativo);
  }

  /** Suspender/reativar um usuário. Suspender também revoga sessões abertas na hora. */
  async function atualizarUsuario(
    userId: string,
    valores: { ativo?: boolean; admin?: boolean },
    quemPediu: string,
  ) {
    if (userId === quemPediu) {
      if (valores.ativo === false) {
        throw new UnprocessableError('Você não pode suspender a própria conta');
      }
      if (valores.admin === false) {
        throw new UnprocessableError('Você não pode remover seu próprio acesso de administrador');
      }
    }
    const usuario = await repo.atualizarUsuario(db, userId, valores);
    if (usuario && valores.ativo === false) {
      await authRepo.revogarRefreshTokensDoUser(db, userId);
    }
    return usuario;
  }

  async function listarSolicitacoes(opcoes: solicitacoesRepo.ListarSolicitacoesOpcoes) {
    return solicitacoesRepo.listar(db, opcoes);
  }

  async function atualizarSolicitacao(id: string, input: AtualizarSolicitacaoBody) {
    return solicitacoesRepo.atualizar(db, id, {
      status: input.status,
      observacaoAdmin: input.observacaoAdmin ?? null,
    });
  }

  /** Cria a conta de verdade (mesma lógica do antigo cadastro público, agora só via admin). */
  async function criarConta(
    input: CriarContaAdminBody,
    meta: SessaoMeta,
  ): Promise<{ user: AuthUser }> {
    const { solicitacaoId, ...corpo } = input;
    // A senha inicial foi definida pelo admin, não pela própria pessoa: exige troca no 1º login.
    const resultado = await authService.signup(corpo, meta, {
      admin: false,
      deveTrocarSenha: true,
    });
    if (solicitacaoId) {
      await solicitacoesRepo.atualizar(db, solicitacaoId, { status: 'aprovada' });
    }
    return { user: resultado.user };
  }

  /** Cria outro administrador puro direto pelo painel — sem precisar de terminal/CLI. */
  async function criarAdministrador(input: CriarAdministradorBody): Promise<{ user: AuthUser }> {
    return authService.criarAdminInterno(input);
  }

  /** Gera uma nova senha temporária para o usuário e devolve em claro, uma única vez.
   * `null` quando o usuário não existe. */
  async function redefinirSenha(userId: string, quemPediu: string): Promise<string | null> {
    const usuario = await repo.buscarUsuarioPorId(db, userId);
    if (!usuario) return null;
    if (userId === quemPediu) {
      throw new UnprocessableError(
        'Use "Alterar senha" em Configurações para trocar a sua própria senha',
      );
    }
    return authService.redefinirSenhaAdmin(userId);
  }

  return {
    resumo,
    listarTenants,
    buscarTenant,
    definirAtivoTenant,
    atualizarUsuario,
    listarSolicitacoes,
    atualizarSolicitacao,
    criarConta,
    criarAdministrador,
    redefinirSenha,
  };
}

export type AdminService = ReturnType<typeof criarAdminService>;
