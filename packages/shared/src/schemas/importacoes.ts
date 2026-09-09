// Contratos do módulo "importacoes" (seção 4 do plano): POST /csv/preview (multipart + mapeamento), POST /csv/confirmar, GET.
import { z } from 'zod';

import { FORMAS_PAGAMENTO, STATUS_LANCAMENTO, TIPOS_LANCAMENTO } from '../constants.js';
import {
  centavosPositivo,
  isoDate,
  itemResponse,
  paginatedResponse,
  paginationQuery,
  timestamp,
  uuid,
} from './common.js';

// ---------------------------------------------------------------------------
// Mapeamento de colunas
// ---------------------------------------------------------------------------

/** Como interpretar a coluna "tipo": pelo sinal do valor, por texto (receita/despesa) ou fixo. */
export const MODOS_TIPO_IMPORTACAO = ['sinal', 'coluna', 'fixo'] as const;
export type ModoTipoImportacao = (typeof MODOS_TIPO_IMPORTACAO)[number];

const nomeColuna = z.string().trim().min(1, 'Informe a coluna').max(120);

/** Nomes das colunas do CSV do usuário para cada campo do lançamento. */
export const mapeamentoCsv = z
  .object({
    data: nomeColuna,
    valor: nomeColuna,
    descricao: nomeColuna,
    /** Coluna com "receita"/"despesa" (ou "crédito"/"débito", "C"/"D", "entrada"/"saída"). */
    tipo: nomeColuna.optional(),
    modoTipo: z.enum(MODOS_TIPO_IMPORTACAO).default('sinal'),
    /** Usado quando modoTipo = fixo. */
    tipoFixo: z.enum(TIPOS_LANCAMENTO).optional(),
    /** Coluna com o nome da categoria (casada por nome; senão usa categoriaPadrao). */
    categoria: nomeColuna.optional(),
    /** Coluna com o nome do contato (casada por nome; não cria contatos). */
    contato: nomeColuna.optional(),
    formaPagamento: nomeColuna.optional(),
    observacoes: nomeColuna.optional(),
    /** Categoria usada quando a linha não casa com nenhuma categoria. */
    categoriaPadraoReceitaId: uuid.optional(),
    categoriaPadraoDespesaId: uuid.optional(),
    statusPadrao: z.enum(STATUS_LANCAMENTO).default('pago'),
    formaPagamentoPadrao: z.enum(FORMAS_PAGAMENTO).optional(),
    /** Inverte o sinal (extratos de cartão trazem despesas positivas). */
    inverterSinal: z.boolean().default(false),
  })
  .superRefine((m, ctx) => {
    if (m.modoTipo === 'coluna' && !m.tipo) {
      ctx.addIssue({ code: 'custom', path: ['tipo'], message: 'Informe a coluna do tipo' });
    }
    if (m.modoTipo === 'fixo' && !m.tipoFixo) {
      ctx.addIssue({ code: 'custom', path: ['tipoFixo'], message: 'Informe o tipo fixo' });
    }
  });
export type MapeamentoCsv = z.infer<typeof mapeamentoCsv>;

/** Campos de texto do multipart em POST /importacoes/csv/preview (o arquivo vai no campo `arquivo`). */
export const previewImportacaoCampos = z.object({
  /** JSON de MapeamentoCsv serializado como string (multipart). */
  mapeamento: z
    .string()
    .min(2, 'Mapeamento obrigatório')
    .transform((texto, ctx) => {
      try {
        return JSON.parse(texto) as unknown;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Mapeamento deve ser um JSON válido' });
        return z.NEVER;
      }
    })
    .pipe(mapeamentoCsv),
});
export type PreviewImportacaoCampos = z.infer<typeof previewImportacaoCampos>;

/** Versão JSON (sem multipart): texto do CSV no corpo. */
export const previewImportacaoBody = z.object({
  nomeArquivo: z.string().trim().min(1).max(200),
  conteudo: z.string().min(1, 'Arquivo vazio').max(5_000_000, 'Arquivo grande demais'),
  mapeamento: mapeamentoCsv,
});
export type PreviewImportacaoBody = z.infer<typeof previewImportacaoBody>;

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export const linhaImportacaoDto = z.object({
  /** Número da linha no arquivo (1 = primeira após o cabeçalho). */
  numero: z.number().int(),
  data: isoDate.nullable(),
  valor: centavosPositivo.nullable(),
  descricao: z.string(),
  tipo: z.enum(TIPOS_LANCAMENTO).nullable(),
  categoriaId: uuid.nullable(),
  categoriaNome: z.string().nullable(),
  contatoId: uuid.nullable(),
  contatoNome: z.string().nullable(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).nullable(),
  status: z.enum(STATUS_LANCAMENTO),
  observacoes: z.string().nullable(),
  /** sha256(tenant + data + valor + tipo + descricao normalizada) — dedupe. */
  hash: z.string(),
  /** Já existe lançamento com o mesmo hash (ou linha repetida no próprio arquivo). */
  duplicada: z.boolean(),
  /** Mensagem de erro (linha não importável) ou null. */
  erro: z.string().nullable(),
  bruto: z.record(z.string(), z.string()),
});
export type LinhaImportacaoDto = z.infer<typeof linhaImportacaoDto>;

export const previewImportacaoDto = z.object({
  nomeArquivo: z.string(),
  delimitador: z.string(),
  cabecalho: z.array(z.string()),
  totalLinhas: z.number().int(),
  validas: z.number().int(),
  comErro: z.number().int(),
  duplicadas: z.number().int(),
  linhas: z.array(linhaImportacaoDto),
});
export type PreviewImportacaoDto = z.infer<typeof previewImportacaoDto>;

export const previewImportacaoResponse = itemResponse(previewImportacaoDto);
export type PreviewImportacaoResponse = z.infer<typeof previewImportacaoResponse>;

// ---------------------------------------------------------------------------
// Confirmação
// ---------------------------------------------------------------------------

export const linhaConfirmarImportacao = z.object({
  numero: z.number().int().min(1),
  data: isoDate,
  valor: centavosPositivo,
  descricao: z
    .string()
    .trim()
    .min(1, 'Informe a descrição')
    .max(160, 'Descrição deve ter no máximo 160 caracteres'),
  tipo: z.enum(TIPOS_LANCAMENTO),
  categoriaId: uuid,
  contatoId: uuid.nullable().optional(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).nullable().optional(),
  status: z.enum(STATUS_LANCAMENTO).default('pago'),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  hash: z.string().min(16, 'Hash inválido').max(128),
});
export type LinhaConfirmarImportacao = z.infer<typeof linhaConfirmarImportacao>;

export const confirmarImportacaoBody = z.object({
  nomeArquivo: z.string().trim().min(1).max(200),
  totalLinhas: z.number().int().min(0),
  mapeamento: mapeamentoCsv,
  linhas: z.array(linhaConfirmarImportacao).min(1, 'Nenhuma linha para importar').max(5000),
  /** Padrão true: pula linhas cujo hash já existe. */
  ignorarDuplicadas: z.boolean().default(true),
});
export type ConfirmarImportacaoBody = z.infer<typeof confirmarImportacaoBody>;

export const importacaoDto = z.object({
  id: uuid,
  nomeArquivo: z.string(),
  formato: z.string(),
  totalLinhas: z.number().int(),
  importadas: z.number().int(),
  ignoradas: z.number().int(),
  duplicadas: z.number().int(),
  mapeamento: z.record(z.string(), z.unknown()),
  createdAt: timestamp,
});
export type ImportacaoDto = z.infer<typeof importacaoDto>;

export const importacaoResponse = itemResponse(importacaoDto);
export type ImportacaoResponse = z.infer<typeof importacaoResponse>;

export const listarImportacoesQuery = paginationQuery;
export type ListarImportacoesQuery = z.infer<typeof listarImportacoesQuery>;

export const listaImportacoesResponse = paginatedResponse(importacaoDto);
export type ListaImportacoesResponse = z.infer<typeof listaImportacoesResponse>;

/** POST /importacoes/:id/desfazer — remove os lançamentos criados pela importação. */
export const desfazerImportacaoResponse = itemResponse(
  z.object({ id: uuid, removidos: z.number().int() }),
);
export type DesfazerImportacaoResponse = z.infer<typeof desfazerImportacaoResponse>;
