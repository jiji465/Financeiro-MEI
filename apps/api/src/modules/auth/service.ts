// Regras de autenticação: signup transacional (tenant → configurações → usuário → categorias
// padrão → categoria DAS), login, refresh com rotação e detecção de reuso, logout,
// esqueci/redefinir senha e troca de senha.
import {
  type AuthTenant,
  type AuthUser,
  type ChangePasswordBody,
  type LoginBody,
  type ResetPasswordBody,
  type SignupBody,
  validarCNPJ,
} from '@meifin/shared';

import type { Env } from '../../config/env.js';
import type { Database, DbExecutor } from '../../db/index.js';
import type { UserRow } from '../../db/schema/auth.js';
import type { TenantRow } from '../../db/schema/tenants.js';
import { aplicarCategoriasPadrao } from '../../db/seed/categorias-padrao.js';
import {
  ConflictError,
  UnauthorizedError,
  UnprocessableError,
  ValidationError,
} from '../../lib/errors.js';
import { daquiA, expirou } from '../../lib/hoje.js';
import type { Mailer } from '../../lib/mailer.js';
import { hashSenha, verificarSenha } from '../../lib/senha.js';
import { gerarToken, hashToken } from '../../lib/tokens.js';
import type { AccessTokenPayload } from '../../plugins/auth.js';
import * as configRepo from '../configuracoes/repository.js';
import * as repo from './repository.js';

export interface AuthDeps {
  database: Database;
  env: Pick<Env, 'APP_URL' | 'JWT_REFRESH_TTL_DAYS' | 'PASSWORD_RESET_TTL_MINUTES'>;
  mailer: Mailer;
  /** Assina o access token (app.jwt.sign). */
  sign: (payload: AccessTokenPayload) => string;
}

/** Metadados da requisição guardados no refresh token. */
export interface SessaoMeta {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export interface SessaoEmitida {
  accessToken: string;
  /** Token opaco em claro — vai só para o cookie httpOnly. */
  refreshToken: string;
}

const MENSAGEM_CREDENCIAIS = 'E-mail ou senha inválidos';

export function toAuthUser(u: UserRow): AuthUser {
  return { id: u.id, tenantId: u.tenantId, nome: u.nome, email: u.email, role: u.role };
}

export function toAuthTenant(t: TenantRow): AuthTenant {
  return {
    id: t.id,
    nome: t.nome,
    nomeFantasia: t.nomeFantasia,
    cnpj: t.cnpj,
    atividade: t.atividade,
    caminhoneiroTributos: t.caminhoneiroTributos,
    dataAbertura: t.dataAbertura,
  };
}

export function criarAuthService(deps: AuthDeps) {
  const { database, env, mailer, sign } = deps;
  const db = database.db;

  async function emitirSessao(
    exec: DbExecutor,
    user: UserRow,
    meta: SessaoMeta,
  ): Promise<SessaoEmitida> {
    const accessToken = sign({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });
    const refreshToken = gerarToken();
    await repo.inserirRefreshToken(exec, {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: daquiA(env.JWT_REFRESH_TTL_DAYS * 86_400),
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip ?? null,
    });
    return { accessToken, refreshToken };
  }

  async function signup(input: SignupBody, meta: SessaoMeta) {
    if (await repo.buscarUserPorEmail(db, input.email)) {
      throw new ConflictError('E-mail já cadastrado', [
        { campo: 'email', mensagem: 'E-mail já cadastrado' },
      ]);
    }
    if (input.cnpj) {
      if (!validarCNPJ(input.cnpj)) {
        throw new ValidationError('CNPJ inválido', [{ campo: 'cnpj', mensagem: 'CNPJ inválido' }]);
      }
      if (await repo.buscarTenantPorCnpj(db, input.cnpj)) {
        throw new ConflictError('CNPJ já cadastrado', [
          { campo: 'cnpj', mensagem: 'CNPJ já cadastrado' },
        ]);
      }
    }

    const senhaHash = await hashSenha(input.senha);
    const { tenant, user, sessao } = await database.withTx(async (tx) => {
      const tenant = await repo.inserirTenant(tx, {
        nome: input.nome,
        cnpj: input.cnpj ?? null,
        atividade: input.atividade,
        caminhoneiroTributos:
          input.atividade === 'caminhoneiro' ? (input.caminhoneiroTributos ?? null) : null,
        dataAbertura: input.dataAbertura ?? null,
        emailContato: input.email,
      });
      await configRepo.inserirPadrao(tx, tenant.id);
      const user = await repo.inserirUser(tx, {
        tenantId: tenant.id,
        nome: input.nome,
        email: input.email,
        senhaHash,
        role: 'owner',
        ultimoLoginAt: new Date().toISOString(),
      });
      const criadas = await aplicarCategoriasPadrao(tx, tenant.id, input.atividade);
      const categoriaDas = criadas.find((c) => c.sistema);
      if (categoriaDas) {
        await configRepo.atualizarConfiguracoes(tx, tenant.id, { categoriaDasId: categoriaDas.id });
      }
      const sessao = await emitirSessao(tx, user, meta);
      return { tenant, user, sessao };
    });

    return { ...sessao, user: toAuthUser(user), tenant: toAuthTenant(tenant) };
  }

  async function login(input: LoginBody, meta: SessaoMeta) {
    const user = await repo.buscarUserPorEmail(db, input.email);
    // Verifica sempre um hash (mesmo sem usuário) para não vazar existência pelo tempo de resposta.
    const ok = user
      ? await verificarSenha(input.senha, user.senhaHash)
      : await verificarSenha(input.senha, HASH_FALSO).then(() => false);
    if (!user || !ok || !user.ativo) throw new UnauthorizedError(MENSAGEM_CREDENCIAIS);
    const tenant = await repo.buscarTenantPorId(db, user.tenantId);
    if (!tenant || !tenant.ativo) throw new UnauthorizedError('Conta desativada');

    await repo.atualizarUser(db, user.id, { ultimoLoginAt: new Date().toISOString() });
    const sessao = await emitirSessao(db, user, meta);
    return { ...sessao, user: toAuthUser(user), tenant: toAuthTenant(tenant) };
  }

  /** Rotação: o token usado é revogado e apontado para o novo. Reuso de token revogado derruba a cadeia. */
  async function refresh(
    refreshToken: string | undefined,
    meta: SessaoMeta,
  ): Promise<SessaoEmitida> {
    if (!refreshToken) throw new UnauthorizedError('Sessão não encontrada');
    const atual = await repo.buscarRefreshPorHash(db, hashToken(refreshToken));
    if (!atual) throw new UnauthorizedError('Sessão inválida');

    if (atual.revokedAt) {
      if (atual.replacedById) {
        // Token já rotacionado sendo reapresentado: possível roubo → derruba a cadeia inteira.
        await repo.revogarRefreshTokensDoUser(db, atual.userId);
        throw new UnauthorizedError('Sessão reutilizada. Entre novamente.');
      }
      // Revogado por logout / troca ou redefinição de senha: só nega.
      throw new UnauthorizedError('Sessão encerrada. Entre novamente.');
    }
    if (expirou(atual.expiresAt)) {
      await repo.revogarRefreshToken(db, atual.id);
      throw new UnauthorizedError('Sessão expirada. Entre novamente.');
    }

    const user = await repo.buscarUserPorId(db, atual.userId);
    if (!user || !user.ativo) throw new UnauthorizedError('Conta desativada');

    return database.withTx(async (tx) => {
      const nova = await emitirSessao(tx, user, meta);
      const novaLinha = await repo.buscarRefreshPorHash(tx, hashToken(nova.refreshToken));
      await repo.revogarRefreshToken(tx, atual.id, novaLinha?.id);
      return nova;
    });
  }

  async function logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const atual = await repo.buscarRefreshPorHash(db, hashToken(refreshToken));
    if (atual && !atual.revokedAt) await repo.revogarRefreshToken(db, atual.id);
  }

  /** Sempre resolve (202): não revela se o e-mail existe. */
  async function forgotPassword(email: string): Promise<void> {
    const user = await repo.buscarUserPorEmail(db, email);
    if (!user || !user.ativo) return;

    const token = gerarToken();
    await repo.invalidarResetsDoUser(db, user.id);
    await repo.inserirResetToken(db, {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: daquiA(env.PASSWORD_RESET_TTL_MINUTES * 60),
    });
    const link = `${env.APP_URL.replace(/\/$/, '')}/redefinir-senha?token=${encodeURIComponent(token)}`;
    await mailer.enviar({
      para: user.email,
      assunto: 'Redefinição de senha — MEI Financeiro',
      texto: [
        `Olá, ${user.nome}.`,
        '',
        `Para redefinir sua senha, acesse o link abaixo (válido por ${env.PASSWORD_RESET_TTL_MINUTES} minutos):`,
        link,
        '',
        'Se você não pediu a redefinição, ignore este e-mail.',
      ].join('\n'),
    });
  }

  async function resetPassword(input: ResetPasswordBody): Promise<void> {
    const registro = await repo.buscarResetPorHash(db, hashToken(input.token));
    if (!registro || registro.usedAt || expirou(registro.expiresAt)) {
      throw new UnprocessableError('Link de redefinição inválido ou expirado', [
        { campo: 'token', mensagem: 'Link inválido ou expirado' },
      ]);
    }
    const senhaHash = await hashSenha(input.novaSenha);
    await database.withTx(async (tx) => {
      await repo.atualizarUser(tx, registro.userId, { senhaHash });
      await repo.marcarResetUsado(tx, registro.id);
      await repo.revogarRefreshTokensDoUser(tx, registro.userId);
    });
  }

  async function me(userId: string) {
    const user = await repo.buscarUserPorId(db, userId);
    if (!user || !user.ativo) throw new UnauthorizedError('Conta desativada');
    const tenant = await repo.buscarTenantPorId(db, user.tenantId);
    if (!tenant || !tenant.ativo) throw new UnauthorizedError('Conta desativada');
    return { user: toAuthUser(user), tenant: toAuthTenant(tenant) };
  }

  /** Troca a senha, revoga todas as sessões e abre uma nova para o dispositivo atual. */
  async function alterarSenha(
    userId: string,
    input: ChangePasswordBody,
    meta: SessaoMeta,
  ): Promise<SessaoEmitida> {
    const user = await repo.buscarUserPorId(db, userId);
    if (!user || !user.ativo) throw new UnauthorizedError('Conta desativada');
    if (!(await verificarSenha(input.senhaAtual, user.senhaHash))) {
      throw new ValidationError('Senha atual incorreta', [
        { campo: 'senhaAtual', mensagem: 'Senha atual incorreta' },
      ]);
    }
    const senhaHash = await hashSenha(input.novaSenha);
    return database.withTx(async (tx) => {
      await repo.atualizarUser(tx, user.id, { senhaHash });
      await repo.revogarRefreshTokensDoUser(tx, user.id);
      return emitirSessao(tx, user, meta);
    });
  }

  return { signup, login, refresh, logout, forgotPassword, resetPassword, me, alterarSenha };
}

export type AuthService = ReturnType<typeof criarAuthService>;

/** Hash válido de uma senha aleatória, usado para igualar o tempo de resposta quando o e-mail não existe. */
const HASH_FALSO =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
