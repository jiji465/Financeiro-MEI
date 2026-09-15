// Cadastro deixou de ser self-service (seção 11 do plano): este formulário só registra um pedido
// de acesso. Quem cria a conta de verdade é o admin, pelo painel, depois de entrar em contato.
import { zodResolver } from '@hookform/resolvers/zod';
import { ATIVIDADES, criarSolicitacaoBody, email as emailSchema } from '@meifin/shared';
import { Check, CheckCircle2 } from 'lucide-react';
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

// Quem chega aqui vindo da página de vendas perde todo o contexto se encontrar só campos.
// Estes três itens repetem — curtos — o que a conta entrega, e só afirmam o que o produto faz.
const REFORCO = [
  'Conta configurada com a atividade e os tributos do seu MEI',
  'DAS, limite anual e contas a vencer já montados pra você',
  'Relatórios em PDF, CSV e XLSX quando o contador pedir',
];

function ReforcoDeValor() {
  return (
    <ul className="mt-5 space-y-2 rounded-lg border border-borda bg-fundo p-4">
      {REFORCO.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-600">
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-receita-100 text-receita-700">
            <Check className="size-2.5" aria-hidden="true" />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

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
        <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">Pedido recebido</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Obrigado! Entramos em contato pelo e-mail que você informou para confirmar os dados do seu
          MEI e liberar a conta já configurada.
        </p>
        <p className="mt-3 text-sm text-zinc-500">
          Enquanto isso, separe o número do seu CNPJ e o mês em que o MEI foi aberto — é só isso que
          vamos precisar.
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
      <h1 className="font-display text-2xl font-semibold tracking-tight">Solicitar acesso</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Leva menos de um minuto. Não é um cadastro automático: a gente conversa rápido com você e
        entrega a conta já pronta pro seu MEI.
      </p>

      <ReforcoDeValor />

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
        <p className="text-center text-xs text-zinc-500">
          Depois de enviar, o próximo passo é nosso: respondemos pelo e-mail ou telefone que você
          informou.
        </p>
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
