// Página inicial provisória do Phase 0: mostra o nome do sistema e o estado da API via /api/v1/health.
// Substituída por P1-C (Web core) pelo shell autenticado; WP5 entrega o dashboard real.
import { useQuery } from '@tanstack/react-query';
import { useRouteError } from 'react-router';

import { env } from '@/app/env';

interface Health {
  status: 'ok';
  db: 'pglite' | 'pg';
  versao: string;
}

async function buscarHealth(): Promise<Health> {
  const res = await fetch(`${env.apiBaseUrl}/health`);
  if (!res.ok) throw new Error(`API respondeu ${res.status}`);
  return (await res.json()) as Health;
}

export function HealthStatus() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: buscarHealth,
    retry: false,
  });

  if (isPending) return <p className="text-zinc-500">Verificando a API…</p>;
  if (isError) {
    return (
      <p role="alert" className="text-red-700">
        API indisponível ({error.message}).{' '}
        <button type="button" className="underline" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  }
  return (
    <p className="text-emerald-700">
      API online — banco: <strong>{data.db}</strong> — versão {data.versao}
    </p>
  );
}

export function HomePlaceholder() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-3xl font-bold tracking-tight text-brand-700">MEI Financeiro</h1>
      <p className="text-zinc-600">
        Ambiente de desenvolvimento pronto. As telas chegam nas próximas fases.
      </p>
      <HealthStatus />
    </main>
  );
}

export function RotaErro() {
  const erro = useRouteError();
  const mensagem = erro instanceof Error ? erro.message : 'Algo deu errado.';
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Ops, algo deu errado</h1>
      <p className="mt-2 text-zinc-600">{mensagem}</p>
      <a className="mt-4 inline-block underline" href="/">
        Voltar ao início
      </a>
    </main>
  );
}
