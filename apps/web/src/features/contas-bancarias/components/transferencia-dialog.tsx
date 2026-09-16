// Diálogo "Transferir entre contas": move dinheiro de uma conta do MEI para outra.
//
// Não é receita nem despesa — o MEI não faturou nada, o dinheiro só mudou de lugar. Por isso a
// transferência não aparece em relatório de faturamento, DRE, DASN nem no limite anual. O texto
// da tela diz isso na cara do usuário, porque é exatamente a dúvida que ele vai ter.
import { zodResolver } from '@hookform/resolvers/zod';
import { isoDate } from '@meifin/shared';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormCombobox,
  FormDateInput,
  FormInput,
  FormMoneyInput,
  FormRootError,
} from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useContasBancariasOpcoes } from '@/features/referencias';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { hojeSP } from '@/lib/format/date';

import { useCriarTransferencia } from '../hooks';

const transferenciaSchema = z
  .object({
    data: isoDate,
    valor: z
      .number({ error: 'Informe o valor' })
      .nullable()
      .refine((v): v is number => v !== null && v > 0, 'Informe o valor'),
    contaOrigemId: z.string().min(1, 'Escolha a conta de origem'),
    contaDestinoId: z.string().min(1, 'Escolha a conta de destino'),
    descricao: z.string().trim().max(160, 'Máximo de 160 caracteres').nullable(),
  })
  .refine((t) => t.contaOrigemId !== t.contaDestinoId, {
    message: 'A conta de destino precisa ser diferente da de origem',
    path: ['contaDestinoId'],
  });

type TransferenciaFormInput = z.input<typeof transferenciaSchema>;
type TransferenciaFormValores = z.output<typeof transferenciaSchema>;

function vazio(): TransferenciaFormInput {
  return {
    data: hojeSP(),
    valor: null,
    contaOrigemId: '',
    contaDestinoId: '',
    descricao: '',
  };
}

export interface TransferenciaDialogProps {
  aberto: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferenciaDialog({ aberto, onOpenChange }: TransferenciaDialogProps) {
  const criar = useCriarTransferencia();
  const contas = useContasBancariasOpcoes();

  const form = useForm<TransferenciaFormInput, unknown, TransferenciaFormValores>({
    resolver: zodResolver(transferenciaSchema),
    defaultValues: vazio(),
  });

  useEffect(() => {
    if (aberto) form.reset(vazio());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const origemId = useWatch({ control: form.control, name: 'contaOrigemId' });

  const onSubmit = (v: TransferenciaFormValores) => {
    criar.mutate(
      {
        data: v.data,
        valor: v.valor,
        contaOrigemId: v.contaOrigemId,
        contaDestinoId: v.contaDestinoId,
        descricao: v.descricao?.trim() || null,
        observacoes: null,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => aplicarErrosDoServidor(err, form.setError),
      },
    );
  };

  return (
    <ResponsiveDialog
      open={aberto}
      onOpenChange={onOpenChange}
      titulo="Transferir entre contas"
      descricao="Mover dinheiro de uma conta sua para outra — por exemplo, sacar da maquininha para o banco."
      bloqueado={criar.isPending}
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormRootError errors={form.formState.errors} />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormCombobox
            control={form.control}
            name="contaOrigemId"
            label="De qual conta sai"
            options={contas.opcoes}
            loading={contas.isPending}
            placeholder="Selecione…"
          />
          <FormCombobox
            control={form.control}
            name="contaDestinoId"
            label="Para qual conta vai"
            // Tirar a origem da lista evita o erro mais provável antes de ele acontecer.
            options={contas.opcoes.filter((o) => o.value !== origemId)}
            loading={contas.isPending}
            placeholder="Selecione…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormMoneyInput control={form.control} name="valor" label="Valor" />
          <FormDateInput control={form.control} name="data" label="Data" />
        </div>

        <FormInput
          control={form.control}
          name="descricao"
          label="Descrição"
          opcional
          placeholder="Ex.: saque da maquininha"
        />

        <p className="rounded-lg border border-borda bg-fundo px-3 py-2 text-sm text-zinc-600">
          Transferência não conta como faturamento: ela não entra na DRE, na DASN nem no seu limite
          anual. Só muda o saldo das duas contas.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={criar.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={criar.isPending}>
            Transferir
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
