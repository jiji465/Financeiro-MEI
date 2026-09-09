// Cliente HTTP tipado da API (/api/v1). Bearer vem da store de sessão; em 401 tenta um único
// refresh (single-flight) via cookie httpOnly e repete a requisição uma vez. Falhas de rede viram
// ApiError com code 'REDE'.
import { ERROR_STATUS } from '@meifin/shared';

import { env } from '@/app/env';
import { useAuthStore } from '@/features/auth/store';

import { ApiError, type ApiErrorDetail, MENSAGEM_REDE, mensagemPorStatus } from './errors';
import { type QueryParams, toQueryString } from './query';

export interface RequestOptions {
  query?: QueryParams;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Não tenta refresh em 401 (rotas públicas de auth já são ignoradas automaticamente). */
  semRefresh?: boolean;
}

export interface ArquivoBaixado {
  blob: Blob;
  /** Nome sugerido pelo servidor (Content-Disposition) ou undefined. */
  nomeArquivo: string | undefined;
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestInterno extends RequestOptions {
  metodo: Metodo;
  path: string;
  body?: unknown;
  formData?: FormData;
  resposta?: 'json' | 'blob';
}

/** Rotas públicas de auth: um 401 aqui é a resposta final (credenciais erradas, token inválido…). */
const ROTAS_SEM_REFRESH = [
  '/auth/login',
  '/auth/signup',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const CODIGO_POR_STATUS = new Map<number, string>(
  Object.entries(ERROR_STATUS).map(([codigo, status]) => [status, codigo]),
);

let refreshEmAndamento: Promise<string | null> | null = null;

/**
 * Renova o access token usando o cookie de refresh. Single-flight: chamadas concorrentes
 * compartilham a mesma promise. Retorna o novo token ou null (sessão inválida).
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshEmAndamento) {
    refreshEmAndamento = (async () => {
      try {
        const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return null;
        const corpo = (await res.json().catch(() => null)) as { accessToken?: string } | null;
        const token = corpo?.accessToken;
        if (!token) return null;
        useAuthStore.getState().setAccessToken(token);
        return token;
      } catch {
        return null;
      } finally {
        refreshEmAndamento = null;
      }
    })();
  }
  return refreshEmAndamento;
}

function montarUrl(path: string, query?: QueryParams): string {
  const base = env.apiBaseUrl.replace(/\/$/, '');
  const caminho = path.startsWith('/') ? path : `/${path}`;
  return `${base}${caminho}${toQueryString(query)}`;
}

function nomeDoContentDisposition(header: string | null): string | undefined {
  if (!header) return undefined;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);
  const simples = /filename="?([^";]+)"?/i.exec(header);
  return simples?.[1];
}

interface CorpoErro {
  error?: { code?: string; message?: string; details?: ApiErrorDetail[] };
  message?: string;
}

async function erroDaResposta(res: Response): Promise<ApiError> {
  const tipo = res.headers.get('content-type') ?? '';
  const codigoPadrao = CODIGO_POR_STATUS.get(res.status) ?? `HTTP_${res.status}`;
  if (tipo.includes('application/json')) {
    const corpo = (await res.json().catch(() => null)) as CorpoErro | null;
    const erro = corpo?.error;
    if (erro) {
      return new ApiError({
        status: res.status,
        code: erro.code ?? codigoPadrao,
        message: erro.message || mensagemPorStatus(res.status),
        details: erro.details,
      });
    }
    if (corpo?.message) {
      return new ApiError({ status: res.status, code: codigoPadrao, message: corpo.message });
    }
  }
  return new ApiError({
    status: res.status,
    code: codigoPadrao,
    message: mensagemPorStatus(res.status),
  });
}

async function executar<T>(req: RequestInterno, jaTentouRefresh = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...req.headers };
  const token = useAuthStore.getState().accessToken;
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (req.formData) {
    body = req.formData;
  } else if (req.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(req.body);
  }

  let res: Response;
  try {
    res = await fetch(montarUrl(req.path, req.query), {
      method: req.metodo,
      headers,
      body,
      credentials: 'include',
      signal: req.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError({ status: 0, code: 'REDE', message: MENSAGEM_REDE });
  }

  if (res.status === 401) {
    const podeRenovar =
      !jaTentouRefresh &&
      !req.semRefresh &&
      !ROTAS_SEM_REFRESH.some((rota) => req.path === rota || req.path.startsWith(`${rota}/`));
    if (podeRenovar) {
      const novoToken = await refreshAccessToken();
      if (novoToken) return executar<T>(req, true);
      useAuthStore.getState().clear();
    }
  }

  if (!res.ok) throw await erroDaResposta(res);

  if (req.resposta === 'blob') {
    const blob = await res.blob();
    const resultado: ArquivoBaixado = {
      blob,
      nomeArquivo: nomeDoContentDisposition(res.headers.get('content-disposition')),
    };
    return resultado as T;
  }

  if (res.status === 204) return undefined as T;
  const texto = await res.text();
  if (!texto) return undefined as T;
  return JSON.parse(texto) as T;
}

/**
 * Uso: `api.get<ListaResponse>('/lancamentos', { query: { de, ate } })`,
 * `api.post<AuthResponse>('/auth/login', body)`,
 * `api.blob('/relatorios/dre', { query: { formato: 'pdf' } })`.
 */
export const api = {
  get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return executar<T>({ metodo: 'GET', path, ...opts });
  },
  post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return executar<T>({ metodo: 'POST', path, body, ...opts });
  },
  put<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return executar<T>({ metodo: 'PUT', path, body, ...opts });
  },
  patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return executar<T>({ metodo: 'PATCH', path, body, ...opts });
  },
  delete<T = void>(path: string, opts?: RequestOptions): Promise<T> {
    return executar<T>({ metodo: 'DELETE', path, ...opts });
  },
  /** multipart/form-data (anexos, importação CSV). */
  upload<T>(path: string, formData: FormData, opts?: RequestOptions): Promise<T> {
    return executar<T>({ metodo: 'POST', path, formData, ...opts });
  },
  /** Baixa um arquivo (CSV/PDF) mantendo o nome sugerido pelo servidor. */
  blob(path: string, opts?: RequestOptions): Promise<ArquivoBaixado> {
    return executar<ArquivoBaixado>({ metodo: 'GET', path, resposta: 'blob', ...opts });
  },
};

export type ApiClient = typeof api;
