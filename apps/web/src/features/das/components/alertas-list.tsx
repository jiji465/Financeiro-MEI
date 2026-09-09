// Lista de alertas do MEI (DAS, limite, DASN, contas, cadastro) com dispensa por 30 dias.
// Reutilizada pelo dashboard (WP5): <AlertasList maxItens={5} compacto />
import type { AlertaDto, SeveridadeAlerta } from '@meifin/shared';
import { BellOff, CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

import { useAlertas, useDispensarAlerta } from '../hooks';

export interface AlertasListProps {
  /** Limita a quantidade exibida (o restante fica acessível em /das). */
  maxItens?: number;
  /** Menos espaçamento e sem mensagem longa (dashboard). */
  compacto?: boolean;
  /** Filtra por tipo de referência (ex.: ['das', 'dasn']). */
  tipos?: readonly string[];
  /** Título opcional acima da lista. */
  titulo?: string;
  className?: string;
}

const ESTILO: Record<
  SeveridadeAlerta,
  { borda: string; icone: typeof Info; iconeClasse: string; rotulo: string }
> = {
  critico: {
    borda: 'border-perigo-200 bg-perigo-50/60',
    icone: CircleAlert,
    iconeClasse: 'text-perigo-600',
    rotulo: 'Crítico',
  },
  aviso: {
    borda: 'border-alerta-200 bg-alerta-50/60',
    icone: TriangleAlert,
    iconeClasse: 'text-alerta-600',
    rotulo: 'Aviso',
  },
  info: {
    borda: 'border-info-100 bg-info-50/60',
    icone: Info,
    iconeClasse: 'text-info-700',
    rotulo: 'Informação',
  },
};

export function AlertaItem({
  alerta,
  compacto,
  onDispensar,
  dispensando,
}: {
  alerta: AlertaDto;
  compacto?: boolean;
  onDispensar?: (chave: string) => void;
  dispensando?: boolean;
}) {
  const estilo = ESTILO[alerta.severidade];
  const Icone = estilo.icone;
  return (
    <li
      className={cn('flex items-start gap-3 rounded-lg border p-3', estilo.borda)}
      data-severidade={alerta.severidade}
    >
      <Icone className={cn('mt-0.5 size-5 shrink-0', estilo.iconeClasse)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          <span className="sr-only">{estilo.rotulo}: </span>
          {alerta.titulo}
        </p>
        {!compacto ? <p className="mt-0.5 text-sm text-zinc-600">{alerta.mensagem}</p> : null}
        {alerta.acao ? (
          <Link
            to={alerta.acao.url}
            className="mt-1 inline-block text-sm font-medium text-primary-700 underline-offset-4 hover:underline"
          >
            {alerta.acao.rotulo}
          </Link>
        ) : null}
      </div>
      {alerta.dispensavel && onDispensar ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mt-1 -mr-1 shrink-0 text-zinc-500"
          aria-label={`Ocultar alerta: ${alerta.titulo}`}
          title="Ocultar por 30 dias"
          disabled={dispensando}
          onClick={() => onDispensar(alerta.chave)}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
}

export function AlertasList({ maxItens, compacto, tipos, titulo, className }: AlertasListProps) {
  const query = useAlertas();
  const dispensar = useDispensarAlerta();

  if (query.isPending) {
    return (
      <div className={cn('space-y-2', className)} role="status" aria-label="Carregando alertas">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        compacto
        className={className}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const filtrados = tipos
    ? query.data.filter((a) => tipos.includes(a.referencia.tipo))
    : query.data;
  const visiveis = maxItens ? filtrados.slice(0, maxItens) : filtrados;
  const ocultos = filtrados.length - visiveis.length;

  return (
    <section className={className} aria-label={titulo ?? 'Alertas'}>
      {titulo ? (
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
          {titulo}
          {filtrados.length > 0 ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {filtrados.length}
            </span>
          ) : null}
        </h2>
      ) : null}
      {visiveis.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed border-borda px-3 py-3 text-sm text-zinc-500">
          {compacto ? (
            <BellOff className="size-4" aria-hidden="true" />
          ) : (
            <CircleCheck className="size-4 text-receita-600" aria-hidden="true" />
          )}
          Nenhum alerta no momento. Tudo em dia!
        </p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((alerta) => (
            <AlertaItem
              key={alerta.chave}
              alerta={alerta}
              compacto={compacto}
              dispensando={dispensar.isPending && dispensar.variables === alerta.chave}
              onDispensar={(chave) => dispensar.mutate(chave)}
            />
          ))}
        </ul>
      )}
      {ocultos > 0 ? (
        <p className="mt-2 text-xs text-zinc-500">
          <Link to="/das" className="text-primary-700 underline-offset-4 hover:underline">
            Ver mais {ocultos} {ocultos === 1 ? 'alerta' : 'alertas'}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
