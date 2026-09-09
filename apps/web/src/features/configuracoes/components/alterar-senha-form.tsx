// Formulário "Alterar senha": exige a senha atual; ao salvar, a API revoga as outras sessões.
import { zodResolver } from '@hookform/resolvers/zod';
import { senha as senhaSchema } from '@meifin/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormInput, FormRootError } from '@/components/ui/form-field';
import { aplicarErrosDoServidor } from '@/lib/api/errors';

import { useChangePassword } from '@/features/auth/hooks';

const schema = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual'),
    novaSenha: senhaSchema,
    confirmarSenha: z.string(),
  })
  .refine((v) => v.novaSenha === v.confirmarSenha, {
    path: ['confirmarSenha'],
    message: 'As senhas não conferem',
  });

type SenhaForm = z.input<typeof schema>;
type SenhaValores = z.output<typeof schema>;

export function AlterarSenhaForm() {
  const alterar = useChangePassword();
  const form = useForm<SenhaForm, unknown, SenhaValores>({
    resolver: zodResolver(schema),
    defaultValues: { senhaAtual: '', novaSenha: '', confirmarSenha: '' },
  });

  const onSubmit = (v: SenhaValores) => {
    alterar.mutate(
      { senhaAtual: v.senhaAtual, novaSenha: v.novaSenha },
      {
        onSuccess: () => {
          form.reset({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
          toast.success('Senha alterada. Suas outras sessões foram encerradas.');
        },
        onError: (err) => aplicarErrosDoServidor(err, form.setError),
      },
    );
  };

  return (
    <form className="max-w-sm space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FormRootError errors={form.formState.errors} />
      <FormInput
        control={form.control}
        name="senhaAtual"
        label="Senha atual"
        type="password"
        autoComplete="current-password"
      />
      <FormInput
        control={form.control}
        name="novaSenha"
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres."
      />
      <FormInput
        control={form.control}
        name="confirmarSenha"
        label="Confirmar nova senha"
        type="password"
        autoComplete="new-password"
      />
      <Button type="submit" loading={alterar.isPending}>
        Alterar senha
      </Button>
    </form>
  );
}
