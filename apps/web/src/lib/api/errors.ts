// Erro tipado da API ({ error: { code, message, details? } }) e utilitários para formulários.
import type { ErrorCode } from '@meifin/shared';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

export interface ApiErrorDetail {
  campo: string;
  mensagem: string;
}

/** Códigos além dos da API: REDE (falha de conexão) e HTTP_<status> (resposta sem envelope). */
export type ApiErrorCode = ErrorCode | 'REDE' | (string & {});

export interface ApiErrorInit {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetail[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: ApiErrorDetail[] | undefined;

  constructor({ status, code, message, details }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isRede(): boolean {
    return this.code === 'REDE';
  }
  get isNaoAutorizado(): boolean {
    return this.status === 401;
  }
  get isNaoEncontrado(): boolean {
    return this.status === 404;
  }
  get isValidacao(): boolean {
    return this.status === 400 || this.status === 422;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export const MENSAGEM_REDE =
  'Sem conexão com o servidor. Verifique sua internet e tente novamente.';

export const MENSAGENS_POR_STATUS: Record<number, string> = {
  400: 'Dados inválidos. Revise os campos e tente novamente.',
  401: 'Sua sessão expirou. Entre novamente.',
  403: 'Você não tem permissão para esta ação.',
  404: 'Registro não encontrado.',
  409: 'Já existe um registro com esses dados.',
  413: 'Arquivo muito grande.',
  422: 'Não foi possível processar os dados enviados.',
  429: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  500: 'Erro interno do servidor. Tente novamente em instantes.',
  502: 'Servidor indisponível no momento.',
  503: 'Servidor indisponível no momento.',
};

export function mensagemPorStatus(status: number): string {
  return MENSAGENS_POR_STATUS[status] ?? 'Algo deu errado. Tente novamente.';
}

/** Mensagem legível para toasts/estados de erro, sempre em pt-BR. */
export function getErrorMessage(
  err: unknown,
  fallback = 'Algo deu errado. Tente novamente.',
): string {
  if (isApiError(err)) {
    if (err.isRede) return MENSAGEM_REDE;
    return err.message || mensagemPorStatus(err.status);
  }
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

function normalizarCampo(campo: string): string {
  return campo.replace(/^(body|query|params)\./, '');
}

/**
 * Aplica os erros de validação da API ao react-hook-form: `details[].campo` → erro do campo;
 * quando não há detalhes (ou nenhum campo casou) o erro vai para `root.serverError`.
 * Retorna true se ao menos um erro de campo foi aplicado.
 */
export function aplicarErrosDoServidor<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  opcoes: { campos?: readonly string[] } = {},
): boolean {
  if (!isApiError(err)) {
    setError('root.serverError', { type: 'server', message: getErrorMessage(err) });
    return false;
  }
  let aplicouCampo = false;
  for (const detalhe of err.details ?? []) {
    const campo = normalizarCampo(detalhe.campo);
    if (!campo) continue;
    if (opcoes.campos && !opcoes.campos.includes(campo)) continue;
    setError(
      campo as Path<T>,
      { type: 'server', message: detalhe.mensagem },
      { shouldFocus: !aplicouCampo },
    );
    aplicouCampo = true;
  }
  if (!aplicouCampo) {
    setError('root.serverError', { type: 'server', message: getErrorMessage(err) });
  }
  return aplicouCampo;
}
