// Pedidos de acesso ("Solicitar acesso" — cadastro deixou de ser self-service, seção 11 do
// plano). Tabela global, sem tenant_id: a pessoa ainda não tem conta. Sem unicidade de e-mail —
// a mesma pessoa pode tentar de novo.
import { pgTable, text } from 'drizzle-orm/pg-core';

import { id, timestamps } from './_common.js';
import { atividadeEnum, statusSolicitacaoEnum } from './enums.js';

export const solicitacoesAcesso = pgTable('solicitacoes_acesso', {
  id: id(),
  nome: text('nome').notNull(),
  email: text('email').notNull(),
  telefone: text('telefone'),
  atividade: atividadeEnum('atividade'),
  mensagem: text('mensagem'),
  status: statusSolicitacaoEnum('status').notNull().default('pendente'),
  /** Anotação interna do admin (motivo da recusa, contato feito etc.). */
  observacaoAdmin: text('observacao_admin'),
  ...timestamps(),
});

export type SolicitacaoAcessoRow = typeof solicitacoesAcesso.$inferSelect;
export type SolicitacaoAcessoInsert = typeof solicitacoesAcesso.$inferInsert;
