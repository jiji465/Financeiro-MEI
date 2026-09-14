// Mockups ilustrativos do produto pra página de vendas — não são screenshots (não existe nenhum
// asset de imagem no projeto), são miniaturas construídas com o próprio design system, com dados
// de exemplo. Mesma técnica usada por produtos como Linear/Stripe em vez de captura de tela real:
// fica nítido em qualquer resolução e sempre consistente com a marca.
import { ArrowUpRight, Check, Download, Gauge, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { NumeroAnimado } from '@/components/ui/numero-animado';
import { formatBRL } from '@/lib/format/money';

const BARRAS_EXEMPLO = [38, 52, 45, 70, 58, 82, 64, 90];
const LIMITE_PCT_EXEMPLO = 42;

// Nome em inglês ("use...") por exigência do eslint-plugin-react-hooks — é o único jeito dele
// reconhecer isto como hook e aplicar as regras de hooks corretamente.
function useEntradaAnimada() {
  const [entrou, setEntrou] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntrou(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return entrou;
}

/** Conteúdo do mockup do painel, sem moldura própria — usado tanto no card flutuante
 * (`PainelPreview`) quanto encaixado na "tela" do computador do hero (`HeroZoom`). */
export function PainelPreviewConteudo({ className }: { className?: string }) {
  const entrou = useEntradaAnimada();
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-texto-suave">Olá, Ateliê Criativo 👋</p>
          <p className="font-display text-sm font-semibold text-texto">Setembro de 2026</p>
        </div>
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <Gauge className="size-4" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-receita-50 p-2.5">
          <p className="text-[11px] text-receita-700">Saldo do mês</p>
          <p className="flex items-center gap-1 text-base font-bold tabular-nums text-receita-700">
            <NumeroAnimado valor={402595} formatar={(v) => formatBRL(v)} />
            <TrendingUp className="size-3.5" aria-hidden="true" />
          </p>
        </div>
        <div className="rounded-lg bg-alerta-50 p-2.5">
          <p className="text-[11px] text-alerta-700">A pagar essa semana</p>
          <p className="text-base font-bold tabular-nums text-alerta-700">
            <NumeroAnimado valor={152200} formatar={(v) => formatBRL(v)} />
          </p>
        </div>
      </div>

      <div className="mt-4 flex h-16 items-end gap-1.5">
        {BARRAS_EXEMPLO.map((altura, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-linear-to-t from-primary-600 to-acento-500 transition-[height] duration-700 ease-out"
            style={{
              height: entrou ? `${altura}%` : '0%',
              transitionDelay: `${i * 40}ms`,
              opacity: 0.55 + (i / BARRAS_EXEMPLO.length) * 0.45,
            }}
          />
        ))}
      </div>

      <div className="mt-4 border-t border-borda pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-texto-suave">Limite anual de faturamento</span>
          <span className="font-semibold text-texto">
            <NumeroAnimado valor={LIMITE_PCT_EXEMPLO} formatar={(v) => `${Math.round(v)}%`} />
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-primary-600 transition-[width] duration-700 ease-out"
            style={{ width: entrou ? `${LIMITE_PCT_EXEMPLO}%` : '0%' }}
          />
        </div>
      </div>
    </div>
  );
}

/** Card flutuante com o mockup do painel — usado na vitrine de recursos. */
export function PainelPreview() {
  return (
    <PainelPreviewConteudo className="w-full max-w-sm rounded-2xl border border-borda bg-superficie p-4 shadow-xl sm:p-5" />
  );
}

const DAS_EXEMPLO = [
  { mes: 'Jun', status: 'Pago' as const },
  { mes: 'Jul', status: 'Pago' as const },
  { mes: 'Ago', status: 'Pago' as const },
  { mes: 'Set', status: 'Vence em 5 dias' as const },
  { mes: 'Out', status: 'Em aberto' as const },
];

const TOM_DAS: Record<(typeof DAS_EXEMPLO)[number]['status'], 'receita' | 'alerta' | 'neutral'> = {
  Pago: 'receita',
  'Vence em 5 dias': 'alerta',
  'Em aberto': 'neutral',
};

/** Miniatura do calendário de DAS. */
export function DasPreview() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-borda bg-superficie p-4 shadow-xl sm:p-5">
      <p className="font-display text-sm font-semibold text-texto">DAS · 2026</p>
      <div className="mt-3 space-y-2">
        {DAS_EXEMPLO.map(({ mes, status }) => (
          <div
            key={mes}
            className="flex items-center justify-between rounded-lg border border-borda px-3 py-2"
          >
            <span className="text-sm font-medium text-texto">{mes}</span>
            <Badge tone={TOM_DAS[status]} dot>
              {status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

const CONTAS_EXEMPLO = [
  {
    nome: 'Fornecedora ABC Ltda',
    valor: 'R$ 350,00',
    vencimento: '20/09',
    status: 'Pendente' as const,
  },
  { nome: 'Aluguel do ponto', valor: 'R$ 1.200,00', vencimento: '05/09', status: 'Pago' as const },
  {
    nome: 'Distribuidora Vale Verde',
    valor: 'R$ 890,00',
    vencimento: '28/09',
    status: 'Pendente' as const,
  },
];

/** Miniatura de contas a pagar/receber. */
export function ContasPreview() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-borda bg-superficie p-4 shadow-xl sm:p-5">
      <p className="font-display text-sm font-semibold text-texto">Contas a pagar</p>
      <div className="mt-3 space-y-2">
        {CONTAS_EXEMPLO.map((c) => (
          <div key={c.nome} className="flex items-center justify-between gap-2 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-texto">{c.nome}</p>
              <p className="text-xs text-texto-suave">Vence {c.vencimento}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-texto">{c.valor}</p>
              <Badge tone={c.status === 'Pago' ? 'receita' : 'alerta'} className="mt-0.5">
                {c.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Miniatura de relatório (DRE) com exportação. */
export function RelatorioPreview() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-borda bg-superficie p-4 shadow-xl sm:p-5">
      <p className="font-display text-sm font-semibold text-texto">DRE simplificada</p>
      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-texto-suave">Receitas</span>
          <span className="tabular-nums text-texto">R$ 9.100,00</span>
        </div>
        <div className="flex justify-between">
          <span className="text-texto-suave">Despesas</span>
          <span className="tabular-nums text-texto">R$ 5.074,05</span>
        </div>
        <div className="flex justify-between border-t border-borda pt-1.5 font-semibold">
          <span className="text-texto">Resultado</span>
          <span className="flex items-center gap-1 tabular-nums text-receita-700">
            R$ 4.025,95
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {['PDF', 'CSV', 'XLSX'].map((formato) => (
          <span
            key={formato}
            className="flex items-center gap-1 rounded-md border border-borda px-2 py-1 text-[11px] font-medium text-texto-suave"
          >
            <Download className="size-3" aria-hidden="true" />
            {formato}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Selo "conferido" usado na faixa de confiança. */
export function SeloCheck() {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-receita-100 text-receita-700">
      <Check className="size-2.5" aria-hidden="true" />
    </span>
  );
}
