// Cadastro deixou de ser self-service (seção 11 do plano): este formulário só registra um pedido
// de acesso. Quem cria a conta de verdade é o admin, pelo painel, depois de entrar em contato.
import { zodResolver } from '@hookform/resolvers/zod';
import { ATIVIDADES, criarSolicitacaoBody, email as emailSchema } from '@meifin/shared';
import { CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormInput,
  FormMaskedInput,
  FormRadioCards,
  FormRootError,
  FormTextarea,
} from '@/components/ui/form-field';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { ATIVIDADE_DESCRICOES, ATIVIDADE_LABELS } from '@/lib/labels';

import { useSolicitarAcesso } from '../hooks';

const solicitarSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome').max(120, 'Nome muito longo'),
  email: emailSchema,
  telefone: z.string().optional(),
  atividade: z.enum(ATIVIDADES).optional(),
  mensagem: z.string().trim().max(2000).optional(),
});

type SolicitarForm = z.input<typeof solicitarSchema>;
type SolicitarValores = z.output<typeof solicitarSchema>;

const OPCOES_ATIVIDADE = ATIVIDADES.map((value) => ({
  value,
  label: ATIVIDADE_LABELS[value],
  descricao: ATIVIDADE_DESCRICOES[value],
}));

export function CadastroPage() {
  const solicitar = useSolicitarAcesso();
  const form = useForm<SolicitarForm, unknown, SolicitarValores>({
    resolver: zodResolver(solicitarSchema),
    defaultValues: { nome: '', email: '', telefone: '', atividade: undefined, mensagem: '' },
  });

  if (solicitar.isSuccess) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-receita-50 text-receita-700">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Pedido recebido</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Obrigado! Entraremos em contato em breve para liberar seu acesso ao MEI Financeiro.
        </p>
        <Button asChild className="mt-6 w-full" size="lg" variant="outline">
          <Link to="/entrar">Já tenho conta</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = (valores: SolicitarValores) => {
    const body = criarSolicitacaoBody.safeParse({
      nome: valores.nome,
      email: valores.email,
      telefone: valores.telefone || undefined,
      atividade: valores.atividade,
      mensagem: valores.mensagem || undefined,
    });
    if (!body.success) {
      form.setError('root.serverError', { message: 'Revise os dados informados.' });
      return;
    }
    solicitar.mutate(body.data, {
      onError: (err) => aplicarErrosDoServidor(err, form.setError),
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Solicitar acesso</h1>
      <p className="mt-1 text-sm text-zinc-500">
        O acesso não é aberto: preencha seus dados e entraremos em contato para liberar sua conta.
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
        <FormMaskedInput
          control={form.control}
          name="telefone"
          mask="telefone"
          label="Telefone"
          opcional
          hint="Facilita o contato — pode deixar em branco."
        />

        <FormRadioCards
          control={form.control}
          name="atividade"
          label="Atividade do seu MEI"
          hint="Opcional — se ainda não tiver certeza, deixe em branco."
          options={OPCOES_ATIVIDADE}
        />

        <FormTextarea
          control={form.control}
          name="mensagem"
          label="Conte um pouco sobre o seu negócio"
          opcional
          rows={3}
          placeholder="Ex.: vendo produtos artesanais online e quero organizar o financeiro."
        />

        <Button type="submit" className="w-full" size="lg" loading={solicitar.isPending}>
          Solicitar acesso
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
