// Edição de um lançamento repetido (recorrência).
//
// Só edita: a criação acontece no diálogo de lançamento, marcando "Repetir todo mês". Aqui o
// dono ajusta o que mudou — valor do aluguel que subiu, dia do vencimento, até quando repetir.
//
// IMPORTANTE: mudar isto NÃO altera os meses já gerados. A API não retroage em nenhum campo, e
// o texto da tela diz isso — senão o dono acha que corrigiu o histórico e não corrigiu.
import { zodResolver } from '@hookform/resolvers/zod';
import { isoDate, type RecorrenciaDto } from '@meifin/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormCombobox,
  FormDateInput,
  FormInput,
  FormMoneyInput,
  FormRootError,
  FormSelect,
} from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import {
  categoriasParaOpcoes,
  useCategorias,
  useContasBancariasOpcoes,
  useContatosOpcoes,
} from '@/features/referencias';
import { aplicarErrosDoServidor } from '@/lib/api/errors';

import { useAtualizarRecorrencia } from '../hooks';

const DIAS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: `Dia ${i + 1}`,
}));

const repeticaoSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, 'Informe a descrição')
    .max(160, 'Descrição deve ter no máximo 160 caracteres'),
  valor: z
    .number({ error: 'Informe o valor' })
    .nullable()
    .refine((v): v is number => v !== null && v > 0, 'Informe o valor'),
  categoriaId: z.string().min(1, 'Escolha a categoria'),
  contatoId: z.string().nullable(),
  contaBancariaId: z.string().nullable(),
  diaDoMes: z.string(),
  dataFim: z.union([isoDate, z.literal('')]),
});

type RepeticaoFormInput = z.input<typeof repeticaoSchema>;
type RepeticaoFormValores = z.output<typeof repeticaoSchema>;

function valoresDe(r: RecorrenciaDto): RepeticaoFormInput {
  return {
    descricao: r.descricao,
    valor: r.valor,
    categoriaId: r.categoriaId,
    contatoId: r.contatoId,
    contaBancariaId: r.contaBancariaId,
    diaDoMes: String(r.diaDoMes),
    dataFim: r.dataFim ?? '',
  };
}

export interface RepeticaoDialogProps {
  repeticao: RecorrenciaDto | null;
  onOpenChange: (open: boolean) => void;
}

export function RepeticaoDialog({ repeticao, onOpenChange }: RepeticaoDialogProps) {
  const atualizar = useAtualizarRecorrencia(repeticao?.id ?? '');
  const categorias = useCategorias(repeticao?.tipo);
  const contatos = useContatosOpcoes(repeticao?.tipo === 'receita' ? 'cliente' : 'fornecedor');
  const contasBancarias = useContasBancariasOpcoes();

  const form = useForm<RepeticaoFormInput, unknown, RepeticaoFormValores>({
    resolver: zodResolver(repeticaoSchema),
    defaultValues: repeticao ? valoresDe(repeticao) : undefined,
  });

  useEffect(() => {
    if (repeticao) form.reset(valoresDe(repeticao));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeticao?.id, repeticao?.updatedAt]);

  const onSubmit = (v: RepeticaoFormValores) => {
    atualizar.mutate(
      {
        descricao: v.descricao,
        valor: v.valor,
        categoriaId: v.categoriaId,
        contatoId: v.contatoId || null,
        contaBancariaId: v.contaBancariaId || null,
        diaDoMes: Number(v.diaDoMes),
        dataFim: v.dataFim || null,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => aplicarErrosDoServidor(err, form.setError),
      },
    );
  };

  return (
    <ResponsiveDialog
      open={repeticao !== null}
      onOpenChange={onOpenChange}
      titulo="Editar repetição"
      descricao="Vale a partir do próximo mês: os lançamentos já gerados não mudam."
      bloqueado={atualizar.isPending}
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormRootError errors={form.formState.errors} />

        <FormInput control={form.control} name="descricao" label="Descrição" />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormMoneyInput control={form.control} name="valor" label="Valor" />
          <FormSelect
            control={form.control}
            name="diaDoMes"
            label="Repetir no dia"
            hint="Em meses mais curtos, cai no último dia."
            options={DIAS}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormCombobox
            control={form.control}
            name="categoriaId"
            label="Categoria"
            options={categoriasParaOpcoes(categorias.data)}
            loading={categorias.isPending}
            placeholder="Selecione…"
          />
          <FormCombobox
            control={form.control}
            name="contatoId"
            label={repeticao?.tipo === 'receita' ? 'Cliente' : 'Fornecedor'}
            opcional
            options={contatos.opcoes}
            loading={contatos.isPending}
            placeholder="Selecione…"
            clearable
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormCombobox
            control={form.control}
            name="contaBancariaId"
            label={
              repeticao?.tipo === 'receita'
                ? 'Conta onde o dinheiro cai'
                : 'Conta de onde o dinheiro sai'
            }
            opcional
            options={contasBancarias.opcoes}
            loading={contasBancarias.isPending}
            placeholder="Selecione…"
            clearable
          />
          <FormDateInput
            control={form.control}
            name="dataFim"
            label="Repetir até"
            opcional
            hint="Vazio = sem data para acabar."
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={atualizar.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={atualizar.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
