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

// Enumerações calculadas (não persistidas): status do DAS, nível do limite, agrupamentos etc.
export const STATUS_DAS = ['pago', 'pendente', 'atrasado', 'futuro'] as const;
export type StatusDas = (typeof STATUS_DAS)[number];

export const NIVEIS_LIMITE = ['ok', 'atencao', 'alerta', 'estourado'] as const;
export type NivelLimite = (typeof NIVEIS_LIMITE)[number];

export const TIPOS_EXCESSO = ['ate_20', 'acima_20'] as const;
export type TipoExcesso = (typeof TIPOS_EXCESSO)[number];

export const TIPOS_DOCUMENTO = ['cpf', 'cnpj'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const AGRUPAMENTOS_FLUXO = ['dia', 'semana', 'mes'] as const;
export type AgrupamentoFluxo = (typeof AGRUPAMENTOS_FLUXO)[number];

export const FORMATOS_RELATORIO = ['json', 'csv', 'pdf'] as const;
export type FormatoRelatorio = (typeof FORMATOS_RELATORIO)[number];

export const SEVERIDADES_ALERTA = ['info', 'aviso', 'critico'] as const;
export type SeveridadeAlerta = (typeof SEVERIDADES_ALERTA)[number];

export const PROVEDORES_NOTA = ['manual', 'sefaz'] as const;
export type ProvedorNota = (typeof PROVEDORES_NOTA)[number];

export const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
export type Uf = (typeof UFS)[number];

// ---------------------------------------------------------------------------
// Labels em pt-BR (tipados contra os enums; o web reexporta em labels.ts)
// ---------------------------------------------------------------------------

export const LABEL_ATIVIDADE: Record<Atividade, string> = {
  comercio: 'Comércio ou indústria',
  servicos: 'Prestação de serviços',
  comercio_servicos: 'Comércio e serviços',
  caminhoneiro: 'Transportador autônomo de cargas (MEI caminhoneiro)',
};

export const LABEL_CAMINHONEIRO_TRIBUTOS: Record<CaminhoneiroTributos, string> = {
  icms: 'ICMS (transporte intermunicipal/interestadual)',
  iss: 'ISS (transporte municipal)',
  ambos: 'ICMS e ISS',
};

export const LABEL_TIPO_LANCAMENTO: Record<TipoLancamento, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
};

export const LABEL_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  outro: 'Outro',
};

export const LABEL_STATUS_LANCAMENTO: Record<StatusLancamento, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
};

export const LABEL_ORIGEM_LANCAMENTO: Record<OrigemLancamento, string> = {
  manual: 'Manual',
  recorrencia: 'Recorrência',
  baixa: 'Baixa de parcela',
  das: 'Pagamento de DAS',
  importacao: 'Importação CSV',
  nota_fiscal: 'Nota fiscal',
};

export const LABEL_TIPO_CONTATO: Record<TipoContato, string> = {
  cliente: 'Cliente',
  fornecedor: 'Fornecedor',
  ambos: 'Cliente e fornecedor',
};

export const LABEL_GRUPO_DASN: Record<GrupoDasn, string> = {
  comercio: 'Comércio e indústria',
  servicos: 'Serviços',
};

export const LABEL_TIPO_TITULO: Record<TipoTitulo, string> = {
  pagar: 'A pagar',
  receber: 'A receber',
};

export const LABEL_STATUS_TITULO: Record<StatusTitulo, string> = {
  aberto: 'Em aberto',
  quitado: 'Quitado',
  cancelado: 'Cancelado',
};

export const LABEL_STATUS_PARCELA: Record<StatusParcela, string> = {
  aberta: 'Em aberto',
  paga: 'Paga',
  cancelada: 'Cancelada',
};

export const LABEL_TIPO_NOTA: Record<TipoNota, string> = {
  nfe: 'NF-e (produtos)',
  nfse: 'NFS-e (serviços)',
  nfce: 'NFC-e (consumidor)',
};

export const LABEL_STATUS_NOTA: Record<StatusNota, string> = {
  emitida: 'Emitida',
  cancelada: 'Cancelada',
};

export const LABEL_STATUS_DASN: Record<StatusDasn, string> = {
  pendente: 'Pendente',
  entregue: 'Entregue',
};

export const LABEL_REGIME_APURACAO: Record<RegimeApuracao, string> = {
  competencia: 'Competência (pela data do lançamento)',
  caixa: 'Caixa (pela data do pagamento)',
};

export const LABEL_USER_ROLE: Record<UserRole, string> = {
  owner: 'Titular',
  membro: 'Membro',
};

export const LABEL_STATUS_DAS: Record<StatusDas, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  atrasado: 'Atrasado',
  futuro: 'Futuro',
};

export const LABEL_NIVEL_LIMITE: Record<NivelLimite, string> = {
  ok: 'Dentro do limite',
  atencao: 'Atenção',
  alerta: 'Alerta',
  estourado: 'Limite estourado',
};

export const LABEL_TIPO_EXCESSO: Record<TipoExcesso, string> = {
  ate_20:
    'Excesso de até 20%: permanece MEI até 31/12, paga DAS complementar e é desenquadrado em 1º de janeiro seguinte',
  acima_20: 'Excesso acima de 20%: desenquadramento retroativo a 1º de janeiro do ano do excesso',
};

export const LABEL_AGRUPAMENTO_FLUXO: Record<AgrupamentoFluxo, string> = {
  dia: 'Por dia',
  semana: 'Por semana',
  mes: 'Por mês',
};

export const LABEL_SEVERIDADE_ALERTA: Record<SeveridadeAlerta, string> = {
  info: 'Informação',
  aviso: 'Aviso',
  critico: 'Crítico',
};

export const LABEL_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
};

export const MESES_PT_BR = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export const MESES_PT_BR_ABREV = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

// ---------------------------------------------------------------------------
// Erros da API: { error: { code, message, details? } }
// ---------------------------------------------------------------------------

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

export const LABEL_ERROR_CODE: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Dados inválidos',
  UNAUTHORIZED: 'Não autenticado',
  FORBIDDEN: 'Sem permissão',
  NOT_FOUND: 'Não encontrado',
  CONFLICT: 'Conflito com dados existentes',
  UNPROCESSABLE: 'Operação não permitida',
  RATE_LIMITED: 'Muitas tentativas; aguarde alguns minutos',
  PAYLOAD_TOO_LARGE: 'Arquivo grande demais',
  INTERNAL_ERROR: 'Erro interno',
};

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

// ---------------------------------------------------------------------------
// Parâmetros do MEI: apenas NOMES/CHAVES. Os valores vivem na tabela parametros_mei (por ano).
// ---------------------------------------------------------------------------

/** Colunas da tabela parametros_mei (camelCase dos DTOs). */
export const MEI_PARAMETROS_CHAVES = [
  'salarioMinimo',
  'aliquotaInssBp',
  'aliquotaInssCaminhoneiroBp',
  'icms',
  'iss',
  'limiteAnual',
  'limiteMensalProporcional',
  'toleranciaExcessoBp',
  'diaVencimentoDas',
  'dasnPrazoDia',
  'dasnPrazoMes',
  'alertasLimitePct',
] as const;
export type MeiParametroChave = (typeof MEI_PARAMETROS_CHAVES)[number];

export const LABEL_MEI_PARAMETRO: Record<MeiParametroChave, string> = {
  salarioMinimo: 'Salário mínimo',
  aliquotaInssBp: 'Alíquota INSS (MEI)',
  aliquotaInssCaminhoneiroBp: 'Alíquota INSS (MEI caminhoneiro)',
  icms: 'ICMS fixo mensal',
  iss: 'ISS fixo mensal',
  limiteAnual: 'Limite anual de faturamento',
  limiteMensalProporcional: 'Limite mensal proporcional (ano de abertura)',
  toleranciaExcessoBp: 'Tolerância de excesso',
  diaVencimentoDas: 'Dia de vencimento do DAS',
  dasnPrazoDia: 'Dia do prazo da DASN-SIMEI',
  dasnPrazoMes: 'Mês do prazo da DASN-SIMEI',
  alertasLimitePct: 'Percentuais de alerta do limite',
};

/** Prefixos das chaves estáveis de alertas (seção 5 do plano). */
export const ALERTA_PREFIXOS = {
  das: 'das',
  limite: 'limite',
  dasn: 'dasn',
  parcelas: 'parcelas',
  parametros: 'parametros',
  cadastro: 'cadastro',
} as const;

/** Dias de antecedência padrão para alertas (espelham as colunas de `configuracoes`). */
export const ALERTA_DIAS_PADRAO = {
  vencimento: 7,
  das: 7,
} as const;

// ---------------------------------------------------------------------------
// Template de categorias padrão (aplicado no signup, filtrado por atividade)
// ---------------------------------------------------------------------------

export interface CategoriaPadrao {
  nome: string;
  tipo: TipoLancamento;
  /** Só para receitas: separa comércio/serviços na DASN. null = usuário precisa classificar. */
  grupoDasn: GrupoDasn | null;
  /** Indeletável (ex.: "Impostos e DAS"). */
  sistema: boolean;
  cor: string;
  icone: string;
  /** Atividades para as quais a categoria é criada. */
  atividades: readonly Atividade[];
  ordem: number;
}

const TODAS: readonly Atividade[] = ATIVIDADES;
const COM_COMERCIO: readonly Atividade[] = ['comercio', 'comercio_servicos'];
const COM_SERVICOS: readonly Atividade[] = ['servicos', 'comercio_servicos'];
const CAMINHONEIRO: readonly Atividade[] = ['caminhoneiro'];

/** Nome da categoria de sistema usada pelos pagamentos de DAS. */
export const CATEGORIA_DAS_NOME = 'Impostos e DAS' as const;

export const CATEGORIAS_PADRAO: readonly CategoriaPadrao[] = [
  // Receitas
  {
    nome: 'Venda de produtos',
    tipo: 'receita',
    grupoDasn: 'comercio',
    sistema: false,
    cor: '#16a34a',
    icone: 'shopping-bag',
    atividades: COM_COMERCIO,
    ordem: 1,
  },
  {
    nome: 'Prestação de serviços',
    tipo: 'receita',
    grupoDasn: 'servicos',
    sistema: false,
    cor: '#0891b2',
    icone: 'briefcase',
    atividades: COM_SERVICOS,
    ordem: 2,
  },
  {
    nome: 'Fretes e transporte',
    tipo: 'receita',
    grupoDasn: 'servicos',
    sistema: false,
    cor: '#0891b2',
    icone: 'truck',
    atividades: CAMINHONEIRO,
    ordem: 3,
  },
  {
    nome: 'Outras receitas',
    tipo: 'receita',
    grupoDasn: null,
    sistema: false,
    cor: '#65a30d',
    icone: 'plus-circle',
    atividades: TODAS,
    ordem: 9,
  },
  // Despesas
  {
    nome: CATEGORIA_DAS_NOME,
    tipo: 'despesa',
    grupoDasn: null,
    sistema: true,
    cor: '#dc2626',
    icone: 'landmark',
    atividades: TODAS,
    ordem: 10,
  },
  {
    nome: 'Mercadorias e fornecedores',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#ea580c',
    icone: 'package',
    atividades: COM_COMERCIO,
    ordem: 11,
  },
  {
    nome: 'Materiais e insumos',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#d97706',
    icone: 'wrench',
    atividades: TODAS,
    ordem: 12,
  },
  {
    nome: 'Combustível',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#b45309',
    icone: 'fuel',
    atividades: CAMINHONEIRO,
    ordem: 13,
  },
  {
    nome: 'Manutenção do veículo',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#78716c',
    icone: 'settings',
    atividades: CAMINHONEIRO,
    ordem: 14,
  },
  {
    nome: 'Pedágios',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#a16207',
    icone: 'route',
    atividades: CAMINHONEIRO,
    ordem: 15,
  },
  {
    nome: 'Aluguel',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#7c3aed',
    icone: 'home',
    atividades: TODAS,
    ordem: 16,
  },
  {
    nome: 'Água, luz e gás',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#2563eb',
    icone: 'zap',
    atividades: TODAS,
    ordem: 17,
  },
  {
    nome: 'Telefone e internet',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#0284c7',
    icone: 'wifi',
    atividades: TODAS,
    ordem: 18,
  },
  {
    nome: 'Marketing e divulgação',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#db2777',
    icone: 'megaphone',
    atividades: TODAS,
    ordem: 19,
  },
  {
    nome: 'Transporte e deslocamento',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#0d9488',
    icone: 'car',
    atividades: ['comercio', 'servicos', 'comercio_servicos'],
    ordem: 20,
  },
  {
    nome: 'Alimentação',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#f59e0b',
    icone: 'utensils',
    atividades: TODAS,
    ordem: 21,
  },
  {
    nome: 'Equipamentos e ferramentas',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#4f46e5',
    icone: 'hammer',
    atividades: TODAS,
    ordem: 22,
  },
  {
    nome: 'Taxas bancárias',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#475569',
    icone: 'credit-card',
    atividades: TODAS,
    ordem: 23,
  },
  {
    nome: 'Pró-labore (retirada)',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#9333ea',
    icone: 'user',
    atividades: TODAS,
    ordem: 24,
  },
  {
    nome: 'Outras despesas',
    tipo: 'despesa',
    grupoDasn: null,
    sistema: false,
    cor: '#6b7280',
    icone: 'more-horizontal',
    atividades: TODAS,
    ordem: 29,
  },
];

/** Filtra o template de categorias para a atividade do MEI. */
export function categoriasPadraoPara(atividade: Atividade): CategoriaPadrao[] {
  return CATEGORIAS_PADRAO.filter((c) => c.atividades.includes(atividade));
}
