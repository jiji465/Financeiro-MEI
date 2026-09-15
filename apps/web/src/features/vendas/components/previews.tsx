// Mockups ilustrativos do produto pra página de vendas — não são screenshots (não existe nenhum
// asset de imagem no projeto), são miniaturas construídas com o próprio design system, com dados
// de exemplo. Mesma técnica usada por produtos como Linear/Stripe em vez de captura de tela real:
// fica nítido em qualquer resolução e sempre consistente com a marca.
import { ArrowUpRight, Check, Download } from 'lucide-react';
import { type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

const LIMITE_PCT_EXEMPLO = 42;

/** Moldura comum dos mockups da vitrine (card flutuante com título). */
function MolduraMockup({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-borda bg-superficie p-4 shadow-xl sm:p-5">
      <p className="font-display text-sm font-semibold text-texto">{titulo}</p>
      {children}
    </div>
  );
}

const DAS_EXEMPLO = [
  { mes: 'Junho', status: 'Pago' as const },
  { mes: 'Julho', status: 'Pago' as const },
  { mes: 'Agosto', status: 'Pago' as const },
  { mes: 'Setembro', status: 'Vence em 5 dias' as const },
  { mes: 'Outubro', status: 'Em aberto' as const },
];

const TOM_DAS: Record<(typeof DAS_EXEMPLO)[number]['status'], 'receita' | 'alerta' | 'neutral'> = {
  Pago: 'receita',
  'Vence em 5 dias': 'alerta',
  'Em aberto': 'neutral',
};

// 42% de R$ 81.000,00 = R$ 34.020,00 faturado, R$ 46.980,00 de folga. Números coerentes entre si
// de propósito: são ilustrativos, mas ninguém deve conseguir "pegar" a conta errada.
const LIMITE_FATURADO = 'R$ 34.020,00';
const LIMITE_TETO = 'R$ 81.000,00';
const LIMITE_RESTANTE = 'R$ 46.980,00';

/** Miniatura do calendário de DAS + acompanhamento do limite anual. */
export function DasPreview() {
  return (
    <MolduraMockup titulo="DAS · 2026">
      <div className="mt-3 space-y-1.5">
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

      <div className="mt-4 border-t border-borda pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-zinc-500 rotulo">Faturado em 2026</span>
          <span className="text-xs font-semibold text-zinc-600 valor">{LIMITE_PCT_EXEMPLO}%</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-texto valor">
          {LIMITE_FATURADO}{' '}
          <span className="text-xs font-normal text-texto-suave">de {LIMITE_TETO}</span>
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-receita-600"
            style={{ width: `${LIMITE_PCT_EXEMPLO}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-texto-suave">
          Ainda pode faturar <span className="font-medium text-texto valor">{LIMITE_RESTANTE}</span>
        </p>
      </div>
    </MolduraMockup>
  );
}

// Mesma leitura da tela real de contas: agrupado por vencimento, com o total do grupo à direita —
// "Vencidas" é o único grupo que ganha cor, porque é o único que representa um problema.
const GRUPOS_CONTAS = [
  {
    grupo: 'Vencidas',
    total: 'R$ 350,00',
    urgente: true,
    itens: [{ nome: 'Fornecedora ABC Ltda', vencimento: '12/09', valor: 'R$ 350,00' }],
  },
  {
    grupo: 'Próximos 7 dias',
    total: 'R$ 2.090,00',
    urgente: false,
    itens: [
      { nome: 'Aluguel do ponto', vencimento: '20/09', valor: 'R$ 1.200,00' },
      { nome: 'Distribuidora Vale Verde', vencimento: '22/09', valor: 'R$ 890,00' },
    ],
  },
] as const;

/** Miniatura de contas a pagar/receber. */
export function ContasPreview() {
  return (
    <MolduraMockup titulo="Contas a pagar">
      <div className="mt-3 space-y-3">
        {GRUPOS_CONTAS.map(({ grupo, total, urgente, itens }) => (
          <div key={grupo}>
            <div className="mb-1 flex items-baseline justify-between gap-3 px-1">
              <span
                className={cn(
                  'flex items-baseline gap-1.5 text-xs font-semibold',
                  urgente ? 'text-despesa-700' : 'text-zinc-700',
                )}
              >
                {grupo}
                <span className="font-normal text-zinc-400 valor">{itens.length}</span>
              </span>
              <span className="text-xs font-semibold text-texto valor">{total}</span>
            </div>
            <ul className="divide-y divide-linha overflow-hidden rounded-lg border border-borda">
              {itens.map((item) => (
                <li key={item.nome} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-texto">{item.nome}</p>
                    <p className="text-xs text-texto-suave">Vence {item.vencimento}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-texto valor">
                    {item.valor}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </MolduraMockup>
  );
}

/** Miniatura de relatório (DRE) com exportação. */
export function RelatorioPreview() {
  return (
    <MolduraMockup titulo="DRE simplificada · setembro">
      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-texto-suave">Receitas</span>
          <span className="text-texto valor">R$ 9.100,00</span>
        </div>
        <div className="flex justify-between">
          <span className="text-texto-suave">Despesas</span>
          <span className="text-texto valor">R$ 5.074,05</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-borda pt-2">
          <span className="text-sm font-semibold text-texto">Resultado do período</span>
          <span className="flex items-center gap-1 text-lg font-semibold text-receita-700 valor">
            R$ 4.025,95
            <ArrowUpRight className="size-4" aria-hidden="true" />
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
    </MolduraMockup>
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
