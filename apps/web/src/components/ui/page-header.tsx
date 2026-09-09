import { ArrowLeft } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { Link } from 'react-router';

import { cn } from '@/lib/utils/cn';

import { Button } from './button';

export interface PageHeaderProps {
  titulo: string;
  descricao?: ReactNode;
  /** Botões à direita (no mobile ficam abaixo do título). */
  acoes?: ReactNode;
  /** Rota do botão "Voltar". */
  voltar?: string;
  /** Conteúdo extra abaixo (abas, filtros). */
  children?: ReactNode;
  className?: string;
  /** Atualiza document.title ("Título · MEI Financeiro"). Padrão: true. */
  documentTitle?: boolean;
}

export function PageHeader({
  titulo,
  descricao,
  acoes,
  voltar,
  children,
  className,
  documentTitle = true,
}: PageHeaderProps) {
  useEffect(() => {
    if (!documentTitle) return;
    const anterior = document.title;
    document.title = `${titulo} · MEI Financeiro`;
    return () => {
      document.title = anterior;
    };
  }, [titulo, documentTitle]);

  return (
    <header className={cn('mb-4 flex flex-col gap-3 md:mb-6', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          {voltar ? (
            <Button variant="ghost" size="icon-sm" asChild className="-ml-2 shrink-0">
              <Link to={voltar} aria-label="Voltar">
                <ArrowLeft aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">{titulo}</h1>
            {descricao ? <p className="mt-0.5 text-sm text-zinc-500">{descricao}</p> : null}
          </div>
        </div>
        {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div> : null}
      </div>
      {children}
    </header>
  );
}
