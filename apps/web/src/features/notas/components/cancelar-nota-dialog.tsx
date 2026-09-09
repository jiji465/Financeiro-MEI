// "Cancelar nota": motivo obrigatório e a opção de estornar (excluir) a receita vinculada.
import { zodResolver } from '@hookform/resolvers/zod';
import type { NotaFiscalDto } from '@meifin/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormRootError, FormSwitch, FormTextarea } from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { formatBRL } from '@/lib/format/money';

import { useCancelarNota } from '../hooks';

const cancelarNotaForm = z.object({
  motivoCancelamento: z
    .string()
    .trim()
    .min(3, 'Informe o motivo do cancelamento')
    .max(255, 'Máximo de 255 caracteres'),
  estornarReceita: z.boolean(),
});
type CancelarNotaForm = z.infer<typeof cancelarNotaForm>;

export interface CancelarNotaDialogProps {
  nota: NotaFiscalDto | null;
  onClose: () => void;
}

export function CancelarNotaDialog({ nota, onClose }: CancelarNotaDialogProps) {
  const cancelar = useCancelarNota();
  const form = useForm<CancelarNotaForm>({
    resolver: zodResolver(cancelarNotaForm),
    defaultValues: { motivoCancelamento: '', estornarReceita: false },
  });

  const fechar = () => {
    onClose();
    form.reset();
  };

  const onSubmit = (valores: CancelarNotaForm) => {
    if (!nota) return;
    cancelar.mutate(
      { id: nota.id, body: valores },
      { onSuccess: fechar, onError: (err) => aplicarErrosDoServidor(err, form.setError) },
    );
  };

  return (
    <ResponsiveDialog
      open={Boolean(nota)}
      onOpenChange={(aberto) => {
        if (!aberto) fechar();
      }}
      titulo="Cancelar nota"
      descricao={
        nota ? `Nota ${nota.numero}/${nota.serie ?? '1'} · ${formatBRL(nota.valor)}` : undefined
      }
      bloqueado={cancelar.isPending}
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormRootError errors={form.formState.errors} />
        <FormTextarea
          control={form.control}
          name="motivoCancelamento"
          label="Motivo do cancelamento"
          placeholder="Ex.: Nota emitida com erro no valor"
          rows={3}
          autoFocus
        />
        {nota?.lancamentoId ? (
          <FormSwitch
            control={form.control}
            name="estornarReceita"
            label="Estornar a receita vinculada"
            hint="Exclui o lançamento de receita criado por esta nota."
          />
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={fechar} disabled={cancelar.isPending}>
            Voltar
          </Button>
          <Button type="submit" variant="destructive" loading={cancelar.isPending}>
            Cancelar nota
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
