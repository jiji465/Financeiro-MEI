import { describe, expect, it, vi } from 'vitest';

import { ApiError, aplicarErrosDoServidor, getErrorMessage, MENSAGEM_REDE } from './errors';

describe('getErrorMessage', () => {
  it('prioriza a mensagem da API e traduz falha de rede', () => {
    expect(
      getErrorMessage(new ApiError({ status: 409, code: 'CONFLICT', message: 'Já existe' })),
    ).toBe('Já existe');
    expect(getErrorMessage(new ApiError({ status: 0, code: 'REDE', message: 'x' }))).toBe(
      MENSAGEM_REDE,
    );
    expect(
      getErrorMessage(new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: '' })),
    ).toMatch(/Erro interno/);
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage(undefined)).toBe('Algo deu errado. Tente novamente.');
  });
});

describe('aplicarErrosDoServidor', () => {
  it('mapeia details[].campo para erros de campo (removendo prefixo body.)', () => {
    const setError = vi.fn();
    const erro = new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      details: [
        { campo: 'body.email', mensagem: 'E-mail já cadastrado' },
        { campo: 'cnpj', mensagem: 'CNPJ inválido' },
      ],
    });
    expect(aplicarErrosDoServidor(erro, setError)).toBe(true);
    expect(setError).toHaveBeenCalledWith(
      'email',
      { type: 'server', message: 'E-mail já cadastrado' },
      { shouldFocus: true },
    );
    expect(setError).toHaveBeenCalledWith(
      'cnpj',
      { type: 'server', message: 'CNPJ inválido' },
      { shouldFocus: false },
    );
  });

  it('sem details vai para root.serverError', () => {
    const setError = vi.fn();
    const erro = new ApiError({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'E-mail ou senha inválidos',
    });
    expect(aplicarErrosDoServidor(erro, setError)).toBe(false);
    expect(setError).toHaveBeenCalledWith('root.serverError', {
      type: 'server',
      message: 'E-mail ou senha inválidos',
    });
  });

  it('ignora campos fora da lista permitida', () => {
    const setError = vi.fn();
    const erro = new ApiError({
      status: 422,
      code: 'UNPROCESSABLE',
      message: 'Falhou',
      details: [{ campo: 'outro', mensagem: 'x' }],
    });
    expect(aplicarErrosDoServidor(erro, setError, { campos: ['nome'] })).toBe(false);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('root.serverError', {
      type: 'server',
      message: 'Falhou',
    });
  });

  it('erros que não são da API viram mensagem genérica', () => {
    const setError = vi.fn();
    aplicarErrosDoServidor(new Error('quebrou'), setError);
    expect(setError).toHaveBeenCalledWith('root.serverError', {
      type: 'server',
      message: 'quebrou',
    });
  });
});
