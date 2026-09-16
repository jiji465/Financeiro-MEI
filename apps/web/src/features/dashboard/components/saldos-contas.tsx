// Card "Onde está o dinheiro": saldo de cada conta bancária, na tela inicial.
//
// Os cards de resumo respondem "quanto entrou e saiu no período"; este responde "quanto eu tenho
// agora, e em qual conta" — que é a pergunta que o dono faz antes de pagar alguma coisa. Por isso
// ele NÃO segue o filtro de período: saldo é uma foto de hoje, não um intervalo.
import { Banknote } from 'lucide-react';
import { Link } from 'react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonText } from '@/components/ui/skeleton';
import { useContasBancarias } from '@/features/contas-bancarias/hooks';
import { formatBRL } from '@/lib/format/money';
import { TIPO_CONTA_BANCARIA_LABELS } from '@/lib/labels';

/** Quantas contas cabem sem o card virar uma lista longa; o resto vira "e mais N". */
const LIMITE = 5;

export function SaldosContas({ className }: { className?: string }) {
  const query = useContasBancarias({ ativo: true });
  const contas = query.data?.data ?? [];
  const visiveis = contas.slice(0, LIMITE);
  const ocultas = contas.length - visiveis.length;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Onde está o dinheiro</CardTitle>
        <CardDescription>Saldo de cada conta hoje.</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? <SkeletonText linhas={3} /> : null}

        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} compacto />
        ) : null}

        {!query.isPending && !query.isError && contas.length === 0 ? (
          <div className="py-2 text-sm text-zinc-600">
            <p className="flex items-center gap-2 font-medium text-texto">
              <Banknote className="size-4 text-zinc-400" aria-hidden="true" />
              Nenhuma conta cadastrada
            </p>
            <p className="mt-1">
              Cadastre suas contas para saber quanto tem em cada uma.{' '}
              <Link to="/contas-bancarias" className="text-primary-700 hover:underline">
                Cadastrar
              </Link>
            </p>
          </div>
        ) : null}

        {contas.length > 0 ? (
          <>
            <ul className="divide-y divide-linha">
              {visiveis.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-texto">{c.nome}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {c.instituicao ?? TIPO_CONTA_BANCARIA_LABELS[c.tipo]}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm tabular-nums ${
                      c.saldo < 0 ? 'font-semibold text-despesa-700' : 'font-medium text-texto'
                    }`}
                  >
                    {formatBRL(c.saldo)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-borda pt-3">
              <span className="text-sm font-medium text-zinc-600">
                Total
                {ocultas > 0 ? (
                  <span className="font-normal text-zinc-500"> (com mais {ocultas})</span>
                ) : null}
              </span>
              <span
                className={`text-sm tabular-nums ${
                  (query.data?.totais.saldo ?? 0) < 0
                    ? 'font-semibold text-despesa-700'
                    : 'font-semibold text-texto'
                }`}
              >
                {formatBRL(query.data?.totais.saldo ?? 0)}
              </span>
            </div>

            <Link
              to="/contas-bancarias"
              className="mt-3 inline-block text-sm text-primary-700 hover:underline"
            >
              Ver contas
            </Link>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
