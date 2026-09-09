// Card do limite anual de faturamento (reutilizado pelo dashboard do WP5):
//   <LimiteCard ano={2026} compacto />
// Busca /obrigacoes/limite sozinho; explica em linguagem simples o proporcional, a projeção e o excesso.
import { LABEL_NIVEL_LIMITE, type LimiteDto, type NivelLimite } from '@meifin/shared';
import { Gauge } from 'lucide-react';
import { Link } from 'react-router';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Progress, toneDoPercentual } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfiguracoes } from '@/features/configuracoes/hooks';
import { formatData, hojeSP, nomeMes } from '@/lib/format/date';
import { formatBRL, formatPercentual } from '@/lib/format/money';
import { cn } from '@/lib/utils/cn';

import { useLimite } from '../hooks';

export interface LimiteCardProps {
  /** Ano consultado (padrão: ano atual). */
  ano?: number;
  /** Versão resumida para o dashboard (sem tabela mensal nem explicações longas). */
  compacto?: boolean;
  className?: string;
}

const TONE_NIVEL: Record<NivelLimite, BadgeTone> = {
  ok: 'receita',
  atencao: 'alerta',
  alerta: 'despesa',
  estourado: 'despesa',
};

export function explicacaoNivel(limite: LimiteDto): string {
  if (limite.excesso === 'acima_20') {
    return `Você ultrapassou o limite em mais de 20%. Pela regra, o desenquadramento do MEI vale desde 1º de janeiro de ${limite.ano}, com recolhimento dos impostos como microempresa. Procure um contador o quanto antes.`;
  }
  if (limite.excesso === 'ate_20') {
    return `Você passou do limite em até 20%. Continua como MEI até 31/12/${limite.ano}, paga um DAS complementar sobre o excesso em janeiro e passa a microempresa a partir de 1º de janeiro de ${limite.ano + 1}.`;
  }
  if (limite.nivel === 'estourado') {
    return `Você atingiu 100% do limite. Qualquer receita adicional em ${limite.ano} caracteriza excesso e pode levar ao desenquadramento.`;
  }
  if (limite.nivel === 'alerta') {
    return `Faltam só ${formatBRL(limite.restante)} para o limite. Vale planejar as próximas receitas com cuidado.`;
  }
  if (limite.nivel === 'atencao') {
    return `Você já usou ${formatPercentual(limite.percentual)} do limite. Ainda há folga, mas acompanhe mês a mês.`;
  }
  return `Restam ${formatBRL(limite.restante)} de faturamento permitido em ${limite.ano}.`;
}

function ProporcionalNota({ limite }: { limite: LimiteDto }) {
  if (!limite.anoAbertura) return null;
  const mensal = limite.mesesConsiderados > 0 ? limite.limite / limite.mesesConsiderados : 0;
  return (
    <p className="text-xs text-zinc-500">
      Limite proporcional: como o MEI abriu em {nomeMes(limite.mesInicio)} de {limite.ano}, valem{' '}
      {limite.mesesConsiderados} meses × {formatBRL(mensal)} = {formatBRL(limite.limite)}.
    </p>
  );
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-zinc-500">{rotulo}</dt>
      <dd className={cn('text-sm tabular-nums', destaque ? 'font-semibold' : 'font-medium')}>
        {valor}
      </dd>
    </div>
  );
}

export function LimiteCard({ ano, compacto = false, className }: LimiteCardProps) {
  const anoConsulta = ano ?? Number(hojeSP().slice(0, 4));
  const query = useLimite(anoConsulta);
  const config = useConfiguracoes();
  const mostrarProjecao = config.data?.mostrarProjecao ?? true;

  return (
    <Card className={className} data-testid="limite-card">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="size-4 text-primary-700" aria-hidden="true" />
            Limite anual {anoConsulta}
          </CardTitle>
          {!compacto ? (
            <CardDescription>
              Quanto do faturamento permitido ao MEI você já usou neste ano.
            </CardDescription>
          ) : null}
        </div>
        {query.data ? (
          <Badge tone={TONE_NIVEL[query.data.nivel]} dot>
            {LABEL_NIVEL_LIMITE[query.data.nivel]}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div className="space-y-3" aria-label="Carregando limite" role="status">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : query.isError || !query.data ? (
          <ErrorState compacto error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <LimiteConteudo
            limite={query.data}
            compacto={compacto}
            mostrarProjecao={mostrarProjecao}
          />
        )}
      </CardContent>
    </Card>
  );
}

function LimiteConteudo({
  limite,
  compacto,
  mostrarProjecao,
}: {
  limite: LimiteDto;
  compacto: boolean;
  mostrarProjecao: boolean;
}) {
  const [m70 = 70, m85 = 85, m100 = 100] = limite.marcas;
  const markers = [
    { valor: m70, label: `${m70}%` },
    { valor: m85, label: `${m85}%` },
    { valor: m100, label: `${m100}%` },
  ];
  const projecaoTexto =
    limite.projecao === null
      ? 'Ainda é cedo para projetar (menos de 15 dias de dados).'
      : `${formatBRL(limite.projecao)} (${formatPercentual(limite.projecaoPercentual ?? 0)} do limite)`;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {formatPercentual(limite.percentual)}
          </span>
          <span className="text-xs text-zinc-500">do limite de {formatBRL(limite.limite)}</span>
        </div>
        <Progress
          value={limite.percentual}
          tone={toneDoPercentual(limite.percentual)}
          markers={markers}
          size={compacto ? 'md' : 'lg'}
          aria-label={`Faturamento em ${formatPercentual(limite.percentual)} do limite anual`}
        />
      </div>

      <dl className="space-y-1.5">
        <Linha rotulo="Faturado no ano" valor={formatBRL(limite.acumulado)} destaque />
        <Linha rotulo="Limite" valor={formatBRL(limite.limite)} />
        {limite.valorExcedido > 0 ? (
          <Linha rotulo="Excedido" valor={formatBRL(limite.valorExcedido)} destaque />
        ) : (
          <Linha rotulo="Restante" valor={formatBRL(limite.restante)} />
        )}
        {mostrarProjecao ? <Linha rotulo="Projeção para dezembro" valor={projecaoTexto} /> : null}
        {!compacto ? <Linha rotulo="Média mensal" valor={formatBRL(limite.mediaMensal)} /> : null}
      </dl>

      {mostrarProjecao && limite.projecaoExcede && limite.nivel !== 'estourado' ? (
        <p className="rounded-md border border-alerta-200 bg-alerta-50 px-3 py-2 text-xs text-alerta-700">
          No ritmo atual, o faturamento deve passar do limite até o fim do ano.
        </p>
      ) : null}

      <p
        className={cn(
          'text-sm',
          limite.excesso || limite.nivel === 'estourado' ? 'text-despesa-700' : 'text-zinc-600',
        )}
      >
        {explicacaoNivel(limite)}
      </p>

      <ProporcionalNota limite={limite} />

      {!compacto ? (
        <p className="text-xs text-zinc-500">
          Regime {limite.regime === 'caixa' ? 'de caixa' : 'de competência'} · dados até{' '}
          {formatData(hojeSP())} ({limite.diasDecorridos} de {limite.diasTotais} dias).{' '}
          <Link
            to="/configuracoes?aba=preferencias"
            className="text-primary-700 underline-offset-4 hover:underline"
          >
            Alterar regime
          </Link>
        </p>
      ) : null}
    </div>
  );
}
