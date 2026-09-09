// Diálogo "Marcar DAS como pago": data, valor pago (pode diferir do calculado, com juros) e forma.
// Gera a despesa na categoria "Impostos e DAS" (origem das) pela API.
import { zodResolver } from '@hookform/resolvers/zod';
import { type DasCompetenciaDto, FORMAS_PAGAMENTO, isoDate } from '@meifin/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormDateInput,
  FormMoneyInput,
  FormRootError,
  FormSelect,
  FormTextarea,
} from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { formatData, formatMesExtenso, hojeSP } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';
import { FORMA_PAGAMENTO_LABELS, opcoesDe } from '@/lib/labels';

import { useRegistrarPagamentoDas } from '../hooks';

const pagamentoSchema = z.object({
  dataPagamento: isoDate.refine((v) => v <= hojeSP(), 'A data de pagamento não pode ser futura'),
  valorPago: z
    .number({ error: 'Informe o valor pago' })
    .nullable()
    .transform((v, ctx) => {
      if (v === null || !Number.isInteger(v) || v <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Informe o valor pago' });
        return z.NEVER;
      }
      return v;
    }),
  formaPagamento: z.enum(FORMAS_PAGAMENTO, { error: 'Escolha a forma de pagamento' }),
  observacao: z.string().trim().max(500, 'Máximo de 500 caracteres').optional(),
});

type PagamentoForm = z.input<typeof pagamentoSchema>;
type PagamentoValores = z.output<typeof pagamentoSchema>;

const OPCOES_FORMA = opcoesDe(FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABELS);

export interface PagamentoDasDialogProps {
  competencia: DasCompetenciaDto | null;
  onOpenChange: (open: boolean) => void;
}

export function PagamentoDasDialog({ competencia, onOpenChange }: PagamentoDasDialogProps) {
  const registrar = useRegistrarPagamentoDas();
  const form = useForm<PagamentoForm, unknown, PagamentoValores>({
    resolver: zodResolver(pagamentoSchema),
    defaultValues: {
      dataPagamento: hojeSP(),
      valorPago: null,
      formaPagamento: 'pix',
      observacao: '',
    },
  });

  useEffect(() => {
    if (competencia) {
      form.reset({
        dataPagamento: hojeSP(),
        valorPago: competencia.valor,
        formaPagamento: 'pix',
        observacao: '',
      });
    }
  }, [competencia, form]);

  const onSubmit = (valores: PagamentoValores) => {
    if (!competencia) return;
    registrar.mutate(
      {
        competencia: competencia.competencia,
        body: {
          dataPagamento: valores.dataPagamento,
          valorPago: valores.valorPago,
          formaPagamento: valores.formaPagamento,
          observacao: valores.observacao || null,
        },
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => aplicarErrosDoServidor(err, form.setError),
      },
    );
  };

  const atrasado = competencia?.status === 'atrasado';

  return (
    <ResponsiveDialog
      open={competencia !== null}
      onOpenChange={onOpenChange}
      titulo={
        competencia ? `Marcar DAS de ${formatMesExtenso(competencia.competencia)} como pago` : ''
      }
      descricao={
        competencia
          ? `Valor calculado: ${formatBRL(competencia.valor)} · vencimento ${formatData(competencia.vencimento)}. Uma despesa será registrada em "Impostos e DAS".`
          : undefined
      }
      bloqueado={registrar.isPending}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={registrar.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="form-pagamento-das" loading={registrar.isPending}>
            Confirmar pagamento
          </Button>
        </>
      }
    >
      <form
        id="form-pagamento-das"
        className="space-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FormRootError errors={form.formState.errors} />
        <FormDateInput
          control={form.control}
          name="dataPagamento"
          label="Data do pagamento"
          max={hojeSP()}
        />
        <FormMoneyInput
          control={form.control}
          name="valorPago"
          label="Valor pago"
          hint={
            atrasado
              ? 'Em atraso a guia sai com multa e juros: informe o valor que aparece no PGMEI.'
              : 'Normalmente é o valor calculado. Ajuste se a guia veio diferente.'
          }
        />
        <FormSelect
          control={form.control}
          name="formaPagamento"
          label="Forma de pagamento"
          options={OPCOES_FORMA}
        />
        <FormTextarea
          control={form.control}
          name="observacao"
          label="Observação"
          opcional
          rows={2}
          placeholder="Ex.: pago com multa pelo app do banco"
        />
      </form>
    </ResponsiveDialog>
  );
}
