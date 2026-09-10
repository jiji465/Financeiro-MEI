import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/features/auth/store';
import { mockFetch, respostaErro } from '@/test/fetch-mock';

import { api, refreshAccessToken } from './client';
import { type ApiError, isApiError } from './errors';

afterEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, tenant: null, bootstrapped: false });
});

describe('api client', () => {
  it('envia Bearer, Accept e serializa a query descartando vazios', async () => {
    useAuthStore.getState().setAccessToken('tok-1');
    const fetchMock = mockFetch([
      {
        method: 'GET',
        path: '/api/v1/lancamentos',
        body: { data: [], meta: { page: 1, pageSize: 50, total: 0 } },
      },
    ]);
    const res = await api.get<{ data: unknown[] }>('/lancamentos', {
      query: { de: '2026-03-01', ate: undefined, busca: '', tipo: 'receita', page: 2 },
    });
    expect(res.data).toEqual([]);
    const chamada = fetchMock.calls[0];
    expect(chamada?.url).toBe('/api/v1/lancamentos?de=2026-03-01&tipo=receita&page=2');
    expect(chamada?.headers.authorization).toBe('Bearer tok-1');
    expect(chamada?.headers.accept).toBe('application/json');
  });

  it('POST envia JSON e credentials', async () => {
    const fetchMock = mockFetch([
      { method: 'POST', path: '/api/v1/x', status: 201, body: { data: { id: 1 } } },
    ]);
    const res = await api.post<{ data: { id: number } }>('/x', { nome: 'a' });
    expect(res.data.id).toBe(1);
    expect(fetchMock.calls[0]?.body).toEqual({ nome: 'a' });
    expect(fetchMock.calls[0]?.headers['content-type']).toBe('application/json');
  });

  it('204 devolve undefined', async () => {
    mockFetch([{ method: 'DELETE', path: '/api/v1/x/1', status: 204 }]);
    await expect(api.delete('/x/1')).resolves.toBeUndefined();
  });

  it('converte o envelope de erro em ApiError com details', async () => {
    mockFetch([
      {
        method: 'POST',
        path: '/api/v1/x',
        ...respostaErro(400, 'VALIDATION_ERROR', 'Dados inválidos', [
          { campo: 'nome', mensagem: 'Obrigatório' },
        ]),
      },
    ]);
    const erro = await api.post('/x', {}).catch((e: unknown) => e);
    expect(isApiError(erro)).toBe(true);
    const apiErro = erro as ApiError;
    expect(apiErro.status).toBe(400);
    expect(apiErro.code).toBe('VALIDATION_ERROR');
    expect(apiErro.message).toBe('Dados inválidos');
    expect(apiErro.details).toEqual([{ campo: 'nome', mensagem: 'Obrigatório' }]);
  });

  it('resposta sem envelope usa o código do status', async () => {
    mockFetch([
      {
        method: 'GET',
        path: '/api/v1/x',
        status: 502,
        headers: { 'content-type': 'text/html' },
        body: '<html/>',
      },
    ]);
    const erro = (await api.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(erro.status).toBe(502);
    expect(erro.code).toBe('HTTP_502');
    expect(erro.message).toMatch(/indisponível/);
  });

  it('falha de rede vira ApiError REDE', async () => {
    mockFetch([{ path: '/api/v1/x', falhaRede: true }]);
    const erro = (await api.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(erro.code).toBe('REDE');
    expect(erro.status).toBe(0);
    expect(erro.isRede).toBe(true);
  });
});

describe('refresh em 401', () => {
  it('renova o token uma única vez (single-flight) e repete as requisições', async () => {
    useAuthStore.getState().setAccessToken('velho');
    const fetchMock = mockFetch([
      {
        method: 'GET',
        path: '/api/v1/dados',
        handler: (chamada) =>
          chamada.headers.authorization === 'Bearer novo'
            ? { status: 200, body: { data: 'ok' } }
            : respostaErro(401, 'UNAUTHORIZED', 'Token expirado'),
      },
      { method: 'POST', path: '/api/v1/auth/refresh', body: { accessToken: 'novo' } },
    ]);

    const [a, b] = await Promise.all([
      api.get<{ data: string }>('/dados'),
      api.get<{ data: string }>('/dados'),
    ]);

    expect(a.data).toBe('ok');
    expect(b.data).toBe('ok');
    expect(fetchMock.chamadas('/api/v1/auth/refresh')).toHaveLength(1);
    expect(fetchMock.chamadas('/api/v1/dados')).toHaveLength(4); // 2 falhas + 2 repetições
    expect(useAuthStore.getState().accessToken).toBe('novo');
  });

  it('refresh inválido limpa a sessão e propaga o 401', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'velho',
      user: {
        id: 'u',
        tenantId: 't',
        nome: 'x',
        email: 'x@x',
        role: 'owner',
        admin: false,
        deveTrocarSenha: false,
      },
      tenant: {
        id: 't',
        nome: 'x',
        nomeFantasia: null,
        cnpj: null,
        atividade: 'servicos',
        caminhoneiroTributos: null,
        dataAbertura: null,
        interno: false,
      },
    });
    mockFetch([
      {
        method: 'GET',
        path: '/api/v1/dados',
        ...respostaErro(401, 'UNAUTHORIZED', 'Token expirado'),
      },
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        ...respostaErro(401, 'UNAUTHORIZED', 'Refresh inválido'),
      },
    ]);
    const erro = (await api.get('/dados').catch((e: unknown) => e)) as ApiError;
    expect(erro.status).toBe(401);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().bootstrapped).toBe(true);
  });

  it('não tenta refresh nas rotas públicas de auth', async () => {
    const fetchMock = mockFetch([
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        ...respostaErro(401, 'UNAUTHORIZED', 'E-mail ou senha inválidos'),
      },
      { method: 'POST', path: '/api/v1/auth/refresh', body: { accessToken: 'novo' } },
    ]);
    const erro = (await api.post('/auth/login', {}).catch((e: unknown) => e)) as ApiError;
    expect(erro.message).toBe('E-mail ou senha inválidos');
    expect(fetchMock.chamadas('/api/v1/auth/refresh')).toHaveLength(0);
  });

  it('refreshAccessToken devolve null quando o cookie é inválido', async () => {
    mockFetch([
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        status: 401,
        body: { error: { code: 'UNAUTHORIZED', message: 'x' } },
      },
    ]);
    await expect(refreshAccessToken()).resolves.toBeNull();
  });
});
