// Converte qualquer erro no envelope { error: { code, message, details? } } (seção 4 do plano).
// AppError → status próprio; zod (validação de rota) → VALIDATION_ERROR 400; erros do Postgres
// (unique/FK/check) → 409/422; demais → códigos por status. Nunca expõe stack ou SQL ao cliente.
import { ERROR_STATUS, type ErrorCode, type ErrorDetail } from '@meifin/shared';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';

import { AppError } from '../lib/errors.js';

const CODIGO_POR_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'VALIDATION_ERROR',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
};

const MENSAGEM_POR_CODIGO: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Dados inválidos',
  UNAUTHORIZED: 'Não autenticado',
  FORBIDDEN: 'Acesso negado',
  NOT_FOUND: 'Recurso não encontrado',
  CONFLICT: 'Conflito com um registro existente',
  UNPROCESSABLE: 'Não foi possível processar a solicitação',
  RATE_LIMITED: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  PAYLOAD_TOO_LARGE: 'Arquivo ou corpo da requisição grande demais',
  INTERNAL_ERROR: 'Erro interno do servidor',
};

/** Erros do Postgres (pg e PGlite expõem `code` SQLSTATE; o Drizzle 0.45 embrulha em `cause`). */
const ERRO_PG: Record<string, { code: ErrorCode; message: string }> = {
  '23505': { code: 'CONFLICT', message: 'Já existe um registro com esses dados' },
  '23503': { code: 'UNPROCESSABLE', message: 'Registro relacionado não encontrado' },
  '23514': { code: 'UNPROCESSABLE', message: 'Valor não permitido pelas regras do banco' },
  '23502': { code: 'UNPROCESSABLE', message: 'Campo obrigatório ausente' },
  '22P02': { code: 'VALIDATION_ERROR', message: 'Formato de valor inválido' },
  '22001': { code: 'VALIDATION_ERROR', message: 'Valor longo demais' },
  '22003': { code: 'VALIDATION_ERROR', message: 'Valor numérico fora do intervalo permitido' },
};

export function codigoPg(erro: unknown, profundidade = 0): string | undefined {
  if (!erro || typeof erro !== 'object' || profundidade > 5) return undefined;
  const e = erro as { code?: unknown; cause?: unknown };
  if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code) && e.code in ERRO_PG) {
    return e.code;
  }
  return codigoPg(e.cause, profundidade + 1);
}

function enviar(
  reply: FastifyReply,
  code: ErrorCode,
  message: string,
  details?: ErrorDetail[],
  status: number = ERROR_STATUS[code],
) {
  return reply.status(status).send({
    error: { code, message, ...(details && details.length > 0 ? { details } : {}) },
  });
}

/**
 * fastify-type-provider-zod converte cada ZodIssue em { instancePath: '/a/b', message, params }.
 * Devolvemos [{ campo: 'a.b', mensagem }] (mensagens já em pt-BR pelo locale do @meifin/shared).
 */
function detalhesDaValidacao(error: FastifyError): ErrorDetail[] {
  const validation = (error.validation ?? []) as Array<{ instancePath?: string; message?: string }>;
  return validation.map((v) => {
    const caminho = (v.instancePath ?? '').replace(/^\//, '').replace(/\//g, '.');
    return {
      campo: caminho || (error.validationContext ?? 'body'),
      mensagem: v.message ?? 'Valor inválido',
    };
  });
}

export const errorHandlerPlugin = fp(
  async (app) => {
    app.setErrorHandler((error: FastifyError | AppError, request: FastifyRequest, reply) => {
      if (error instanceof AppError) {
        return enviar(reply, error.code, error.message, error.details, error.status);
      }

      if (hasZodFastifySchemaValidationErrors(error)) {
        return enviar(reply, 'VALIDATION_ERROR', 'Dados inválidos', detalhesDaValidacao(error));
      }

      if (isResponseSerializationError(error)) {
        request.log.error({ err: error }, 'Resposta não corresponde ao schema');
        return enviar(reply, 'INTERNAL_ERROR', MENSAGEM_POR_CODIGO.INTERNAL_ERROR);
      }

      const sqlstate = codigoPg(error);
      if (sqlstate) {
        const mapeado = ERRO_PG[sqlstate]!;
        request.log.warn({ err: error, sqlstate }, 'Erro de integridade do banco');
        return enviar(reply, mapeado.code, mapeado.message);
      }

      const status = error.statusCode ?? 500;
      if (status >= 400 && status < 500) {
        const code = CODIGO_POR_STATUS[status] ?? 'VALIDATION_ERROR';
        const mensagem =
          code === 'UNAUTHORIZED' || code === 'RATE_LIMITED' || code === 'PAYLOAD_TOO_LARGE'
            ? MENSAGEM_POR_CODIGO[code]
            : error.message || MENSAGEM_POR_CODIGO[code];
        return enviar(reply, code, mensagem, undefined, status);
      }

      request.log.error({ err: error }, 'Erro não tratado');
      return enviar(reply, 'INTERNAL_ERROR', MENSAGEM_POR_CODIGO.INTERNAL_ERROR);
    });

    app.setNotFoundHandler((request, reply) => {
      return enviar(reply, 'NOT_FOUND', `Rota não encontrada: ${request.method} ${request.url}`);
    });
  },
  { name: 'meifin-error-handler' },
);
