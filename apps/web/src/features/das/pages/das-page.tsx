// Página "/das": DAS mensal (12 competências do ano, marcar pago, histórico) e DASN-SIMEI
// (apuração de faturamento, prazo e entrega), com os alertas do MEI relacionados a cada aba.
import { CircleHelp } from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { hojeSP } from '@/lib/format/date';
import { useSearchParamsState } from '@/lib/hooks';

import { AlertasList } from '../components/alertas-list';
import { SeletorAno } from '../components/das-status-badge';
import { DasTabela, ResumoDas } from '../components/das-tabela';
import { DasnPainel } from '../components/dasn-painel';
import { useDasAno } from '../hooks';

const ANO_ATUAL = Number(hojeSP().slice(0, 4));

function DasMensal({ ano }: { ano: number }) {
  const query = useDasAno(ano);
  return (
    <div className="space-y-4">
      <QueryState query={query}>
        {(das) => (
          <>
            {das.parametrosDesatualizados ? (
              <p className="rounded-lg border border-alerta-200 bg-alerta-50/60 px-3 py-2 text-sm text-alerta-700">
                Os parâmetros do MEI de {ano} ainda não foram confirmados; usamos os valores do ano
                mais recente disponível. O DAS pode mudar quando a tabela oficial for publicada.
              </p>
            ) : null}
            <ResumoDas das={das} />
            <DasTabela das={das} />
          </>
        )}
      </QueryState>

      <details className="rounded-lg border border-borda bg-superficie p-4 text-sm text-zinc-600 open:pb-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-texto">
          <CircleHelp className="size-4 text-zinc-400" aria-hidden="true" />O que é o DAS?
        </summary>
        <div className="mt-2 space-y-2">
          <p>
            O DAS (Documento de Arrecadação do Simples Nacional) é a guia mensal que junta o INSS e,
            conforme a atividade do seu MEI, o ICMS (comércio) e/ou o ISS (serviços). Vence todo dia
            20 do mês seguinte à competência — se cair em fim de semana ou feriado, o prazo passa
            para o próximo dia útil.
          </p>
          <p>
            Pagar em atraso gera multa e juros; gere a guia atualizada no PGMEI antes de marcar como
            pago para lançar o valor correto.
          </p>
        </div>
      </details>
    </div>
  );
}

export function DasPage() {
  const [aba, setAba] = useSearchParamsState('aba', 'mensal');
  const [anoTexto, setAnoTexto] = useSearchParamsState('ano', String(ANO_ATUAL));
  const [anoBaseTexto, setAnoBaseTexto] = useSearchParamsState('anoBase', String(ANO_ATUAL - 1));
  const ano = Number(anoTexto) || ANO_ATUAL;
  const anoBase = Number(anoBaseTexto) || ANO_ATUAL - 1;

  return (
    <div>
      <PageHeader
        titulo="DAS e obrigações"
        descricao="Guia mensal do Simples Nacional e a declaração anual do MEI (DASN-SIMEI)."
      />

      <AlertasList tipos={['das', 'dasn']} titulo="Pendências" className="mb-4" compacto />

      <Tabs value={aba || 'mensal'} onValueChange={setAba}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="mensal">DAS mensal</TabsTrigger>
            <TabsTrigger value="dasn">DASN-SIMEI</TabsTrigger>
          </TabsList>
          {(aba || 'mensal') === 'mensal' ? (
            <SeletorAno
              ano={ano}
              onChange={(v) => setAnoTexto(String(v))}
              desde={ANO_ATUAL - 5}
              ate={ANO_ATUAL}
            />
          ) : (
            <SeletorAno
              ano={anoBase}
              onChange={(v) => setAnoBaseTexto(String(v))}
              desde={ANO_ATUAL - 6}
              ate={ANO_ATUAL - 1}
            />
          )}
        </div>

        <TabsContent value="mensal">
          <DasMensal ano={ano} />
        </TabsContent>
        <TabsContent value="dasn">
          <DasnPainel anoBase={anoBase} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
