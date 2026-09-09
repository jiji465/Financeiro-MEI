// Enumerações do domínio: fonte única para pgEnum (API), labels (web) e schemas zod.
// Adicionar valores aqui exige migração no banco (Phase 3).

export const ATIVIDADES = ['comercio', 'servicos', 'comercio_servicos', 'caminhoneiro'] as const;
export type Atividade = (typeof ATIVIDADES)[number];

export const CAMINHONEIRO_TRIBUTOS = ['icms', 'iss', 'ambos'] as const;
export type CaminhoneiroTributos = (typeof CAMINHONEIRO_TRIBUTOS)[number];

export const TIPOS_LANCAMENTO = ['receita', 'despesa'] as const;
export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number];

export const FORMAS_PAGAMENTO = [
  'pix',
  'dinheiro',
  'cartao',
  'boleto',
  'transferencia',
  'outro',
] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const STATUS_LANCAMENTO = ['pago', 'pendente'] as const;
export type StatusLancamento = (typeof STATUS_LANCAMENTO)[number];

export const ORIGENS_LANCAMENTO = [
  'manual',
  'recorrencia',
  'baixa',
  'das',
  'importacao',
  'nota_fiscal',
] as const;
export type OrigemLancamento = (typeof ORIGENS_LANCAMENTO)[number];

export const TIPOS_CONTATO = ['cliente', 'fornecedor', 'ambos'] as const;
export type TipoContato = (typeof TIPOS_CONTATO)[number];

export const GRUPOS_DASN = ['comercio', 'servicos'] as const;
export type GrupoDasn = (typeof GRUPOS_DASN)[number];

export const TIPOS_TITULO = ['pagar', 'receber'] as const;
export type TipoTitulo = (typeof TIPOS_TITULO)[number];

export const STATUS_TITULO = ['aberto', 'quitado', 'cancelado'] as const;
export type StatusTitulo = (typeof STATUS_TITULO)[number];

export const STATUS_PARCELA = ['aberta', 'paga', 'cancelada'] as const;
export type StatusParcela = (typeof STATUS_PARCELA)[number];

export const TIPOS_NOTA = ['nfe', 'nfse', 'nfce'] as const;
export type TipoNota = (typeof TIPOS_NOTA)[number];

export const STATUS_NOTA = ['emitida', 'cancelada'] as const;
export type StatusNota = (typeof STATUS_NOTA)[number];

export const STATUS_DASN = ['pendente', 'entregue'] as const;
export type StatusDasn = (typeof STATUS_DASN)[number];

export const REGIMES_APURACAO = ['competencia', 'caixa'] as const;
export type RegimeApuracao = (typeof REGIMES_APURACAO)[number];

export const USER_ROLES = ['owner', 'membro'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Códigos de erro da API: { error: { code, message, details? } }
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
} as const satisfies Record<ErrorCode, number>;

// Convenções de paginação (seção 4 do plano)
export const PAGINACAO = {
  pageSizePadrao: 50,
  pageSizeMax: 200,
} as const;

// Anexos de lançamentos / notas
export const ANEXO = {
  tamanhoMaxBytes: 10 * 1024 * 1024,
  mimesPermitidos: ['application/pdf', 'image/jpeg', 'image/png', 'application/xml', 'text/xml'],
} as const;

export const API_PREFIX = '/api/v1' as const;
