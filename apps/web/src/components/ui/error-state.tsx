import { CircleAlert, RefreshCw, WifiOff } from 'lucide-react';
import { type ReactNode } from 'react';

import { getErrorMessage, isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';

import { Button } from './button';

export interface ErrorStateProps {
  titulo?: ReactNode;
  descricao?: ReactNode;
  /** Erro capturado; a mensagem é derivada dele quando `descricao` não é informada. */
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  compacto?: boolean;
}

export function ErrorState({
  titulo,
  descricao,
  error,
  onRetry,
  retrying,
  className,
  compacto,
}: ErrorStateProps) {
  const rede = isApiError(error) && error.isRede;
  const tituloFinal = titulo ?? (rede ? 'Sem conexão' : 'Não foi possível carregar');
  const descricaoFinal =
    descricao ?? (error ? getErrorMessage(error) : 'Tente novamente em instantes.');
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-perigo-100 bg-perigo-50/50 px-4 text-center',
        compacto ? 'py-6' : 'py-12',
        className,
      )}
    >
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-perigo-100 text-perigo-700 [&_svg]:size-6">
        {rede ? <WifiOff aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
      </div>
      <h3 className="text-base font-semibold">{tituloFinal}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-600">{descricaoFinal}</p>
      {onRetry ? (
        <Button
          variant="outline"
          className="mt-4"
          onClick={onRetry}
          loading={retrying}
          icon={<RefreshCw aria-hidden="true" />}
        >
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
