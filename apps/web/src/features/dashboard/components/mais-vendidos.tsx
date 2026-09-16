// Card "Mais vendidos": ranking do catálogo no período.
//
// Lê os ITENS das vendas, não os lançamentos — então só enxerga o que foi registrado com itens.
// O rodapé diz isso quando há diferença para o faturamento, senão o card parece estar errando
// a conta para quem lança vendas sem detalhar.
import { formatQuantidade } from '@meifin/shared';
import { Package } from 'lucide-react';
import { Link } from 'react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonText } from '@/components/ui/skeleton';
import { formatBRL } from '@/lib/format/money';

import { usePorProduto } from '../hooks';

export interface MaisVendidosProps {
  de: string;
  ate: string;
  /** Faturamento do período, para avisar quanto ficou de fora por não ter itens. */
  receitaDoPeriodo?: number | undefined;
  className?: string;
}

export function MaisVendidos({ de, ate, receitaDoPeriodo, className }: MaisVendidosProps) {
  const query = usePorProduto({ de, ate, limite: 5 });
  const itens = query.data?.itens ?? [];
  const total = query.data?.total ?? 0;
  const foraDoRanking =
    receitaDoPeriodo !== undefined && receitaDoPeriodo > total ? receitaDoPeriodo - total : 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Mais vendidos</CardTitle>
        <CardDescription>Produtos e serviços no período.</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? <SkeletonText linhas={3} /> : null}

        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} compacto />
        ) : null}

        {!query.isPending && !query.isError && itens.length === 0 ? (
          <div className="py-2 text-sm text-zinc-600">
            <p className="flex items-center gap-2 font-medium text-texto">
              <Package className="size-4 text-zinc-400" aria-hidden="true" />
              Nenhuma venda com itens
            </p>
            <p className="mt-1">
              Ao lançar uma receita, use “Adicionar itens” para dizer o que foi vendido — é o que
              alimenta este ranking.{' '}
              <Link to="/produtos-servicos" className="text-primary-700 hover:underline">
                Ver catálogo
              </Link>
            </p>
          </div>
        ) : null}

        {itens.length > 0 ? (
          <>
            <ol className="divide-y divide-linha">
              {itens.map((i, posicao) => (
                <li
                  key={i.produtoServicoId}
                  className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <span
                    className="w-5 shrink-0 text-sm text-zinc-400 tabular-nums"
                    aria-hidden="true"
                  >
                    {posicao + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-texto">{i.nome}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {formatQuantidade(i.quantidade)}
                      {i.unidade ? ` ${i.unidade}` : ''} · {i.vendas}{' '}
                      {i.vendas === 1 ? 'venda' : 'vendas'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-texto tabular-nums">
                    {formatBRL(i.valor)}
                  </span>
                </li>
              ))}
            </ol>

            {foraDoRanking > 0 ? (
              <p className="mt-3 border-t border-borda pt-3 text-xs text-zinc-500">
                {formatBRL(foraDoRanking)} do faturamento do período veio de lançamentos sem itens e
                não entra neste ranking.
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
