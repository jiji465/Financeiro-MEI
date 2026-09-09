// Página inicial provisória (WP5 substitui pela feature dashboard registrando a rota index).
// Mostra boas-vindas e o estado da API via GET /api/v1/health.
import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';

import { useAuthStore } from '@/features/auth/store';
import { api } from '@/lib/api/client';
import { getErrorMessage } from '@/lib/api/errors';
import { primeiroNome } from '@/lib/format/texto';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export interface Health {
  status: 'ok';
  db: 'pglite' | 'pg';
  versao: string;
}

export function HealthCard() {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<Health>('/health'),
    retry: false,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Estado da API</CardTitle>
          <CardDescription>Conexão com o servidor e o banco de dados</CardDescription>
        </div>
        <Activity className="size-5 text-primary-600" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-5 w-48" />
        ) : isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-perigo-700">
            <span>API indisponível: {getErrorMessage(error)}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()} loading={isFetching}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="receita" dot>
              API online
            </Badge>
            <span className="text-zinc-600">
              banco <strong>{data.db}</strong> · versão {data.versao}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function InicioPlaceholder() {
  const user = useAuthStore((s) => s.user);
  const nome = primeiroNome(user?.nome);
  return (
    <>
      <PageHeader
        titulo={nome ? `Bem-vindo(a), ${nome}` : 'Bem-vindo(a)'}
        descricao="O painel completo chega em breve. Enquanto isso, o menu ao lado já leva às demais áreas."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <HealthCard />
      </div>
    </>
  );
}
