// Enums do banco (pgEnum). Valores vêm de @meifin/shared/constants — fonte única para API e web.
// Ficam num arquivo próprio para evitar importações circulares entre os grupos de tabelas.
import {
  ATIVIDADES,
  CAMINHONEIRO_TRIBUTOS,
  FORMAS_PAGAMENTO,
  GRUPOS_DASN,
  ORIGENS_LANCAMENTO,
  REGIMES_APURACAO,
  STATUS_DASN,
  STATUS_LANCAMENTO,
  STATUS_NOTA,
  STATUS_PARCELA,
  STATUS_SOLICITACAO,
  STATUS_TITULO,
  TIPOS_CONTATO,
  TIPOS_LANCAMENTO,
  TIPOS_NOTA,
  TIPOS_TITULO,
  USER_ROLES,
} from '@meifin/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

export const atividadeEnum = pgEnum('atividade', ATIVIDADES);
export const caminhoneiroTributosEnum = pgEnum('caminhoneiro_tributos', CAMINHONEIRO_TRIBUTOS);
export const tipoLancamentoEnum = pgEnum('tipo_lancamento', TIPOS_LANCAMENTO);
export const formaPagamentoEnum = pgEnum('forma_pagamento', FORMAS_PAGAMENTO);
export const statusLancamentoEnum = pgEnum('status_lancamento', STATUS_LANCAMENTO);
export const origemLancamentoEnum = pgEnum('origem_lancamento', ORIGENS_LANCAMENTO);
export const tipoContatoEnum = pgEnum('tipo_contato', TIPOS_CONTATO);
export const grupoDasnEnum = pgEnum('grupo_dasn', GRUPOS_DASN);
export const tipoTituloEnum = pgEnum('tipo_titulo', TIPOS_TITULO);
export const statusTituloEnum = pgEnum('status_titulo', STATUS_TITULO);
export const statusParcelaEnum = pgEnum('status_parcela', STATUS_PARCELA);
export const tipoNotaEnum = pgEnum('tipo_nota', TIPOS_NOTA);
export const statusNotaEnum = pgEnum('status_nota', STATUS_NOTA);
export const statusDasnEnum = pgEnum('status_dasn', STATUS_DASN);
export const regimeApuracaoEnum = pgEnum('regime_apuracao', REGIMES_APURACAO);
export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const statusSolicitacaoEnum = pgEnum('status_solicitacao', STATUS_SOLICITACAO);
