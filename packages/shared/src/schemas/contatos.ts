// Contratos do módulo "contatos" (seção 4 do plano): CRUD (soft delete), ?tipo&busca&page, /:id/lancamentos, /:id/resumo.
import { z } from 'zod';

import { TIPOS_CONTATO, TIPOS_DOCUMENTO } from '../constants.js';
import {
  booleanoQuery,
  centavos,
  documentoInput,
  emailOpcional,
  endereco,
  enderecoDto,
  isoDate,
  itemResponse,
  listaResponse,
  ordemQuery,
  paginatedResponse,
  paginationQuery,
  periodoCampos,
  refinarPeriodo,
  telefone,
  textoNulavel,
  timestamp,
  uuid,
} from './common.js';

export const contatoDto = z.object({
  id: uuid,
  tipo: z.enum(TIPOS_CONTATO),
  nome: z.string(),
  documento: z.string().nullable(),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO).nullable(),
  email: z.string().nullable(),
  telefone: z.string().nullable(),
  endereco: enderecoDto,
  observacoes: z.string().nullable(),
  ativo: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ContatoDto = z.infer<typeof contatoDto>;

/** Versão enxuta para combobox/seletores. */
export const contatoOpcaoDto = z.object({
  id: uuid,
  nome: z.string(),
  tipo: z.enum(TIPOS_CONTATO),
  documento: z.string().nullable(),
});
export type ContatoOpcaoDto = z.infer<typeof contatoOpcaoDto>;

const contatoCampos = z.object({
  tipo: z.enum(TIPOS_CONTATO, { error: 'Tipo deve ser cliente, fornecedor ou ambos' }),
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome')
    .max(120, 'Nome deve ter no máximo 120 caracteres'),
  documento: documentoInput.nullable().optional(),
  email: emailOpcional.nullable(),
  telefone: telefone.nullable().optional(),
  endereco: endereco.optional(),
  observacoes: textoNulavel,
});

export const criarContatoBody = contatoCampos;
export type CriarContatoBody = z.infer<typeof criarContatoBody>;

export const atualizarContatoBody = contatoCampos
  .partial()
  .extend({ ativo: z.boolean().optional() });
export type AtualizarContatoBody = z.infer<typeof atualizarContatoBody>;

export const ORDENACAO_CONTATOS = ['nome', 'createdAt'] as const;

export const listarContatosQuery = paginationQuery.extend({
  tipo: z.enum(TIPOS_CONTATO).optional(),
  busca: z.string().trim().max(80).optional(),
  /** Padrão: só ativos. */
  ativo: booleanoQuery.optional(),
  ordenarPor: z.enum(ORDENACAO_CONTATOS).default('nome'),
  ordem: ordemQuery.default('asc'),
});
export type ListarContatosQuery = z.infer<typeof listarContatosQuery>;

/** Todos os contatos ativos, sem paginação (seletores). */
export const opcoesContatosQuery = z.object({
  tipo: z.enum(TIPOS_CONTATO).optional(),
  busca: z.string().trim().max(80).optional(),
});
export type OpcoesContatosQuery = z.infer<typeof opcoesContatosQuery>;

/** GET /contatos/:id/lancamentos */
export const contatoLancamentosQuery = refinarPeriodo(paginationQuery.extend(periodoCampos));
export type ContatoLancamentosQuery = z.infer<typeof contatoLancamentosQuery>;

/** GET /contatos/:id/resumo */
export const contatoResumoDto = z.object({
  contatoId: uuid,
  totalReceitas: centavos,
  totalDespesas: centavos,
  saldo: centavos,
  quantidadeLancamentos: z.number().int(),
  primeiroLancamento: isoDate.nullable(),
  ultimoLancamento: isoDate.nullable(),
  /** Parcelas em aberto vinculadas ao contato. */
  aReceber: centavos,
  aPagar: centavos,
  atrasadoReceber: centavos,
  atrasadoPagar: centavos,
  notasFiscais: z.number().int(),
});
export type ContatoResumoDto = z.infer<typeof contatoResumoDto>;

export const contatoResponse = itemResponse(contatoDto);
export type ContatoResponse = z.infer<typeof contatoResponse>;

export const listaContatosResponse = paginatedResponse(contatoDto);
export type ListaContatosResponse = z.infer<typeof listaContatosResponse>;

export const opcoesContatosResponse = listaResponse(contatoOpcaoDto);
export type OpcoesContatosResponse = z.infer<typeof opcoesContatosResponse>;

export const contatoResumoResponse = itemResponse(contatoResumoDto);
export type ContatoResumoResponse = z.infer<typeof contatoResumoResponse>;
