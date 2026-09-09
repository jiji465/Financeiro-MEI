// Mock mínimo de fetch para testes: declare rotas (método + caminho) e respostas.
//   const fetchMock = mockFetch([
//     { method: 'POST', path: '/api/v1/auth/login', status: 200, body: criarAuthResponse() },
//     { path: /\/api\/v1\/lancamentos/, body: { data: [], meta: { page: 1, pageSize: 50, total: 0 } } },
//   ]);
//   expect(fetchMock.calls[0]?.body).toEqual({ email: '…', senha: '…' });
import { vi } from 'vitest';

export interface ChamadaFetch {
  url: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface RespostaMock {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RotaMock extends RespostaMock {
  method?: string;
  path: string | RegExp;
  /** Resposta dinâmica (recebe a chamada e a contagem de vezes que a rota já respondeu). */
  handler?: (chamada: ChamadaFetch, vez: number) => RespostaMock | Promise<RespostaMock>;
  /** Simula falha de rede (fetch rejeita). */
  falhaRede?: boolean;
}

export interface FetchMock {
  calls: ChamadaFetch[];
  /** Chamadas filtradas por caminho (string = igualdade, RegExp = teste). */
  chamadas: (path: string | RegExp, method?: string) => ChamadaFetch[];
  /** Acrescenta/substitui rotas depois de criado. */
  rota: (rota: RotaMock) => void;
  restore: () => void;
}

function casa(rota: RotaMock, chamada: ChamadaFetch): boolean {
  if (rota.method && rota.method.toUpperCase() !== chamada.method) return false;
  return typeof rota.path === 'string' ? rota.path === chamada.path : rota.path.test(chamada.path);
}

function montarResponse(resposta: RespostaMock): Response {
  const status = resposta.status ?? 200;
  if (status === 204 || resposta.body === undefined) {
    return new Response(null, { status, headers: resposta.headers });
  }
  return new Response(JSON.stringify(resposta.body), {
    status,
    headers: { 'content-type': 'application/json', ...resposta.headers },
  });
}

export function respostaErro(
  status: number,
  code: string,
  message: string,
  details?: { campo: string; mensagem: string }[],
): RespostaMock {
  return { status, body: { error: { code, message, details } } };
}

export function mockFetch(rotas: RotaMock[] = []): FetchMock {
  const lista = [...rotas];
  const contagem = new Map<RotaMock, number>();
  const calls: ChamadaFetch[] = [];

  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0] ?? url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    let body: unknown = init?.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // texto puro
      }
    }
    const chamada: ChamadaFetch = {
      url,
      path,
      method: (init?.method ?? 'GET').toUpperCase(),
      headers,
      body,
    };
    calls.push(chamada);

    const rota = [...lista].reverse().find((r) => casa(r, chamada));
    if (!rota) {
      return montarResponse(
        respostaErro(404, 'NOT_FOUND', `Rota não mockada: ${chamada.method} ${path}`),
      );
    }
    if (rota.falhaRede) throw new TypeError('Failed to fetch');
    const vez = contagem.get(rota) ?? 0;
    contagem.set(rota, vez + 1);
    const resposta = rota.handler ? await rota.handler(chamada, vez) : rota;
    return montarResponse(resposta);
  });

  vi.stubGlobal('fetch', fn);

  return {
    calls,
    chamadas: (path, method) =>
      calls.filter(
        (c) =>
          (typeof path === 'string' ? c.path === path : path.test(c.path)) &&
          (!method || c.method === method.toUpperCase()),
      ),
    rota: (rota) => {
      lista.push(rota);
    },
    restore: () => vi.unstubAllGlobals(),
  };
}
