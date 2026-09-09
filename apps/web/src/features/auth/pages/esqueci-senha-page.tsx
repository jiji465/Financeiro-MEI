import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordBody, type ForgotPasswordBody } from '@meifin/shared';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';

import { env } from '@/app/env';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormInput, FormRootError } from '@/components/ui/form-field';
import { aplicarErrosDoServidor } from '@/lib/api/errors';

import { useForgotPassword } from '../hooks';

type Form = z.input<typeof forgotPasswordBody>;

export function EsqueciSenhaPage() {
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const forgot = useForgotPassword();
  const form = useForm<Form, unknown, ForgotPasswordBody>({
    resolver: zodResolver(forgotPasswordBody),
    defaultValues: { email: '' },
  });

  const onSubmit = (valores: ForgotPasswordBody) => {
    forgot.mutate(valores, {
      onSuccess: () => setEnviadoPara(valores.email),
      onError: (err) => aplicarErrosDoServidor(err, form.setError),
    });
  };

  if (enviadoPara) {
    return (
      <EmptyState
        icone={<MailCheck aria-hidden="true" />}
        titulo="Verifique seu e-mail"
        descricao={
          <>
            Se existir uma conta para <strong>{enviadoPara}</strong>, enviamos um link para
            redefinir a senha. Ele vale por pouco tempo.
            {env.isDev ? (
              <>
                <br />
                <span className="text-xs">
                  Em desenvolvimento, o link aparece no console da API.
                </span>
              </>
            ) : null}
          </>
        }
        acao={
          <Button variant="outline" asChild>
            <Link to="/entrar">Voltar para entrar</Link>
          </Button>
        }
        className="border-0 py-4"
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Esqueci minha senha</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Informe seu e-mail e enviaremos um link para criar uma nova senha.
      </p>

      <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormRootError errors={form.formState.errors} />
        <FormInput
          control={form.control}
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
        />
        <Button type="submit" className="w-full" size="lg" loading={forgot.isPending}>
          Enviar link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        <Link
          to="/entrar"
          className="font-medium text-primary-700 underline-offset-4 hover:underline"
        >
          Voltar para entrar
        </Link>
      </p>
    </div>
  );
}
