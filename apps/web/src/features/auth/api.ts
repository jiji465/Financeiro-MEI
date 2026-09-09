// Chamadas HTTP do módulo auth (contratos em @meifin/shared/schemas/auth).
import type {
  AuthResponse,
  ChangePasswordBody,
  ForgotPasswordBody,
  LoginBody,
  MeResponse,
  ResetPasswordBody,
  SignupBody,
} from '@meifin/shared';

import { api } from '@/lib/api/client';

export const authApi = {
  login: (body: LoginBody) => api.post<AuthResponse>('/auth/login', body),
  signup: (body: SignupBody) => api.post<AuthResponse>('/auth/signup', body),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<MeResponse>('/auth/me'),
  forgotPassword: (body: ForgotPasswordBody) => api.post<void>('/auth/forgot-password', body),
  resetPassword: (body: ResetPasswordBody) => api.post<void>('/auth/reset-password', body),
  changePassword: (body: ChangePasswordBody) => api.patch<void>('/auth/me/senha', body),
};
