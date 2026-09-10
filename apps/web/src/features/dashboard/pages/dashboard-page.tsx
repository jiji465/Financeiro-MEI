// Página inicial: cards de resumo, gráfico de 12 meses, limite anual, despesas por categoria,
// próximos vencimentos, alertas e atalhos.
import { Navigate } from 'react-router';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { AlertasList, LimiteCard } from '@/features/das';
import { useMei } from '@/features/referencias';
import { useAuthStore } from '@/features/auth/store';

import { Atalhos } from '../components/atalhos';
import { CategoriaDonut } from '../components/categoria-donut';
import { ComparativoChart } from '../components/comparativo-chart';
import { ProximosVencimentos } from '../components/proximos-vencimentos';
import { ResumoCards } from '../components/resumo-cards';
import { useComparativoMensal, usePorCategoria, useResumoDashboard } from '../hooks';

export function DashboardPage() {
  const interno = useAuthStore((s) => s.tenant?.interno ?? false);
  // Administrador puro (seção 13 do plano) não tem MEI de verdade — não há dashboard para ele,
  // a área dele é o painel de administração.
  if (interno) return <Navigate to="/admin" replace />;

  return <DashboardPageConteudo />;
}

function DashboardPageConteudo() {
  const mei = useMei();
  const resumo = useResumoDashboard();
  const comparativo = useComparativoMensal({ meses: 12 });
  const porCategoria = usePorCategoria({ tipo: 'despesa', limite: 6 });

  const primeiroNome =
    mei.data?.tenant.nomeFantasia?.split(' ')[0] ?? mei.data?.user.nome.split(' ')[0];

  return (
    <>
      <PageHeader
        titulo={primeiroNome ? `Olá, ${primeiroNome}` : 'Visão geral'}
        descricao="Resumo financeiro do seu MEI neste mês."
        acoes={<Atalhos />}
      />

      <div className="space-y-4">
        <AlertasList maxItens={3} compacto />

        <ResumoCards resumo={resumo.data} loading={resumo.isPending} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Receitas x despesas (12 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparativoChart dados={comparativo.data} loading={comparativo.isPending} />
            </CardContent>
          </Card>

          <LimiteCard compacto />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Despesas por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoriaDonut dados={porCategoria.data} loading={porCategoria.isPending} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Próximos vencimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <ProximosVencimentos
                itens={resumo.data?.proximosVencimentos}
                loading={resumo.isPending}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
