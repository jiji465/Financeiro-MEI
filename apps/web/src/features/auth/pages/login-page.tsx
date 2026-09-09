import { zodResolver } from '@hookform/resolvers/zod';
import { loginBody, type LoginBody } from '@meifin/shared';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormInput, FormRootError } from '@/components/ui/form-field';
import { aplicarErrosDoServidor } from '@/lib/api/errors';

import { useLogin } from '../hooks';

type LoginForm = z.input<typeof loginBody>;

export function LoginPage() {
  const [params] = useSearchParams();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const login = useLogin();
  const form = useForm<LoginForm, unknown, LoginBody>({
    resolver: zodResolver(loginBody),
    defaultValues: { email: '', senha: '' },
  });

  const onSubmit = (valores: LoginBody) => {
    login.mutate(valores, {
      onError: (err) => aplicarErrosDoServidor(err, form.setError),
    });
  };

  const cadastroHref = params.get('next')
    ? `/cadastro?next=${encodeURIComponent(params.get('next') ?? '')}`
    : '/cadastro';

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
      <p className="mt-1 text-sm text-zinc-500">Acesse o controle financeiro do seu MEI.</p>

      <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormRootError errors={form.formState.errors} />
        <FormInput
          control={form.control}
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="voce@exemplo.com.br"
          autoFocus
        />
        <FormInput
          control={form.control}
          name="senha"
          label="Senha"
          type={mostrarSenha ? 'text' : 'password'}
          autoComplete="current-password"
          sufixo={
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={mostrarSenha}
              className="flex size-9 items-center justify-center rounded-md hover:bg-zinc-100"
            >
              {mostrarSenha ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          }
        />
        <div className="text-right">
          <Link
            to="/esqueci-senha"
            className="text-sm text-primary-700 underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={login.isPending}>
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Ainda não tem conta?{' '}
        <Link
          to={cadastroHref}
          className="font-medium text-primary-700 underline-offset-4 hover:underline"
        >
          Solicitar acesso
        </Link>
      </p>
    </div>
  );
}
