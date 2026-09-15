// Diálogo "Nova conta" / "Editar conta". Cadastro manual: não há integração bancária, então o
// saldo inicial é o que o dono viu no extrato no dia em que começou a usar o sistema — daí para
// frente o saldo anda sozinho com os lançamentos pagos vinculados à conta.
import { zodResolver } from '@hookform/resolvers/zod';
import { TIPOS_CONTA_BANCARIA, type ContaBancariaSaldoDto } from '@meifin/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormInput, FormMoneyInput, FormRootError, FormSelect } from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { opcoesDe, TIPO_CONTA_BANCARIA_LABELS } from '@/lib/labels';

import { useAtualizarContaBancaria, useCriarContaBancaria } from '../hooks';

const TIPO_OPCOES = opcoesDe(TIPOS_CONTA_BANCARIA, TIPO_CONTA_BANCARIA_LABELS);

const contaSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome da conta')
    .max(80, 'Nome deve ter no máximo 80 caracteres'),
  instituicao: z.string().trim().max(80, 'Máximo de 80 caracteres').nullable(),
  tipo: z.enum(TIPOS_CONTA_BANCARIA, { error: 'Escolha o tipo da conta' }),
  saldoInicial: z.number().nullable(),
});
type ContaFormInput = z.input<typeof contaSchema>;
type ContaFormValores = z.output<typeof contaSchema>;

const VAZIO: ContaFormInput = {
  nome: '',
  instituicao: '',
  tipo: 'corrente',
  saldoInicial: 0,
};

export interface ContaBancariaDialogProps {
  /** undefined = criando; ContaBancariaSaldoDto = editando. */
  conta?: ContaBancariaSaldoDto | undefined;
  aberto: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContaBancariaDialog({ conta, aberto, onOpenChange }: ContaBancariaDialogProps) {
  const criar = useCriarContaBancaria();
  const atualizar = useAtualizarContaBancaria(conta?.id ?? '');
  const salvando = criar.isPending || atualizar.isPending;
  const editando = Boolean(conta);

  const form = useForm<ContaFormInput, unknown, ContaFormValores>({
    resolver: zodResolver(contaSchema),
    defaultValues: VAZIO,
  });

  useEffect(() => {
    if (!aberto) return;
    form.reset(
      conta
        ? {
            nome: conta.nome,
            instituicao: conta.instituicao ?? '',
            tipo: conta.tipo,
            saldoInicial: conta.saldoInicial,
          }
        : VAZIO,
    );
  }, [aberto, conta, form]);

  const onSubmit = (valores: ContaFormValores) => {
    const body = {
      nome: valores.nome,
      instituicao: valores.instituicao || null,
      tipo: valores.tipo,
      saldoInicial: valores.saldoInicial ?? 0,
    };
    const opcoes = {
      onSuccess: () => onOpenChange(false),
      onError: (err: unknown) => aplicarErrosDoServidor(err, form.setError),
    };
    if (conta) atualizar.mutate(body, opcoes);
    else criar.mutate(body, opcoes);
  };

  return (
    <ResponsiveDialog
      open={aberto}
      onOpenChange={onOpenChange}
      titulo={editando ? `Editar "${conta?.nome}"` : 'Nova conta bancária'}
      bloqueado={salvando}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-conta-bancaria" loading={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        id="form-conta-bancaria"
        className="space-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FormRootError errors={form.formState.errors} />
        <FormInput
          control={form.control}
          name="nome"
          label="Nome da conta"
          autoFocus
          placeholder="Ex.: Nubank PJ, Caixa da loja"
          hint="Como você chama essa conta no dia a dia."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            control={form.control}
            name="instituicao"
            label="Instituição"
            opcional
            placeholder="Ex.: Nubank, Banco do Brasil"
          />
          <FormSelect control={form.control} name="tipo" label="Tipo" options={TIPO_OPCOES} />
        </div>
        <FormMoneyInput
          control={form.control}
          name="saldoInicial"
          label="Saldo inicial"
          allowNegative
          hint="Quanto havia na conta antes do primeiro lançamento aqui. Pode ser negativo."
        />
      </form>
    </ResponsiveDialog>
  );
}
