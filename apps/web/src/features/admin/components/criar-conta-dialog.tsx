// Formulário de criação de conta pelo admin (mesmo formulário do antigo cadastro público).
// A senha é definida aqui pelo admin e mostrada uma vez, para repassar à pessoa por fora do
// sistema — sem infraestrutura de e-mail real hoje, é o caminho mais simples e confiável.
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ATIVIDADES,
  CAMINHONEIRO_TRIBUTOS,
  criarContaAdminBody,
  email as emailSchema,
  hojeSP,
  isoDate,
  senha as senhaSchema,
} from '@meifin/shared';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormDateInput,
  FormInput,
  FormMaskedInput,
  FormRadioCards,
  FormRootError,
} from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { isValidCNPJ } from '@/lib/format/documento';
import {
  ATIVIDADE_DESCRICOES,
  ATIVIDADE_LABELS,
  CAMINHONEIRO_TRIBUTOS_LABELS,
  opcoesDe,
} from '@/lib/labels';

import { useCriarContaAdmin } from '../hooks';

const contaSchema = z
  .object({
    nome: z.string().trim().min(2, 'Informe o nome').max(120),
    email: emailSchema,
    senha: senhaSchema,
    cnpj: z
      .string()
      .optional()
      .refine((v) => !v || isValidCNPJ(v), 'CNPJ inválido'),
    atividade: z.enum(ATIVIDADES, { error: 'Escolha a atividade do MEI' }),
    caminhoneiroTributos: z.enum(CAMINHONEIRO_TRIBUTOS).optional(),
    dataAbertura: z
      .union([z.literal(''), isoDate])
      .optional()
      .refine((v) => !v || v <= hojeSP(), 'A data de abertura não pode ser futura'),
  })
  .refine((v) => v.atividade !== 'caminhoneiro' || v.caminhoneiroTributos !== undefined, {
    path: ['caminhoneiroTributos'],
    message: 'Informe quais tributos o caminhoneiro recolhe',
  });

type ContaForm = z.input<typeof contaSchema>;
type ContaValores = z.output<typeof contaSchema>;

const OPCOES_ATIVIDADE = ATIVIDADES.map((value) => ({
  value,
  label: ATIVIDADE_LABELS[value],
  descricao: ATIVIDADE_DESCRICOES[value],
}));
const OPCOES_TRIBUTOS = opcoesDe(CAMINHONEIRO_TRIBUTOS, CAMINHONEIRO_TRIBUTOS_LABELS);

function senhaAleatoria(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export interface CriarContaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-preenche a partir de um pedido de acesso e marca ele como aprovado ao criar. */
  prefill?: { solicitacaoId: string; nome: string; email: string; atividade?: string };
}

export function CriarContaDialog({ open, onOpenChange, prefill }: CriarContaDialogProps) {
  const criar = useCriarContaAdmin();
  const [senhaCriada, setSenhaCriada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const form = useForm<ContaForm, unknown, ContaValores>({
    resolver: zodResolver(contaSchema),
    defaultValues: {
      nome: prefill?.nome ?? '',
      email: prefill?.email ?? '',
      senha: '',
      cnpj: '',
      atividade: (prefill?.atividade as ContaForm['atividade']) ?? undefined,
      caminhoneiroTributos: undefined,
      dataAbertura: '',
    },
  });
  const atividade = useWatch({ control: form.control, name: 'atividade' });

  // Reseta o formulário (com uma nova senha sugerida) toda vez que o diálogo abre — evita que a
  // senha seja recalculada a cada render (o que travaria a digitação no campo). Ajustado durante
  // a própria renderização (padrão recomendado pelo React) em vez de um useEffect com setState
  // síncrono, que poderia disparar uma cascata de renders.
  // openAnterior começa sempre em `false` (não em `open`): o diálogo é remontado com uma `key`
  // diferente por pedido de acesso (ver admin-page.tsx), então às vezes já nasce com open=true —
  // se começasse igual a `open` a transição nunca seria detectada e a senha ficaria em branco.
  const [openAnterior, setOpenAnterior] = useState(false);
  if (open !== openAnterior) {
    setOpenAnterior(open);
    if (open) {
      form.reset({
        nome: prefill?.nome ?? '',
        email: prefill?.email ?? '',
        senha: senhaAleatoria(),
        cnpj: '',
        atividade: (prefill?.atividade as ContaForm['atividade']) ?? undefined,
        caminhoneiroTributos: undefined,
        dataAbertura: '',
      });
      setSenhaCriada(null);
      setCopiado(false);
    }
  }

  const fechar = (aberto: boolean) => {
    onOpenChange(aberto);
  };

  const onSubmit = (valores: ContaValores) => {
    const body = criarContaAdminBody.safeParse({
      nome: valores.nome,
      email: valores.email,
      senha: valores.senha,
      cnpj: valores.cnpj || undefined,
      atividade: valores.atividade,
      caminhoneiroTributos:
        valores.atividade === 'caminhoneiro' ? valores.caminhoneiroTributos : undefined,
      dataAbertura: valores.dataAbertura || undefined,
      solicitacaoId: prefill?.solicitacaoId,
    });
    if (!body.success) {
      form.setError('root.serverError', { message: 'Revise os dados informados.' });
      return;
    }
    criar.mutate(body.data, {
      onSuccess: () => setSenhaCriada(valores.senha),
      onError: (err) => aplicarErrosDoServidor(err, form.setError),
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={fechar}
      titulo={senhaCriada ? 'Conta criada' : 'Nova conta'}
      descricao={
        senhaCriada
          ? 'Copie a senha e repasse para a pessoa — ela não aparece de novo.'
          : 'Cria a conta de verdade. A senha abaixo é sugerida; pode trocar antes de salvar.'
      }
    >
      {senhaCriada ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-borda bg-zinc-50 px-3 py-2">
            <code className="text-sm">{senhaCriada}</code>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Copiar senha"
              onClick={() => {
                void navigator.clipboard.writeText(senhaCriada);
                setCopiado(true);
              }}
            >
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <Button className="w-full" onClick={() => fechar(false)}>
            Concluir
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormRootError errors={form.formState.errors} />
          <FormInput control={form.control} name="nome" label="Nome" autoComplete="off" />
          <FormInput
            control={form.control}
            name="email"
            label="E-mail"
            type="email"
            autoComplete="off"
          />
          <FormInput
            control={form.control}
            name="senha"
            label="Senha inicial"
            hint="Já vem preenchida com uma senha aleatória; pode editar."
          />
          <FormMaskedInput control={form.control} name="cnpj" mask="cnpj" label="CNPJ" opcional />
          <FormRadioCards
            control={form.control}
            name="atividade"
            label="Atividade do MEI"
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
          />
          <Button type="submit" className="w-full" size="lg" loading={criar.isPending}>
            Criar conta
          </Button>
        </form>
      )}
    </ResponsiveDialog>
  );
}
