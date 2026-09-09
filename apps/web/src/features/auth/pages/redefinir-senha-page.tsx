import { zodResolver } from '@hookform/resolvers/zod';
import { senha as senhaSchema } from '@meifin/shared';
import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormInput, FormRootError } from '@/components/ui/form-field';
import { aplicarErrosDoServidor } from '@/lib/api/errors';

import { useResetPassword } from '../hooks';

const schema = z
  .object({ novaSenha: senhaSchema, confirmarSenha: z.string() })
  .refine((v) => v.novaSenha === v.confirmarSenha, {
    path: ['confirmarSenha'],
    message: 'As senhas não conferem',
  });
type Form = z.input<typeof schema>;
type Valores = z.output<typeof schema>;

export function RedefinirSenhaPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const reset = useResetPassword();
  const form = useForm<Form, unknown, Valores>({
    resolver: zodResolver(schema),
    defaultValues: { novaSenha: '', confirmarSenha: '' },
  });

  if (!token) {
    return (
      <EmptyState
        icone={<KeyRound aria-hidden="true" />}
        titulo="Link inválido"
        descricao="Este link de redefinição está incompleto ou expirou. Solicite um novo."
        acao={
          <Button asChild>
            <Link to="/esqueci-senha">Solicitar novo link</Link>
          </Button>
        }
        className="border-0 py-4"
      />
    );
  }

  const onSubmit = (valores: Valores) => {
    reset.mutate(
      { token, novaSenha: valores.novaSenha },
      {
        onSuccess: () => {
          toast.success('Senha redefinida. Entre com a nova senha.');
          navigate('/entrar', { replace: true });
        },
        onError: (err) => aplicarErrosDoServidor(err, form.setError, { campos: ['novaSenha'] }),
      },
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Redefinir senha</h1>
      <p className="mt-1 text-sm text-zinc-500">Escolha uma nova senha para sua conta.</p>

      <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormRootError errors={form.formState.errors} />
        <FormInput
          control={form.control}
          name="novaSenha"
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres."
          autoFocus
        />
        <FormInput
          control={form.control}
          name="confirmarSenha"
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
        />
        <Button type="submit" className="w-full" size="lg" loading={reset.isPending}>
          Salvar nova senha
        </Button>
      </form>
    </div>
  );
}
