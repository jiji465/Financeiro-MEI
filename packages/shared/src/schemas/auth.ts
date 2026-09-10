// Contratos do módulo auth (seção 4 do plano). Formas finais; P1-B implementa as rotas.
import { z } from 'zod';

import { ATIVIDADES, CAMINHONEIRO_TRIBUTOS, USER_ROLES } from '../constants.js';
import { isoDate, itemResponse, uuid } from './common.js';

export const senha = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(128, 'A senha deve ter no máximo 128 caracteres');

export const email = z
  .email('E-mail inválido')
  .max(160)
  .transform((v) => v.trim().toLowerCase());

/** CNPJ com ou sem pontuação (numérico ou alfanumérico). A validação de dígitos fica em domain/documentos (P1-A). */
export const cnpjInput = z
  .string()
  .trim()
  .transform((v) => v.replace(/[.\-/\s]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{12}\d{2}$/, 'CNPJ deve ter 14 caracteres'));

export const signupBody = z
  .object({
    nome: z.string().trim().min(2, 'Informe seu nome').max(120),
    email,
    senha,
    cnpj: cnpjInput.optional(),
    atividade: z.enum(ATIVIDADES),
    caminhoneiroTributos: z.enum(CAMINHONEIRO_TRIBUTOS).optional(),
    dataAbertura: isoDate.optional(),
  })
  .refine((v) => v.atividade !== 'caminhoneiro' || v.caminhoneiroTributos !== undefined, {
    message: 'Informe quais tributos o caminhoneiro recolhe (ICMS, ISS ou ambos)',
    path: ['caminhoneiroTributos'],
  });
export type SignupBody = z.infer<typeof signupBody>;

export const loginBody = z.object({
  email,
  senha: z.string().min(1, 'Informe a senha'),
});
export type LoginBody = z.infer<typeof loginBody>;

export const forgotPasswordBody = z.object({ email });
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBody>;

export const resetPasswordBody = z.object({
  token: z.string().min(1, 'Token obrigatório'),
  novaSenha: senha,
});
export type ResetPasswordBody = z.infer<typeof resetPasswordBody>;

export const changePasswordBody = z.object({
  senhaAtual: z.string().min(1, 'Informe a senha atual'),
  novaSenha: senha,
});
export type ChangePasswordBody = z.infer<typeof changePasswordBody>;

export const authUser = z.object({
  id: uuid,
  tenantId: uuid,
  nome: z.string(),
  email: z.string(),
  role: z.enum(USER_ROLES),
  /** Administrador da plataforma (não confundir com `role`, que é o papel dentro do próprio tenant). */
  admin: z.boolean(),
  /** true quando a senha atual foi definida por um admin — o frontend deve bloquear a navegação
   * até a pessoa trocar a senha. */
  deveTrocarSenha: z.boolean(),
});
export type AuthUser = z.infer<typeof authUser>;

export const authTenant = z.object({
  id: uuid,
  nome: z.string(),
  nomeFantasia: z.string().nullable(),
  cnpj: z.string().nullable(),
  atividade: z.enum(ATIVIDADES),
  caminhoneiroTributos: z.enum(CAMINHONEIRO_TRIBUTOS).nullable(),
  dataAbertura: isoDate.nullable(),
  /** Tenant técnico de um administrador puro (nunca um MEI de verdade) — o frontend deve
   * esconder toda navegação de MEI e mandar a pessoa direto para /admin. */
  interno: z.boolean(),
});
export type AuthTenant = z.infer<typeof authTenant>;

/** Resposta de signup (201) e login (200); o refresh token vai em cookie httpOnly. */
export const authResponse = z.object({
  accessToken: z.string(),
  user: authUser,
  tenant: authTenant,
});
export type AuthResponse = z.infer<typeof authResponse>;

/** GET /auth/me */
export const meResponse = itemResponse(z.object({ user: authUser, tenant: authTenant }));
export type MeResponse = z.infer<typeof meResponse>;

/** POST /auth/refresh */
export const refreshResponse = z.object({ accessToken: z.string() });
export type RefreshResponse = z.infer<typeof refreshResponse>;
