// Diálogo de lançamento: criação (?novo=receita|despesa) e edição (?editar=<id>). Origem
// das/baixa: só descrição/observações ficam editáveis (o resto é bloqueado — ver service.atualizar
// da API). Recorrência (switch "Repetir todo mês") só aparece na criação.
import { zodResolver } from '@hookform/resolvers/zod';
import {
  atualizarLancamentoBody,
  criarLancamentoBody,
  FORMAS_PAGAMENTO,
  isoDate,
  STATUS_LANCAMENTO,
  textoNulavel,
  TIPOS_LANCAMENTO,
  uuid,
  type AtualizarLancamentoBody,
  type CriarLancamentoBody,
  type IsoDate,
  type LancamentoDto,
  type TipoLancamento,
} from '@meifin/shared';
import { Info } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import {
  FormCombobox,
  FormDateInput,
  FormInput,
  FormMoneyInput,
  FormRadioCards,
  FormRootError,
  FormSelect,
  FormSwitch,
  FormTextarea,
} from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { SkeletonText } from '@/components/ui/skeleton';
import { categoriasParaOpcoes, useCategorias, useContatosOpcoes } from '@/features/referencias';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { hojeSP } from '@/lib/format/date';
import { FORMA_PAGAMENTO_LABELS, opcoesDe } from '@/lib/labels';

import { useAtualizarLancamento, useCriarLancamento, useLancamento } from '../hooks';
import { origemRestrita } from '../utils';
import { AnexoCampo } from './anexo-campo';

const FORMA_PAGAMENTO_OPCOES = opcoesDe(FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABELS);
const STATUS_OPCOES = [
  { value: 'pago' as const, label: 'Pago', descricao: 'Já entrou/saiu do caixa' },
  { value: 'pendente' as const, label: 'Pendente', descricao: 'Ainda vai acontecer' },
];
const TIPO_OPCOES = [
  { value: 'receita' as const, label: 'Receita', descricao: 'Dinheiro que entra' },
  { value: 'despesa' as const, label: 'Despesa', descricao: 'Dinheiro que sai' },
];

const lancamentoFormSchema = z.object({
  tipo: z.enum(TIPOS_LANCAMENTO),
  descricao: z
    .string()
    .trim()
    .min(1, 'Informe a descrição')
    .max(160, 'Descrição deve ter no máximo 160 caracteres'),
  valor: z
    .number()
    .nullable()
    .refine((v): v is number => v !== null && v > 0, 'Informe o valor'),
  data: isoDate,
  categoriaId: uuid.or(z.literal('')).refine((v) => v !== '', 'Selecione a categoria'),
  contatoId: z.string().nullable(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).nullable(),
  status: z.enum(STATUS_LANCAMENTO),
  dataPagamento: isoDate.nullable(),
  observacoes: textoNulavel,
  repetir: z.boolean(),
  diaDoMes: z.coerce
    .number()
    .int('Dia inválido')
    .min(1, 'Dia deve ser entre 1 e 31')
    .max(31, 'Dia deve ser entre 1 e 31'),
  dataFimRecorrencia: isoDate.nullable(),
});
type LancamentoFormInput = z.input<typeof lancamentoFormSchema>;
type LancamentoFormValores = z.output<typeof lancamentoFormSchema>;

function diaDe(data: IsoDate): number {
  return Number(data.slice(8, 10));
}

function valoresIniciais(
  lancamento: LancamentoDto | undefined,
  tipoInicial: TipoLancamento,
  hoje: IsoDate,
): LancamentoFormInput {
  if (lancamento) {
    return {
      tipo: lancamento.tipo,
      descricao: lancamento.descricao,
      valor: lancamento.valor,
      data: lancamento.data,
      categoriaId: lancamento.categoriaId,
      contatoId: lancamento.contatoId,
      formaPagamento: lancamento.formaPagamento,
      status: lancamento.status,
      dataPagamento: lancamento.dataPagamento,
      observacoes: lancamento.observacoes,
      repetir: false,
      diaDoMes: diaDe(lancamento.data),
      dataFimRecorrencia: null,
    };
  }
  return {
    tipo: tipoInicial,
    descricao: '',
    valor: null,
    data: hoje,
    categoriaId: '',
    contatoId: null,
    formaPagamento: 'pix',
    status: 'pago',
    dataPagamento: hoje,
    observacoes: '',
    repetir: false,
    diaDoMes: diaDe(hoje),
    dataFimRecorrencia: null,
  };
}

function montarCriarBody(v: LancamentoFormValores): CriarLancamentoBody {
  return {
    tipo: v.tipo,
    data: v.data,
    valor: v.valor,
    descricao: v.descricao,
    categoriaId: v.categoriaId,
    contatoId: v.contatoId || null,
    formaPagamento: v.formaPagamento,
    status: v.status,
    dataPagamento: v.status === 'pago' ? (v.dataPagamento ?? v.data) : null,
    observacoes: v.observacoes ?? null,
    recorrencia: v.repetir
      ? { diaDoMes: v.diaDoMes, dataFim: v.dataFimRecorrencia ?? null }
      : undefined,
  };
}

function montarAtualizarBody(
  atual: LancamentoDto,
  v: LancamentoFormValores,
): AtualizarLancamentoBody {
  if (origemRestrita(atual)) {
    return { descricao: v.descricao, observacoes: v.observacoes ?? null };
  }
  return {
    tipo: v.tipo,
    data: v.data,
    valor: v.valor,
    descricao: v.descricao,
    categoriaId: v.categoriaId,
    contatoId: v.contatoId || null,
    formaPagamento: v.formaPagamento,
    status: v.status,
    dataPagamento: v.status === 'pago' ? (v.dataPagamento ?? v.data) : null,
    observacoes: v.observacoes ?? null,
  };
}

interface LancamentoFormProps {
  /** Presente = editando este lançamento; ausente = criando um novo. */
  lancamento?: LancamentoDto;
  tipoInicial: TipoLancamento;
  onClose: () => void;
}

function LancamentoForm({ lancamento, tipoInicial, onClose }: LancamentoFormProps) {
  const editando = Boolean(lancamento);
  const bloqueado = Boolean(lancamento && origemRestrita(lancamento));
  const criar = useCriarLancamento();
  const atualizar = useAtualizarLancamento(lancamento?.id ?? '');
  const salvando = criar.isPending || atualizar.isPending;

  const form = useForm<LancamentoFormInput, unknown, LancamentoFormValores>({
    resolver: zodResolver(lancamentoFormSchema),
    defaultValues: valoresIniciais(lancamento, tipoInicial, hojeSP()),
  });

  const [tipo, status, repetir, data] = useWatch({
    control: form.control,
    name: ['tipo', 'status', 'repetir', 'data'],
  });
  const categorias = useCategorias(tipo);
  const contatos = useContatosOpcoes();

  const tipoAnterior = useRef(tipo);
  useEffect(() => {
    if (tipoAnterior.current !== tipo) {
      form.setValue('categoriaId', '');
      tipoAnterior.current = tipo;
    }
  }, [tipo, form]);

  const onSubmit = (valores: LancamentoFormValores) => {
    if (lancamento) {
      const body = atualizarLancamentoBody.safeParse(montarAtualizarBody(lancamento, valores));
      if (!body.success) {
        form.setError('root.serverError', {
          message: body.error.issues[0]?.message ?? 'Dados inválidos',
        });
        return;
      }
      atualizar.mutate(body.data, {
        onSuccess: onClose,
        onError: (err) => aplicarErrosDoServidor(err, form.setError),
      });
      return;
    }
    const body = criarLancamentoBody.safeParse(montarCriarBody(valores));
    if (!body.success) {
      form.setError('root.serverError', {
        message: body.error.issues[0]?.message ?? 'Dados inválidos',
      });
      return;
    }
    criar.mutate(body.data, {
      onSuccess: onClose,
      onError: (err) => aplicarErrosDoServidor(err, form.setError),
    });
  };

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FormRootError errors={form.formState.errors} />

      {bloqueado ? (
        <p className="flex items-start gap-2 rounded-md border border-info-100 bg-info-50 px-3 py-2 text-sm text-info-700">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Este lançamento é controlado por outro módulo (
          {lancamento?.origem === 'das' ? 'pagamento de DAS' : 'baixa de parcela'}). Só a descrição
          e as observações podem ser alteradas aqui.
        </p>
      ) : null}

      <FormRadioCards
        control={form.control}
        name="tipo"
        label="Tipo"
        columns={2}
        options={TIPO_OPCOES}
        disabled={bloqueado}
      />
      <FormInput control={form.control} name="descricao" label="Descrição" autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormMoneyInput control={form.control} name="valor" label="Valor" disabled={bloqueado} />
        <FormDateInput control={form.control} name="data" label="Data" disabled={bloqueado} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormCombobox
          control={form.control}
          name="categoriaId"
          label="Categoria"
          options={categoriasParaOpcoes(categorias.data)}
          loading={categorias.isPending}
          placeholder="Selecione…"
          disabled={bloqueado}
        />
        <FormCombobox
          control={form.control}
          name="contatoId"
          label="Cliente/fornecedor"
          opcional
          options={contatos.opcoes}
          loading={contatos.isPending}
          placeholder="Selecione…"
          clearable
          disabled={bloqueado}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          control={form.control}
          name="formaPagamento"
          label="Forma de pagamento"
          opcional
          options={FORMA_PAGAMENTO_OPCOES}
          opcaoVazia="Não informar"
          disabled={bloqueado}
        />
        <FormRadioCards
          control={form.control}
          name="status"
          label="Status"
          columns={2}
          options={STATUS_OPCOES}
          disabled={bloqueado}
        />
      </div>
      {status === 'pago' ? (
        <FormDateInput
          control={form.control}
          name="dataPagamento"
          label="Data do pagamento"
          disabled={bloqueado}
        />
      ) : null}
      <FormTextarea
        control={form.control}
        name="observacoes"
        label="Observações"
        opcional
        rows={2}
      />

      {!editando ? (
        <div className="space-y-3 rounded-lg border border-borda p-3">
          <FormSwitch
            control={form.control}
            name="repetir"
            label="Repetir todo mês"
            descricao="Cria automaticamente um novo lançamento pendente nesse dia, todo mês."
          />
          {repetir ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                control={form.control}
                name="diaDoMes"
                label="Dia do mês"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
              />
              <FormDateInput
                control={form.control}
                name="dataFimRecorrencia"
                label="Repetir até"
                opcional
                min={data}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {lancamento ? <AnexoCampo lancamentoId={lancamento.id} anexo={lancamento.anexo} /> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" loading={salvando}>
          {editando ? 'Salvar alterações' : 'Salvar lançamento'}
        </Button>
      </div>
    </form>
  );
}

export interface LancamentoDialogProps {
  /** "receita" | "despesa" quando o parâmetro ?novo está presente; string vazia = fechado. */
  novo: string;
  /** Id do lançamento quando ?editar está presente; string vazia = fechado. */
  editar: string;
  onClose: () => void;
}

/** Controlado pela URL: `?novo=receita|despesa` (criação) ou `?editar=<id>` (edição). */
export function LancamentoDialog({ novo, editar, onClose }: LancamentoDialogProps) {
  const editando = Boolean(editar);
  const aberto = editando || Boolean(novo);
  const lancamentoQuery = useLancamento(editando ? editar : undefined);
  const tipoInicial: TipoLancamento = novo === 'despesa' ? 'despesa' : 'receita';

  const titulo = editando
    ? 'Editar lançamento'
    : tipoInicial === 'despesa'
      ? 'Nova despesa'
      : 'Nova receita';

  let conteudo: React.ReactNode;
  if (editando) {
    if (lancamentoQuery.isPending) {
      conteudo = <SkeletonText linhas={6} />;
    } else if (lancamentoQuery.isError || !lancamentoQuery.data) {
      conteudo = (
        <ErrorState error={lancamentoQuery.error} onRetry={() => void lancamentoQuery.refetch()} />
      );
    } else {
      conteudo = (
        <LancamentoForm
          key={lancamentoQuery.data.id}
          lancamento={lancamentoQuery.data}
          tipoInicial={lancamentoQuery.data.tipo}
          onClose={onClose}
        />
      );
    }
  } else {
    conteudo = (
      <LancamentoForm key={`novo-${tipoInicial}`} tipoInicial={tipoInicial} onClose={onClose} />
    );
  }

  return (
    <ResponsiveDialog
      open={aberto}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      titulo={titulo}
      tamanho="lg"
    >
      {conteudo}
    </ResponsiveDialog>
  );
}
