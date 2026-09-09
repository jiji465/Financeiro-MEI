// Erros de aplicação. O error-handler converte em { error: { code, message, details? } }.
import { ERROR_STATUS, type ErrorCode, type ErrorDetail } from '@meifin/shared';

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
    status: number = ERROR_STATUS[code],
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && this.details.length > 0 ? { details: this.details } : {}),
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos', details?: ErrorDetail[]) {
    super('VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') {
    super('UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super('FORBIDDEN', message);
  }
}

/** Também usado para acesso cross-tenant: nunca revelar que o recurso existe em outro tenant. */
export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super('NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito com um registro existente', details?: ErrorDetail[]) {
    super('CONFLICT', message, details);
  }
}

export class UnprocessableError extends AppError {
  constructor(message = 'Não foi possível processar a solicitação', details?: ErrorDetail[]) {
    super('UNPROCESSABLE', message, details);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.') {
    super('RATE_LIMITED', message);
  }
}
