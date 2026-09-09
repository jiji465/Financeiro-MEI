// Diálogo "Declaração DASN-SIMEI": marca como entregue (data + nº do recibo, opcional) ou reabre
// (volta para pendente). O faturamento declarado começa igual ao apurado; o contador pode ajustar.
import { zodResolver } from '@hookform/resolvers/zod';
import { type DasnDto, isoDate } from '@meifin/shared';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormDateInput,
  FormInput,
  FormMoneyInput,
  FormRootError,
  FormSwitch,
} from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { hojeSP } from '@/lib/format/date';

import { useSalvarDasn } from '../hooks';

const dasnFormSchema = z
  .object({
    entregue: z.boolean(),
    dataEntrega: z.union([z.literal(''), isoDate]).optional(),
    numeroRecibo: z.string().trim().max(60, 'Máximo de 60 caracteres').optional(),
    faturamentoDeclarado: z.number().int().nonnegative().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.entregue && !v.dataEntrega) {
      ctx.addIssue({ code: 'custom', path: ['dataEntrega'], message: 'Informe a data de entrega' });
    }
  });

type DasnForm = z.input<typeof dasnFormSchema>;
type DasnValores = z.output<typeof dasnFormSchema>;

export interface DasnDialogProps {
  dasn: DasnDto | null;
  onOpenChange: (open: boolean) => void;
}

export function DasnDialog({ dasn, onOpenChange }: DasnDialogProps) {
  const salvar = useSalvarDasn();
  const form = useForm<DasnForm, unknown, DasnValores>({
    resolver: zodResolver(dasnFormSchema),
    defaultValues: {
      entregue: false,
      dataEntrega: '',
      numeroRecibo: '',
      faturamentoDeclarado: null,
    },
  });
  const entregue = useWatch({ control: form.control, name: 'entregue' });

  useEffect(() => {
    if (dasn) {
      form.reset({
        entregue: dasn.status === 'entregue',
        dataEntrega: dasn.dataEntrega ?? '',
        numeroRecibo: dasn.numeroRecibo ?? '',
        faturamentoDeclarado: dasn.faturamentoDeclarado ?? dasn.faturamentoApurado,
      });
    }
  }, [dasn, form]);

  const onSubmit = (valores: DasnValores) => {
    if (!dasn) return;
    salvar.mutate(
      {
        anoBase: dasn.anoBase,
        body: {
          status: valores.entregue ? 'entregue' : 'pendente',
          dataEntrega: valores.entregue ? valores.dataEntrega || null : null,
          numeroRecibo: valores.entregue ? valores.numeroRecibo || null : null,
          faturamentoDeclarado: valores.faturamentoDeclarado ?? null,
        },
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => aplicarErrosDoServidor(err, form.setError),
      },
    );
  };

  return (
    <ResponsiveDialog
      open={dasn !== null}
      onOpenChange={onOpenChange}
      titulo={dasn ? `DASN-SIMEI ${dasn.anoBase}` : ''}
      descricao={
        dasn && !dasn.janelaAberta
          ? `A entrega só é permitida a partir de 1º de janeiro de ${dasn.anoBase + 1}. Você ainda pode registrar os dados quando o prazo abrir.`
          : 'Registre a entrega da declaração anual no site do Simples Nacional e confirme aqui.'
      }
      bloqueado={salvar.isPending}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-dasn" loading={salvar.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-dasn" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormRootError errors={form.formState.errors} />
        <FormSwitch
          control={form.control}
          name="entregue"
          label="Já entreguei a DASN-SIMEI"
          descricao="Desligue para reabrir e voltar ao status pendente."
        />
        {entregue ? (
          <>
            <FormDateInput
              control={form.control}
              name="dataEntrega"
              label="Data de entrega"
              max={hojeSP()}
            />
            <FormInput
              control={form.control}
              name="numeroRecibo"
              label="Número do recibo"
              opcional
              placeholder="Ex.: 00000000000000000"
            />
          </>
        ) : null}
        <FormMoneyInput
          control={form.control}
          name="faturamentoDeclarado"
          label="Faturamento declarado"
          hint="Começa igual ao apurado pelo sistema; ajuste se declarou um valor diferente."
        />
      </form>
    </ResponsiveDialog>
  );
}
