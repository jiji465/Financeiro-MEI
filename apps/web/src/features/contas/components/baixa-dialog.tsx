// Baixa rápida de uma parcela ("Pagar"/"Receber"): data, valor pago, forma e observações.
// Aberto por ?pagar=<parcelaId> (deep link) — busca a parcela pela API.
import { zodResolver } from '@hookform/resolvers/zod';
import {
  baixaParcelaBody,
  type BaixaParcelaBody,
  FORMAS_PAGAMENTO,
  type ParcelaComTituloDto,
} from '@meifin/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormDateInput,
  FormMoneyInput,
  FormRootError,
  FormSelect,
  FormTextarea,
} from '@/components/ui/form-field';
import { QueryState } from '@/components/ui/query-state';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { SkeletonText } from '@/components/ui/skeleton';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { formatData, hojeSP } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';
import { FORMA_PAGAMENTO_LABELS, opcoesDe } from '@/lib/labels';

import { useBaixarParcela, useParcela } from '../hooks';
import { TEXTOS_POR_TIPO } from '../utils';

type BaixaForm = z.input<typeof baixaParcelaBody>;

const OPCOES_FORMA = opcoesDe(FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABELS);

export interface BaixaDialogProps {
  parcelaId: string | null;
  onClose: () => void;
}

export function BaixaDialog({ parcelaId, onClose }: BaixaDialogProps) {
  const parcela = useParcela(parcelaId);
  return (
    <ResponsiveDialog
      open={Boolean(parcelaId)}
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
      titulo={
        parcela.data
          ? `${TEXTOS_POR_TIPO[parcela.data.titulo.tipo].baixar} parcela`
          : 'Baixar parcela'
      }
      descricao={
        parcela.data
          ? `${parcela.data.titulo.descricao} · parcela ${parcela.data.numero}/${parcela.data.titulo.numeroParcelas} · vence ${formatData(parcela.data.vencimento)}`
          : undefined
      }
    >
      <QueryState query={parcela} skeleton={<SkeletonText linhas={5} />}>
        {(dados) => <BaixaForm parcela={dados} onClose={onClose} />}
      </QueryState>
    </ResponsiveDialog>
  );
}

function BaixaForm({ parcela, onClose }: { parcela: ParcelaComTituloDto; onClose: () => void }) {
  const baixar = useBaixarParcela();
  const textos = TEXTOS_POR_TIPO[parcela.titulo.tipo];
  const form = useForm<BaixaForm, unknown, BaixaParcelaBody>({
    resolver: zodResolver(baixaParcelaBody),
    defaultValues: {
      dataPagamento: hojeSP(),
      valorPago: parcela.valor,
      formaPagamento: 'pix',
      observacoes: '',
    },
  });

  useEffect(() => {
    form.reset({
      dataPagamento: hojeSP(),
      valorPago: parcela.valor,
      formaPagamento: 'pix',
      observacoes: '',
    });
  }, [form, parcela.id, parcela.valor]);

  const onSubmit = (valores: BaixaParcelaBody) => {
    baixar.mutate(
      { id: parcela.id, body: valores },
      {
        onSuccess: onClose,
        onError: (err) => aplicarErrosDoServidor(err, form.setError),
      },
    );
  };

  if (parcela.status !== 'aberta') {
    return (
      <p className="text-sm text-zinc-600" role="status">
        Esta parcela já está {parcela.status === 'paga' ? 'paga' : 'cancelada'}.
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FormRootError errors={form.formState.errors} />
      <p className="text-sm text-zinc-600">
        Valor da parcela: <strong className="text-texto">{formatBRL(parcela.valor)}</strong>
        {parcela.atrasada ? (
          <span className="ml-2 text-perigo-700">
            (atrasada há {parcela.diasAtraso} {parcela.diasAtraso === 1 ? 'dia' : 'dias'})
          </span>
        ) : null}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormDateInput control={form.control} name="dataPagamento" label="Data do pagamento" />
        <FormMoneyInput
          control={form.control}
          name="valorPago"
          label="Valor pago"
          hint="Pode ser diferente do valor da parcela (juros, desconto)."
        />
      </div>
      <FormSelect
        control={form.control}
        name="formaPagamento"
        label="Forma de pagamento"
        options={OPCOES_FORMA}
      />
      <FormTextarea
        control={form.control}
        name="observacoes"
        label="Observações"
        opcional
        rows={2}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={baixar.isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={baixar.isPending}>
          Confirmar {textos.baixar.toLowerCase() === 'pagar' ? 'pagamento' : 'recebimento'}
        </Button>
      </div>
    </form>
  );
}
