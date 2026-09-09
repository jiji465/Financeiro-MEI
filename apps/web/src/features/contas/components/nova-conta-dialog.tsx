// "Nova conta a pagar/receber": descrição, contato, categoria, valor total, emissão e parcelamento
// (n parcelas mensais com prévia "12x de R$ …" ou lista manual de vencimentos/valores).
import { zodResolver } from '@hookform/resolvers/zod';
import {
  centavosPositivo,
  criarTituloBody,
  type CriarTituloBody,
  isoDate,
  PARCELAS_MAX,
  textoNulavel,
  type TipoTitulo,
  uuid,
} from '@meifin/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormCombobox,
  FormDateInput,
  FormInput,
  FormMoneyInput,
  FormRadioCards,
  FormRootError,
  FormTextarea,
} from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { categoriasParaOpcoes, useCategorias, useContatosOpcoes } from '@/features/referencias';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { addMonthsClamp, hojeSP } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';

import { useCriarTitulo } from '../hooks';
import { descreverParcelamento, TEXTOS_POR_TIPO } from '../utils';

const MODOS = ['quantidade', 'lista'] as const;

/**
 * Schema do formulário (entrada do usuário); o corpo final é validado com criarTituloBody.
 * `lista` só é obrigatória quando `modo === 'lista'` — o superRefine valida condicionalmente
 * porque os dois modos coexistem no mesmo formulário (RHF valida todos os campos registrados,
 * mesmo os do modo inativo/oculto).
 */
const novaContaForm = z
  .object({
    descricao: z.string().trim().min(1, 'Informe a descrição').max(160, 'Máximo de 160 caracteres'),
    contatoId: z.string().nullable(),
    categoriaId: uuid.or(z.literal('')).refine((v) => v !== '', 'Selecione a categoria'),
    valorTotal: z
      .number()
      .nullable()
      .refine((v): v is number => v !== null && v > 0, 'Informe o valor'),
    dataEmissao: isoDate,
    observacoes: textoNulavel,
    modo: z.enum(MODOS),
    quantidade: z.coerce
      .number()
      .int('Quantidade inválida')
      .min(1, 'Mínimo de 1 parcela')
      .max(PARCELAS_MAX, `Máximo de ${PARCELAS_MAX} parcelas`),
    primeiroVencimento: isoDate,
    lista: z.array(
      z.object({
        vencimento: isoDate,
        valor: z.number().nullable(),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.modo !== 'lista') return;
    v.lista.forEach((p, i) => {
      if (p.valor === null || p.valor <= 0) {
        ctx.addIssue({ code: 'custom', path: ['lista', i, 'valor'], message: 'Informe o valor' });
      }
    });
  });
type NovaContaForm = z.input<typeof novaContaForm>;
type NovaContaValores = z.output<typeof novaContaForm>;

function montarBody(tipo: TipoTitulo, v: NovaContaValores): CriarTituloBody {
  const parcelas =
    v.modo === 'lista'
      ? {
          lista: v.lista.map((p) => ({
            vencimento: p.vencimento,
            valor: centavosPositivo.parse(p.valor),
          })),
        }
      : { quantidade: v.quantidade, primeiroVencimento: v.primeiroVencimento };
  return {
    tipo,
    descricao: v.descricao,
    contatoId: v.contatoId || null,
    categoriaId: v.categoriaId,
    valorTotal: v.valorTotal,
    dataEmissao: v.dataEmissao,
    observacoes: v.observacoes ?? null,
    parcelas,
  };
}

export interface NovaContaDialogProps {
  tipo: TipoTitulo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaContaDialog({ tipo, open, onOpenChange }: NovaContaDialogProps) {
  const textos = TEXTOS_POR_TIPO[tipo];
  const criar = useCriarTitulo();
  const categorias = useCategorias(tipo === 'pagar' ? 'despesa' : 'receita');
  const contatos = useContatosOpcoes();
  const hoje = hojeSP();

  const form = useForm<NovaContaForm, unknown, NovaContaValores>({
    resolver: zodResolver(novaContaForm),
    defaultValues: {
      descricao: '',
      contatoId: null,
      categoriaId: '',
      valorTotal: null,
      dataEmissao: hoje,
      observacoes: '',
      modo: 'quantidade',
      quantidade: 1,
      primeiroVencimento: addMonthsClamp(hoje, 1),
      lista: [{ vencimento: addMonthsClamp(hoje, 1), valor: null }],
    },
  });
  const lista = useFieldArray({ control: form.control, name: 'lista' });
  const [modo, valorTotal, quantidade, primeiroVencimento, itens] = useWatch({
    control: form.control,
    name: ['modo', 'valorTotal', 'quantidade', 'primeiroVencimento', 'lista'],
  });

  const previa = descreverParcelamento(valorTotal, Number(quantidade), primeiroVencimento);
  const somaLista = (itens ?? []).reduce((acc, p) => acc + (p?.valor ?? 0), 0);
  const diferenca = (valorTotal ?? 0) - somaLista;

  const fechar = () => {
    onOpenChange(false);
    form.reset();
  };

  const onSubmit = (valores: NovaContaValores) => {
    const body = criarTituloBody.safeParse(montarBody(tipo, valores));
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

  const adicionarParcela = () => {
    const ultima = itens?.[itens.length - 1];
    lista.append({
      vencimento: ultima?.vencimento
        ? addMonthsClamp(ultima.vencimento, 1)
        : addMonthsClamp(hoje, 1),
      valor: diferenca > 0 ? diferenca : null,
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(aberto) => (aberto ? onOpenChange(true) : fechar())}
      titulo={textos.novo}
      descricao="O valor total é dividido em parcelas; cada parcela vira um lançamento ao ser baixada."
      tamanho="lg"
      bloqueado={criar.isPending}
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormRootError errors={form.formState.errors} />
        <FormInput
          control={form.control}
          name="descricao"
          label="Descrição"
          placeholder={tipo === 'pagar' ? 'Ex.: Aluguel da loja' : 'Ex.: Projeto site cliente X'}
          autoFocus
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormCombobox
            control={form.control}
            name="contatoId"
            label={textos.contatoLabel}
            opcional
            options={contatos.opcoes}
            loading={contatos.isPending}
            placeholder="Selecione…"
            clearable
          />
          <FormCombobox
            control={form.control}
            name="categoriaId"
            label="Categoria"
            options={categoriasParaOpcoes(categorias.data)}
            loading={categorias.isPending}
            placeholder="Selecione…"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormMoneyInput control={form.control} name="valorTotal" label="Valor total" />
          <FormDateInput control={form.control} name="dataEmissao" label="Data de emissão" />
        </div>

        <FormRadioCards
          control={form.control}
          name="modo"
          label="Parcelamento"
          columns={2}
          options={[
            {
              value: 'quantidade',
              label: 'Parcelas mensais',
              descricao: 'Divide o total em N parcelas iguais.',
            },
            {
              value: 'lista',
              label: 'Lista manual',
              descricao: 'Você informa cada vencimento e valor.',
            },
          ]}
        />

        {modo === 'lista' ? (
          <fieldset className="space-y-3 rounded-lg border border-borda p-3">
            <legend className="px-1 text-sm font-medium">Parcelas</legend>
            {lista.fields.map((campo, i) => (
              <div key={campo.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <FormDateInput
                  control={form.control}
                  name={`lista.${i}.vencimento`}
                  label={i === 0 ? 'Vencimento' : undefined}
                  aria-label={`Vencimento da parcela ${i + 1}`}
                />
                <FormMoneyInput
                  control={form.control}
                  name={`lista.${i}.valor`}
                  label={i === 0 ? 'Valor' : undefined}
                  aria-label={`Valor da parcela ${i + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover parcela ${i + 1}`}
                  onClick={() => lista.remove(i)}
                  disabled={lista.fields.length === 1}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus aria-hidden="true" />}
                onClick={adicionarParcela}
                disabled={lista.fields.length >= PARCELAS_MAX}
              >
                Adicionar parcela
              </Button>
              <p
                className={diferenca === 0 ? 'text-sm text-receita-700' : 'text-sm text-alerta-700'}
                aria-live="polite"
              >
                Soma: {formatBRL(somaLista)}
                {diferenca !== 0 && valorTotal ? ` · faltam ${formatBRL(diferenca)}` : ''}
              </p>
            </div>
          </fieldset>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              control={form.control}
              name="quantidade"
              label="Quantidade de parcelas"
              type="number"
              inputMode="numeric"
              min={1}
              max={PARCELAS_MAX}
            />
            <FormDateInput
              control={form.control}
              name="primeiroVencimento"
              label="Primeiro vencimento"
            />
            {previa ? (
              <p
                className="text-sm text-zinc-600 sm:col-span-2"
                aria-live="polite"
                data-testid="previa-parcelamento"
              >
                {previa}
              </p>
            ) : null}
          </div>
        )}

        <FormTextarea
          control={form.control}
          name="observacoes"
          label="Observações"
          opcional
          rows={2}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={fechar} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={criar.isPending}>
            Salvar conta
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
