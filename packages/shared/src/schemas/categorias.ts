// Contratos do módulo "categorias" (seção 4 do plano): CRUD; DELETE de categoria referenciada só desativa; sistema → 409.
import { z } from 'zod';

import { GRUPOS_DASN, TIPOS_LANCAMENTO } from '../constants.js';
import { booleanoQuery, corHex, itemResponse, listaResponse, timestamp, uuid } from './common.js';

export const categoriaDto = z.object({
  id: uuid,
  nome: z.string(),
  tipo: z.enum(TIPOS_LANCAMENTO),
  grupoDasn: z.enum(GRUPOS_DASN).nullable(),
  cor: z.string().nullable(),
  icone: z.string().nullable(),
  padrao: z.boolean(),
  sistema: z.boolean(),
  ativo: z.boolean(),
  ordem: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type CategoriaDto = z.infer<typeof categoriaDto>;

const nomeCategoria = z
  .string()
  .trim()
  .min(1, 'Informe o nome da categoria')
  .max(60, 'Nome deve ter no máximo 60 caracteres');

const categoriaCampos = z.object({
  nome: nomeCategoria,
  tipo: z.enum(TIPOS_LANCAMENTO, { error: 'Tipo deve ser receita ou despesa' }),
  grupoDasn: z
    .enum(GRUPOS_DASN, { error: 'Grupo deve ser comércio ou serviços' })
    .nullable()
    .optional(),
  cor: corHex.nullable().optional(),
  icone: z.string().trim().max(40).nullable().optional(),
  ordem: z.number().int().min(0).max(9999).optional(),
});

const grupoSoEmReceita = {
  message: 'Grupo da DASN só se aplica a categorias de receita',
  path: ['grupoDasn'],
};

export const criarCategoriaBody = categoriaCampos.refine(
  (c) => c.tipo === 'receita' || c.grupoDasn == null,
  grupoSoEmReceita,
);
export type CriarCategoriaBody = z.infer<typeof criarCategoriaBody>;

export const atualizarCategoriaBody = categoriaCampos
  .omit({ tipo: true })
  .extend({ ativo: z.boolean().optional() })
  .partial();
export type AtualizarCategoriaBody = z.infer<typeof atualizarCategoriaBody>;

export const listarCategoriasQuery = z.object({
  tipo: z.enum(TIPOS_LANCAMENTO).optional(),
  /** Padrão: só ativas. `?ativo=false` traz inativas; omita `todas=true` para trazer tudo. */
  ativo: booleanoQuery.optional(),
  todas: booleanoQuery.optional(),
  busca: z.string().trim().max(80).optional(),
});
export type ListarCategoriasQuery = z.infer<typeof listarCategoriasQuery>;

export const categoriaResponse = itemResponse(categoriaDto);
export type CategoriaResponse = z.infer<typeof categoriaResponse>;

export const listaCategoriasResponse = listaResponse(categoriaDto);
export type ListaCategoriasResponse = z.infer<typeof listaCategoriasResponse>;

/** DELETE: `excluida` quando removida; `desativada` quando havia lançamentos referenciando. */
export const excluirCategoriaResponse = itemResponse(
  z.object({
    id: uuid,
    excluida: z.boolean(),
    desativada: z.boolean(),
    lancamentosVinculados: z.number().int(),
  }),
);
export type ExcluirCategoriaResponse = z.infer<typeof excluirCategoriaResponse>;
