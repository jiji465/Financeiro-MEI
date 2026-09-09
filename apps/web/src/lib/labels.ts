// Rótulos pt-BR tipados contra os enums do @meifin/shared. Se um valor novo entrar no enum,
// o TypeScript acusa aqui (Record exige todas as chaves).
import type {
  Atividade,
  CaminhoneiroTributos,
  ErrorCode,
  FormaPagamento,
  GrupoDasn,
  OrigemLancamento,
  RegimeApuracao,
  StatusDasn,
  StatusLancamento,
  StatusNota,
  StatusParcela,
  StatusTitulo,
  TipoContato,
  TipoLancamento,
  TipoNota,
  TipoTitulo,
  UserRole,
} from '@meifin/shared';

export const ATIVIDADE_LABELS: Record<Atividade, string> = {
  comercio: 'Comércio ou indústria',
  servicos: 'Prestação de serviços',
  comercio_servicos: 'Comércio e serviços',
  caminhoneiro: 'MEI Caminhoneiro',
};

export const ATIVIDADE_DESCRICOES: Record<Atividade, string> = {
  comercio: 'Vende produtos (loja, revenda, fabricação). Recolhe INSS + ICMS.',
  servicos: 'Presta serviços (consultoria, reparos, beleza…). Recolhe INSS + ISS.',
  comercio_servicos: 'Vende produtos e presta serviços. Recolhe INSS + ICMS + ISS.',
  caminhoneiro: 'Transportador autônomo de cargas. INSS de 12% + ICMS e/ou ISS.',
};

export const CAMINHONEIRO_TRIBUTOS_LABELS: Record<CaminhoneiroTributos, string> = {
  icms: 'Só ICMS (transporte intermunicipal/interestadual)',
  iss: 'Só ISS (transporte dentro do município)',
  ambos: 'ICMS e ISS',
};

export const TIPO_LANCAMENTO_LABELS: Record<TipoLancamento, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
};

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  outro: 'Outro',
};

export const STATUS_LANCAMENTO_LABELS: Record<StatusLancamento, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
};

export const ORIGEM_LANCAMENTO_LABELS: Record<OrigemLancamento, string> = {
  manual: 'Manual',
  recorrencia: 'Recorrência',
  baixa: 'Baixa de parcela',
  das: 'DAS',
  importacao: 'Importação',
  nota_fiscal: 'Nota fiscal',
};

export const TIPO_CONTATO_LABELS: Record<TipoContato, string> = {
  cliente: 'Cliente',
  fornecedor: 'Fornecedor',
  ambos: 'Cliente e fornecedor',
};

export const GRUPO_DASN_LABELS: Record<GrupoDasn, string> = {
  comercio: 'Comércio/indústria',
  servicos: 'Serviços',
};

export const TIPO_TITULO_LABELS: Record<TipoTitulo, string> = {
  pagar: 'A pagar',
  receber: 'A receber',
};

export const STATUS_TITULO_LABELS: Record<StatusTitulo, string> = {
  aberto: 'Em aberto',
  quitado: 'Quitado',
  cancelado: 'Cancelado',
};

export const STATUS_PARCELA_LABELS: Record<StatusParcela, string> = {
  aberta: 'Em aberto',
  paga: 'Paga',
  cancelada: 'Cancelada',
};

export const TIPO_NOTA_LABELS: Record<TipoNota, string> = {
  nfe: 'NF-e',
  nfse: 'NFS-e',
  nfce: 'NFC-e',
};

export const STATUS_NOTA_LABELS: Record<StatusNota, string> = {
  emitida: 'Emitida',
  cancelada: 'Cancelada',
};

export const STATUS_DASN_LABELS: Record<StatusDasn, string> = {
  pendente: 'Pendente',
  entregue: 'Entregue',
};

export const REGIME_APURACAO_LABELS: Record<RegimeApuracao, string> = {
  competencia: 'Competência (pela data do lançamento)',
  caixa: 'Caixa (pela data do pagamento)',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Titular',
  membro: 'Membro',
};

export const ERROR_CODE_LABELS: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Dados inválidos',
  UNAUTHORIZED: 'Não autorizado',
  FORBIDDEN: 'Sem permissão',
  NOT_FOUND: 'Não encontrado',
  CONFLICT: 'Conflito',
  UNPROCESSABLE: 'Não foi possível processar',
  RATE_LIMITED: 'Muitas tentativas',
  PAYLOAD_TOO_LARGE: 'Arquivo muito grande',
  INTERNAL_ERROR: 'Erro interno',
};

export interface Opcao<V extends string = string> {
  value: V;
  label: string;
}

/** Converte um mapa de rótulos em opções para Select/RadioCards, na ordem do enum. */
export function opcoesDe<V extends string>(
  valores: readonly V[],
  labels: Record<V, string>,
): Opcao<V>[] {
  return valores.map((value) => ({ value, label: labels[value] }));
}
