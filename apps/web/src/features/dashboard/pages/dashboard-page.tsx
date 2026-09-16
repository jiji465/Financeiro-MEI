// Visão geral (rota "/"): alertas, resumo do período, atalhos, vencimentos, limite anual,
// saldos das contas, comparativo de 12 meses e despesas por categoria.
import { Navigate } from 'react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PeriodoSelect, type PeriodoValue } from '@/components/ui/periodo-select';
import { AlertasList, LimiteCard } from '@/features/das';
import { useMei } from '@/features/referencias';
import { useAuthStore } from '@/features/auth/store';
import { hojeSP, periodoPreset, presetDoPeriodo } from '@/lib/format/date';
import { useSearchParamsObject } from '@/lib/hooks';

import { Atalhos } from '../components/atalhos';
import { CategoriaDonut } from '../components/categoria-donut';
import { ComparativoChart } from '../components/comparativo-chart';
import { ProximosVencimentos } from '../components/proximos-vencimentos';
import { ResumoCards } from '../components/resumo-cards';
import { SaldosContas } from '../components/saldos-contas';
import { useComparativoMensal, usePorCategoria, useResumoDashboard } from '../hooks';

const CHAVES = ['de', 'ate'] as const;

export function DashboardPage() {
  const interno = useAuthStore((s) => s.tenant?.interno ?? false);
  // Administrador puro (seção 13 do plano) não tem MEI de verdade — não há dashboard para ele,
  // a área dele é o painel de administração.
  if (interno) return <Navigate to="/admin" replace />;

  return <DashboardPageConteudo />;
}

function DashboardPageConteudo() {
  const mei = useMei();
  const [params, patch] = useSearchParamsObject(CHAVES);

  // Período na URL, como nas demais telas: recarregar a página ou compartilhar o link mantém o
  // recorte. Padrão: o mês corrente, que era o que a API já assumia quando ninguém mandava nada.
  const hoje = hojeSP();
  const padrao = periodoPreset('este_mes', hoje);
  const periodo: PeriodoValue = {
    de: params.de || padrao.de,
    ate: params.ate || padrao.ate,
    preset:
      params.de || params.ate
        ? presetDoPeriodo({ de: params.de || padrao.de, ate: params.ate || padrao.ate }, hoje)
        : 'este_mes',
  };
  const intervalo = { de: periodo.de, ate: periodo.ate };

  const resumo = useResumoDashboard(intervalo);
  const comparativo = useComparativoMensal({ meses: 12 });
  const porCategoria = usePorCategoria({ tipo: 'despesa', limite: 6, ...intervalo });

  const primeiroNome =
    mei.data?.tenant.nomeFantasia?.split(' ')[0] ?? mei.data?.user.nome.split(' ')[0];

  return (
    <>
      <PageHeader
        titulo={primeiroNome ? `Olá, ${primeiroNome}` : 'Visão geral'}
        descricao="Como está o seu MEI no período escolhido."
        acoes={
          <PeriodoSelect
            value={periodo}
            onChange={(v) => patch({ de: v.de, ate: v.ate })}
            aria-label="Período da visão geral"
          />
        }
      />

      {/* Ordem de leitura, do mais acionável ao mais contextual:
          1. alertas (só aparecem se existirem — "tudo em dia" não merece ocupar o topo);
          2. o resumo do período, com o saldo como número principal;
          3. atalhos das ações do dia a dia;
          4. o que exige ação num prazo: vencimentos e limite anual;
          5. quanto há em caixa hoje, por conta;
          6. histórico e composição — informação de acompanhamento, não de decisão imediata. */}
      <div className="space-y-4 md:space-y-5">
        <AlertasList maxItens={3} compacto ocultarSeVazio />

        <ResumoCards
          resumo={resumo.data}
          loading={resumo.isPending}
          isError={resumo.isError}
          error={resumo.error}
          onRetry={() => void resumo.refetch()}
        />

        <Atalhos />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 md:gap-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Próximos vencimentos</CardTitle>
              <CardDescription>DAS e contas dos próximos 30 dias.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProximosVencimentos
                itens={resumo.data?.proximosVencimentos}
                loading={resumo.isPending}
                isError={resumo.isError}
                error={resumo.error}
                onRetry={() => void resumo.refetch()}
              />
            </CardContent>
          </Card>

          <LimiteCard compacto className="lg:col-span-2" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 md:gap-5">
          <SaldosContas className="lg:col-span-2" />

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Receitas x despesas</CardTitle>
              <CardDescription>Últimos 12 meses.</CardDescription>
            </CardHeader>
            <CardContent>
              <ComparativoChart
                dados={comparativo.data}
                loading={comparativo.isPending}
                isError={comparativo.isError}
                error={comparativo.error}
                onRetry={() => void comparativo.refetch()}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
            <CardDescription>No período selecionado.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoriaDonut
              dados={porCategoria.data}
              loading={porCategoria.isPending}
              isError={porCategoria.isError}
              error={porCategoria.error}
              onRetry={() => void porCategoria.refetch()}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
