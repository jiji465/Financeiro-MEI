// Fábricas de dados para testes (formas dos contratos do @meifin/shared).
import type { AuthResponse, AuthTenant, AuthUser } from '@meifin/shared';

let seq = 0;
export function proximoId(prefixo = 'id'): string {
  seq += 1;
  return `${prefixo}-${String(seq).padStart(4, '0')}`;
}

export const UUID_EXEMPLO = '11111111-1111-4111-8111-111111111111';
export const TENANT_UUID_EXEMPLO = '22222222-2222-4222-8222-222222222222';

export function criarUser(sobrescrever: Partial<AuthUser> = {}): AuthUser {
  return {
    id: UUID_EXEMPLO,
    tenantId: TENANT_UUID_EXEMPLO,
    nome: 'Maria da Silva',
    email: 'maria@exemplo.com.br',
    role: 'owner',
    admin: false,
    deveTrocarSenha: false,
    ...sobrescrever,
  };
}

export function criarTenant(sobrescrever: Partial<AuthTenant> = {}): AuthTenant {
  return {
    id: TENANT_UUID_EXEMPLO,
    nome: 'Maria da Silva',
    nomeFantasia: 'Doces da Maria',
    cnpj: null,
    atividade: 'comercio',
    caminhoneiroTributos: null,
    dataAbertura: '2024-03-15',
    interno: false,
    ...sobrescrever,
  };
}

export function criarAuthResponse(sobrescrever: Partial<AuthResponse> = {}): AuthResponse {
  return {
    accessToken: 'token-de-teste',
    user: criarUser(),
    tenant: criarTenant(),
    ...sobrescrever,
  };
}

export function criarMeResponse(sobrescrever: Partial<AuthResponse> = {}) {
  const { user, tenant } = criarAuthResponse(sobrescrever);
  return { data: { user, tenant } };
}

export function criarLista<T>(
  itens: T[],
  meta: Partial<{ page: number; pageSize: number; total: number }> = {},
) {
  return {
    data: itens,
    meta: { page: 1, pageSize: 50, total: itens.length, ...meta },
  };
}

export function criarErroApi(
  status: number,
  code: string,
  message: string,
  details?: { campo: string; mensagem: string }[],
) {
  return { status, body: { error: { code, message, details } } };
}
