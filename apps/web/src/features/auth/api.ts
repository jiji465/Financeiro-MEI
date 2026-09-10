// Chamadas HTTP do módulo auth (contratos em @meifin/shared/schemas/auth).
import type {
  AuthResponse,
  ChangePasswordBody,
  CriarSolicitacaoBody,
  CriarSolicitacaoResponse,
  ForgotPasswordBody,
  LoginBody,
  MeResponse,
  RefreshResponse,
  ResetPasswordBody,
} from '@meifin/shared';

import { api } from '@/lib/api/client';

export const authApi = {
  login: (body: LoginBody) => api.post<AuthResponse>('/auth/login', body),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<MeResponse>('/auth/me'),
  forgotPassword: (body: ForgotPasswordBody) => api.post<void>('/auth/forgot-password', body),
  resetPassword: (body: ResetPasswordBody) => api.post<void>('/auth/reset-password', body),
  changePassword: (body: ChangePasswordBody) => api.patch<RefreshResponse>('/auth/me/senha', body),
  /** Cadastro deixou de ser self-service: isto só registra um pedido de contato. */
  solicitarAcesso: (body: CriarSolicitacaoBody) =>
    api.post<CriarSolicitacaoResponse>('/solicitacoes-acesso', body),
};
