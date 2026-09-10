// Cria outro administrador puro direto pelo painel — sem MEI, sem terminal (seção 13 do plano).
import { zodResolver } from '@hookform/resolvers/zod';
import { criarAdministradorBody, email as emailSchema, senha as senhaSchema } from '@meifin/shared';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormInput, FormRootError } from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { aplicarErrosDoServidor } from '@/lib/api/errors';

import { useCriarAdministrador } from '../hooks';

const schema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome').max(120),
  email: emailSchema,
  senha: senhaSchema,
});

type Form = z.input<typeof schema>;
type Valores = z.output<typeof schema>;

function senhaAleatoria(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export interface CriarAdministradorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CriarAdministradorDialog({ open, onOpenChange }: CriarAdministradorDialogProps) {
  const criar = useCriarAdministrador();
  const [senhaCriada, setSenhaCriada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const form = useForm<Form, unknown, Valores>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', email: '', senha: senhaAleatoria() },
  });

  const [openAnterior, setOpenAnterior] = useState(false);
  if (open !== openAnterior) {
    setOpenAnterior(open);
    if (open) {
      form.reset({ nome: '', email: '', senha: senhaAleatoria() });
      setSenhaCriada(null);
      setCopiado(false);
    }
  }

  const fechar = (aberto: boolean) => onOpenChange(aberto);

  const onSubmit = (valores: Valores) => {
    const body = criarAdministradorBody.safeParse(valores);
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
      titulo={senhaCriada ? 'Administrador criado' : 'Novo administrador'}
      descricao={
        senhaCriada
          ? 'Copie a senha e repasse para a pessoa — ela não aparece de novo.'
          : 'Sem MEI, sem lançamentos — só acesso ao painel de administração. A senha abaixo é sugerida; pode trocar antes de salvar.'
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
          <Button type="submit" className="w-full" size="lg" loading={criar.isPending}>
            Criar administrador
          </Button>
        </form>
      )}
    </ResponsiveDialog>
  );
}
