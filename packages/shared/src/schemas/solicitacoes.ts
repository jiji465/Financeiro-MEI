// Pedidos de acesso ("Solicitar acesso" — cadastro deixou de ser self-service). A rota pública
// só cria o pedido; quem decide criar a conta de fato é o admin (ver schemas/admin.ts).
import { z } from 'zod';

import { ATIVIDADES, STATUS_SOLICITACAO } from '../constants.js';
import { itemResponse, paginacaoQuery, paginado, textoOpcional, uuid } from './common.js';
import { email } from './auth.js';

export const criarSolicitacaoBody = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome').max(120),
  email,
  telefone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{10,11}$/, 'Telefone deve ter DDD + 8 ou 9 dígitos'))
    .optional()
    .or(z.literal('').transform(() => undefined)),
  atividade: z.enum(ATIVIDADES).optional(),
  mensagem: textoOpcional,
});
export type CriarSolicitacaoBody = z.infer<typeof criarSolicitacaoBody>;

export const criarSolicitacaoResponse = itemResponse(z.object({ mensagem: z.string() }));
export type CriarSolicitacaoResponse = z.infer<typeof criarSolicitacaoResponse>;

export const solicitacaoDto = z.object({
  id: uuid,
  nome: z.string(),
  email: z.string(),
  telefone: z.string().nullable(),
  atividade: z.enum(ATIVIDADES).nullable(),
  mensagem: z.string().nullable(),
  status: z.enum(STATUS_SOLICITACAO),
  observacaoAdmin: z.string().nullable(),
  createdAt: z.string(),
});
export type SolicitacaoDto = z.infer<typeof solicitacaoDto>;

export const listarSolicitacoesQuery = paginacaoQuery.extend({
  status: z.enum(STATUS_SOLICITACAO).optional(),
});
export type ListarSolicitacoesQuery = z.infer<typeof listarSolicitacoesQuery>;

export const atualizarSolicitacaoBody = z.object({
  status: z.enum(STATUS_SOLICITACAO),
  observacaoAdmin: textoOpcional,
});
export type AtualizarSolicitacaoBody = z.infer<typeof atualizarSolicitacaoBody>;

export const solicitacaoResponse = itemResponse(solicitacaoDto);
export type SolicitacaoResponse = z.infer<typeof solicitacaoResponse>;
export const listaSolicitacoesResponse = paginado(solicitacaoDto);
export type ListaSolicitacoesResponse = z.infer<typeof listaSolicitacoesResponse>;
