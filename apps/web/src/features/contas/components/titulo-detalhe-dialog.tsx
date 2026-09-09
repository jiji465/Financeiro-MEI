// Detalhe de uma conta: todas as parcelas com status, baixa por parcela, estorno (com confirmação)
// e cancelamento da conta (só sem parcelas pagas).
import type { ParcelaDto, TituloDto } from '@meifin/shared';
import { Ban, RotateCcw } from 'lucide-react';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { QueryState } from '@/components/ui/query-state';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { SkeletonText } from '@/components/ui/skeleton';
import { formatData } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';
import { FORMA_PAGAMENTO_LABELS, STATUS_PARCELA_LABELS, STATUS_TITULO_LABELS } from '@/lib/labels';

import { useCancelarTitulo, useEstornarParcela, useTitulo } from '../hooks';
import { TEXTOS_POR_TIPO } from '../utils';

const TONE_PARCELA: Record<ParcelaDto['status'], BadgeTone> = {
  aberta: 'alerta',
  paga: 'receita',
  cancelada: 'neutral',
};

const TONE_TITULO: Record<TituloDto['status'], BadgeTone> = {
  aberto: 'primary',
  quitado: 'receita',
  cancelado: 'neutral',
};

export function StatusParcelaBadge({
  parcela,
}: {
  parcela: Pick<ParcelaDto, 'status' | 'atrasada'>;
}) {
  if (parcela.status === 'aberta' && parcela.atrasada) {
    return (
      <Badge tone="despesa" dot>
        Vencida
      </Badge>
    );
  }
  return (
    <Badge tone={TONE_PARCELA[parcela.status]} dot>
      {STATUS_PARCELA_LABELS[parcela.status]}
    </Badge>
  );
}

export interface TituloDetalheDialogProps {
  tituloId: string | null;
  onClose: () => void;
  onBaixar: (parcelaId: string) => void;
}

export function TituloDetalheDialog({ tituloId, onClose, onBaixar }: TituloDetalheDialogProps) {
  const titulo = useTitulo(tituloId);
  return (
    <ResponsiveDialog
      open={Boolean(tituloId)}
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
      titulo={titulo.data?.descricao ?? 'Detalhes da conta'}
      descricao={
        titulo.data
          ? `${TEXTOS_POR_TIPO[titulo.data.tipo].titulo} · emitida em ${formatData(titulo.data.dataEmissao)}`
          : undefined
      }
      tamanho="lg"
    >
      <QueryState query={titulo} skeleton={<SkeletonText linhas={6} />}>
        {(dados) => <Detalhe titulo={dados} onBaixar={onBaixar} onFechar={onClose} />}
      </QueryState>
    </ResponsiveDialog>
  );
}

function Detalhe({
  titulo,
  onBaixar,
  onFechar,
}: {
  titulo: TituloDto;
  onBaixar: (parcelaId: string) => void;
  onFechar: () => void;
}) {
  const confirm = useConfirm();
  const estornar = useEstornarParcela();
  const cancelar = useCancelarTitulo();
  const textos = TEXTOS_POR_TIPO[titulo.tipo];
  const temPaga = titulo.parcelas.some((p) => p.status === 'paga');

  const confirmarEstorno = async (parcela: ParcelaDto) => {
    const ok = await confirm({
      titulo: 'Estornar baixa?',
      descricao: `O lançamento de ${formatBRL(parcela.valorPago ?? parcela.valor)} será excluído e a parcela ${parcela.numero}/${titulo.numeroParcelas} volta a ficar em aberto.`,
      confirmarTexto: 'Estornar',
      tom: 'destructive',
    });
    if (ok) await estornar.mutateAsync(parcela.id).catch(() => undefined);
  };

  const confirmarCancelamento = async () => {
    const ok = await confirm({
      titulo: 'Cancelar esta conta?',
      descricao: 'Todas as parcelas em aberto serão canceladas. Esta ação não pode ser desfeita.',
      confirmarTexto: 'Cancelar conta',
      tom: 'destructive',
    });
    if (ok) {
      await cancelar.mutateAsync(titulo.id).catch(() => undefined);
      onFechar();
    }
  };

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-zinc-500">Status</dt>
          <dd>
            <Badge tone={TONE_TITULO[titulo.status]} dot>
              {STATUS_TITULO_LABELS[titulo.status]}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Valor total</dt>
          <dd className="font-semibold tabular-nums">{formatBRL(titulo.valorTotal)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">{titulo.tipo === 'pagar' ? 'Pago' : 'Recebido'}</dt>
          <dd className="tabular-nums text-receita-700">{formatBRL(titulo.valorPago)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Em aberto</dt>
          <dd className="tabular-nums">{formatBRL(titulo.valorAberto)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-zinc-500">{textos.contatoLabel}</dt>
          <dd>{titulo.contato?.nome ?? '—'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-zinc-500">Categoria</dt>
          <dd>{titulo.categoria?.nome ?? '—'}</dd>
        </div>
        {titulo.observacoes ? (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs text-zinc-500">Observações</dt>
            <dd className="whitespace-pre-wrap">{titulo.observacoes}</dd>
          </div>
        ) : null}
      </dl>

      <ul className="divide-y divide-borda rounded-lg border border-borda" aria-label="Parcelas">
        {titulo.parcelas.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <span className="w-12 shrink-0 font-medium tabular-nums">
              {p.numero}/{titulo.numeroParcelas}
            </span>
            <span className="w-24 shrink-0 tabular-nums">{formatData(p.vencimento)}</span>
            <span className="w-28 shrink-0 font-semibold tabular-nums">{formatBRL(p.valor)}</span>
            <StatusParcelaBadge parcela={p} />
            {p.status === 'paga' ? (
              <span className="text-xs text-zinc-500">
                {titulo.tipo === 'pagar' ? 'pago' : 'recebido'} em {formatData(p.dataPagamento)}
                {p.valorPago !== null && p.valorPago !== p.valor
                  ? ` (${formatBRL(p.valorPago)})`
                  : ''}
                {p.formaPagamento ? ` · ${FORMA_PAGAMENTO_LABELS[p.formaPagamento]}` : ''}
              </span>
            ) : null}
            <span className="ml-auto flex gap-1">
              {p.status === 'aberta' ? (
                <Button size="sm" variant="secondary" onClick={() => onBaixar(p.id)}>
                  {textos.baixar}
                </Button>
              ) : null}
              {p.status === 'paga' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<RotateCcw aria-hidden="true" />}
                  onClick={() => void confirmarEstorno(p)}
                  loading={estornar.isPending && estornar.variables === p.id}
                >
                  Estornar
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {titulo.status === 'aberto' ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            className="text-perigo-700"
            icon={<Ban aria-hidden="true" />}
            onClick={() => void confirmarCancelamento()}
            disabled={temPaga}
            loading={cancelar.isPending}
            title={temPaga ? 'Estorne as parcelas pagas antes de cancelar' : undefined}
          >
            Cancelar conta
          </Button>
        </div>
      ) : null}
    </div>
  );
}
