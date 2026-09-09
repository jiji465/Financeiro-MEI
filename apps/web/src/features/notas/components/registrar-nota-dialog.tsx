// "Registrar nota": tipo, número, série, data de emissão, cliente, valor, descrição, link
// externo e o toggle "Gerar receita" (cria o lançamento correspondente na categoria escolhida).
import { zodResolver } from '@hookform/resolvers/zod';
import {
  criarNotaFiscalBody,
  isoDate,
  textoNulavel,
  TIPOS_NOTA,
  type TipoNota,
} from '@meifin/shared';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormCombobox,
  FormDateInput,
  FormInput,
  FormMoneyInput,
  FormRootError,
  FormSelect,
  FormSwitch,
  FormTextarea,
} from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { categoriasParaOpcoes, useCategorias, useContatosOpcoes } from '@/features/referencias';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { hojeSP } from '@/lib/format/date';
import { opcoesDe, TIPO_NOTA_LABELS } from '@/lib/labels';

import { useCriarNota } from '../hooks';

const OPCOES_TIPO = opcoesDe(TIPOS_NOTA, TIPO_NOTA_LABELS);

const registrarNotaForm = z.object({
  tipo: z.enum(TIPOS_NOTA),
  numero: z.string().trim().min(1, 'Informe o número da nota').max(20, 'Máximo de 20 caracteres'),
  serie: z.string().trim().max(10).nullable(),
  dataEmissao: isoDate,
  contatoId: z.string().nullable(),
  valor: z
    .number()
    .nullable()
    .refine((v): v is number => v !== null && v > 0, 'Informe o valor'),
  descricao: textoNulavel,
  linkExterno: z.string().trim().max(500).nullable(),
  gerarReceita: z.boolean(),
  categoriaId: z.string().nullable(),
});
type RegistrarNotaForm = z.input<typeof registrarNotaForm>;
type RegistrarNotaValores = z.output<typeof registrarNotaForm>;

function montarBody(v: RegistrarNotaValores) {
  return {
    tipo: v.tipo,
    numero: v.numero,
    serie: v.serie?.trim() || null,
    dataEmissao: v.dataEmissao,
    contatoId: v.contatoId || null,
    valor: v.valor,
    descricao: v.descricao ?? null,
    linkExterno: v.linkExterno?.trim() || null,
    gerarReceita: v.gerarReceita,
    categoriaId: v.gerarReceita ? v.categoriaId || undefined : undefined,
  };
}

export interface RegistrarNotaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-seleciona o tipo (ex.: aba ativa da lista). */
  tipoPadrao?: TipoNota;
}

export function RegistrarNotaDialog({ open, onOpenChange, tipoPadrao }: RegistrarNotaDialogProps) {
  const criar = useCriarNota();
  const contatos = useContatosOpcoes('cliente');
  const categorias = useCategorias('receita');
  const hoje = hojeSP();

  const form = useForm<RegistrarNotaForm, unknown, RegistrarNotaValores>({
    resolver: zodResolver(registrarNotaForm),
    defaultValues: {
      tipo: tipoPadrao ?? 'nfse',
      numero: '',
      serie: null,
      dataEmissao: hoje,
      contatoId: null,
      valor: null,
      descricao: '',
      linkExterno: null,
      gerarReceita: false,
      categoriaId: null,
    },
  });
  const gerarReceita = useWatch({ control: form.control, name: 'gerarReceita' });

  const fechar = () => {
    onOpenChange(false);
    form.reset();
  };

  const onSubmit = (valores: RegistrarNotaValores) => {
    const body = criarNotaFiscalBody.safeParse(montarBody(valores));
    if (!body.success) {
      const issue = body.error.issues[0];
      form.setError('root.serverError', { message: issue?.message ?? 'Dados inválidos' });
      return;
    }
    criar.mutate(body.data, {
      onSuccess: fechar,
      onError: (err) => aplicarErrosDoServidor(err, form.setError),
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(aberto) => (aberto ? onOpenChange(true) : fechar())}
      titulo="Registrar nota"
      descricao="Registro manual da nota já emitida (não emite pela SEFAZ)."
      tamanho="lg"
      bloqueado={criar.isPending}
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormRootError errors={form.formState.errors} />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormSelect control={form.control} name="tipo" label="Tipo" options={OPCOES_TIPO} />
          <FormInput control={form.control} name="numero" label="Número" placeholder="Ex.: 1024" />
          <FormInput control={form.control} name="serie" label="Série" opcional placeholder="1" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormMoneyInput control={form.control} name="valor" label="Valor" />
          <FormDateInput control={form.control} name="dataEmissao" label="Data de emissão" />
        </div>
        <FormCombobox
          control={form.control}
          name="contatoId"
          label="Cliente"
          opcional
          options={contatos.opcoes}
          loading={contatos.isPending}
          placeholder="Selecione…"
          clearable
        />
        <FormTextarea control={form.control} name="descricao" label="Descrição" opcional rows={2} />
        <FormInput
          control={form.control}
          name="linkExterno"
          label="Link externo"
          opcional
          type="url"
          placeholder="https://…"
          hint="Link para o PDF/XML emitido em outro sistema (opcional)."
        />

        <div className="rounded-lg border border-borda p-3">
          <FormSwitch
            control={form.control}
            name="gerarReceita"
            label="Gerar receita"
            hint="Cria automaticamente um lançamento de receita com esta nota."
          />
          {gerarReceita ? (
            <div className="mt-3">
              <FormCombobox
                control={form.control}
                name="categoriaId"
                label="Categoria da receita"
                options={categoriasParaOpcoes(categorias.data)}
                loading={categorias.isPending}
                placeholder="Selecione…"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={fechar} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={criar.isPending}>
            Registrar nota
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
