import { zodResolver } from '@hookform/resolvers/zod';
import {
  ATIVIDADES,
  CAMINHONEIRO_TRIBUTOS,
  email as emailSchema,
  hojeSP,
  isoDate,
  senha as senhaSchema,
  signupBody,
} from '@meifin/shared';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormDateInput,
  FormInput,
  FormMaskedInput,
  FormRadioCards,
  FormRootError,
} from '@/components/ui/form-field';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { isValidCNPJ } from '@/lib/format/documento';
import {
  ATIVIDADE_DESCRICOES,
  ATIVIDADE_LABELS,
  CAMINHONEIRO_TRIBUTOS_LABELS,
  opcoesDe,
} from '@/lib/labels';
import { cn } from '@/lib/utils/cn';

import { useSignup } from '../hooks';

const cadastroSchema = z
  .object({
    nome: z.string().trim().min(2, 'Informe seu nome').max(120, 'Nome muito longo'),
    email: emailSchema,
    senha: senhaSchema,
    confirmarSenha: z.string(),
    cnpj: z
      .string()
      .optional()
      .refine((v) => !v || isValidCNPJ(v), 'CNPJ inválido'),
    atividade: z.enum(ATIVIDADES, { error: 'Escolha a atividade do seu MEI' }),
    caminhoneiroTributos: z.enum(CAMINHONEIRO_TRIBUTOS).optional(),
    dataAbertura: z
      .union([z.literal(''), isoDate])
      .optional()
      .refine((v) => !v || v <= hojeSP(), 'A data de abertura não pode ser futura'),
  })
  .refine((v) => v.senha === v.confirmarSenha, {
    path: ['confirmarSenha'],
    message: 'As senhas não conferem',
  })
  .refine((v) => v.atividade !== 'caminhoneiro' || v.caminhoneiroTributos !== undefined, {
    path: ['caminhoneiroTributos'],
    message: 'Informe quais tributos o caminhoneiro recolhe (ICMS, ISS ou ambos)',
  });

type CadastroForm = z.input<typeof cadastroSchema>;
type CadastroValores = z.output<typeof cadastroSchema>;

const OPCOES_ATIVIDADE = ATIVIDADES.map((value) => ({
  value,
  label: ATIVIDADE_LABELS[value],
  descricao: ATIVIDADE_DESCRICOES[value],
}));

const OPCOES_TRIBUTOS = opcoesDe(CAMINHONEIRO_TRIBUTOS, CAMINHONEIRO_TRIBUTOS_LABELS);

/** Pontuação 0-4 de força da senha (tamanho + variedade de caracteres). */
export function forcaDaSenha(senha: string): { nivel: 0 | 1 | 2 | 3 | 4; rotulo: string } {
  if (!senha) return { nivel: 0, rotulo: '' };
  let pontos = 0;
  if (senha.length >= 8) pontos += 1;
  if (senha.length >= 12) pontos += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((re) => re.test(senha)).length;
  if (classes >= 2) pontos += 1;
  if (classes >= 3) pontos += 1;
  const nivel = Math.min(4, Math.max(1, pontos)) as 1 | 2 | 3 | 4;
  const rotulos = { 1: 'Fraca', 2: 'Razoável', 3: 'Boa', 4: 'Forte' } as const;
  return { nivel, rotulo: rotulos[nivel] };
}

function ForcaSenha({ senha }: { senha: string }) {
  const { nivel, rotulo } = forcaDaSenha(senha);
  if (!senha) return null;
  const cores = ['', 'bg-perigo-500', 'bg-alerta-500', 'bg-receita-500', 'bg-receita-600'];
  return (
    <div className="mt-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={cn('h-1.5 flex-1 rounded-full bg-zinc-200', n <= nivel && cores[nivel])}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Força da senha: <span className="font-medium">{rotulo}</span>
        {nivel < 3 ? ' — use letras, números e símbolos.' : ''}
      </p>
    </div>
  );
}

export function CadastroPage() {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const signup = useSignup();
  const form = useForm<CadastroForm, unknown, CadastroValores>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {
      nome: '',
      email: '',
      senha: '',
      confirmarSenha: '',
      cnpj: '',
      atividade: undefined,
      caminhoneiroTributos: undefined,
      dataAbertura: '',
    },
  });
  const senha = useWatch({ control: form.control, name: 'senha' }) ?? '';
  const atividade = useWatch({ control: form.control, name: 'atividade' });

  const onSubmit = (valores: CadastroValores) => {
    const body = signupBody.safeParse({
      nome: valores.nome,
      email: valores.email,
      senha: valores.senha,
      cnpj: valores.cnpj || undefined,
      atividade: valores.atividade,
      caminhoneiroTributos:
        valores.atividade === 'caminhoneiro' ? valores.caminhoneiroTributos : undefined,
      dataAbertura: valores.dataAbertura || undefined,
    });
    if (!body.success) {
      form.setError('root.serverError', { message: 'Revise os dados informados.' });
      return;
    }
    signup.mutate(body.data, {
      onError: (err) => aplicarErrosDoServidor(err, form.setError),
    });
  };

  const olho = (
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
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Criar conta</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Leva menos de um minuto. Você pode completar os dados do MEI depois.
      </p>

      <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormRootError errors={form.formState.errors} />

        <FormInput
          control={form.control}
          name="nome"
          label="Seu nome"
          autoComplete="name"
          placeholder="Como quer ser chamado(a)"
        />
        <FormInput
          control={form.control}
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="voce@exemplo.com.br"
        />
        <div>
          <FormInput
            control={form.control}
            name="senha"
            label="Senha"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="new-password"
            hint="Mínimo de 8 caracteres."
            sufixo={olho}
          />
          <ForcaSenha senha={senha} />
        </div>
        <FormInput
          control={form.control}
          name="confirmarSenha"
          label="Confirmar senha"
          type={mostrarSenha ? 'text' : 'password'}
          autoComplete="new-password"
        />

        <FormMaskedInput
          control={form.control}
          name="cnpj"
          mask="cnpj"
          label="CNPJ"
          opcional
          hint="Se ainda não formalizou, deixe em branco."
        />

        <FormRadioCards
          control={form.control}
          name="atividade"
          label="Atividade do MEI"
          hint="Define quais tributos entram no DAS mensal."
          options={OPCOES_ATIVIDADE}
        />

        {atividade === 'caminhoneiro' ? (
          <FormRadioCards
            control={form.control}
            name="caminhoneiroTributos"
            label="Tributos do MEI Caminhoneiro"
            options={OPCOES_TRIBUTOS}
          />
        ) : null}

        <FormDateInput
          control={form.control}
          name="dataAbertura"
          label="Data de abertura do MEI"
          opcional
          max={hojeSP()}
          hint="Usada para calcular o limite proporcional no primeiro ano."
        />

        <Button type="submit" className="w-full" size="lg" loading={signup.isPending}>
          Criar conta
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Já tem conta?{' '}
        <Link
          to="/entrar"
          className="font-medium text-primary-700 underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
