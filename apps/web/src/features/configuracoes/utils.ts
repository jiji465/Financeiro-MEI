// Utilitário compartilhado pelos formulários de configurações: a API devolve os erros de validação
// de campos aninhados como "mei.cnpj" / "preferencias.tema"; os formulários usam nomes de campo
// simples ("cnpj", "tema"), então removemos o prefixo antes de aplicar ao react-hook-form.
import type { FieldValues, UseFormSetError } from 'react-hook-form';

import { ApiError, aplicarErrosDoServidor, isApiError } from '@/lib/api/errors';

export function aplicarErrosAninhados<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  prefixo: string,
): boolean {
  if (isApiError(err) && err.details?.length) {
    const semPrefixo = new ApiError({
      status: err.status,
      code: err.code,
      message: err.message,
      details: err.details.map((d) => ({
        ...d,
        campo: d.campo.startsWith(`${prefixo}.`) ? d.campo.slice(prefixo.length + 1) : d.campo,
      })),
    });
    return aplicarErrosDoServidor(semPrefixo, setError);
  }
  return aplicarErrosDoServidor(err, setError);
}
