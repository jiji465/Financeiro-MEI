// /relatorios/importar — assistente de importação de CSV: envio do arquivo → mapeamento das
// colunas → pré-visualização (com dedupe por hash) → confirmação. O cabeçalho é lido no navegador
// (parseCsvBrasileiro, sem round-trip à API) para popular os seletores de coluna do mapeamento.
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FORMAS_PAGAMENTO,
  MODOS_TIPO_IMPORTACAO,
  parseCsvBrasileiro,
  STATUS_LANCAMENTO,
  TIPOS_LANCAMENTO,
  mapeamentoCsv,
  type ConfirmarImportacaoBody,
  type LinhaImportacaoDto,
  type MapeamentoCsv,
  type ModoTipoImportacao,
  type PreviewImportacaoDto,
  type TipoLancamento,
} from '@meifin/shared';
import { CheckCircle2, CircleAlert, FileUp, RotateCcw, Undo2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import {
  FormCombobox,
  FormRadioCards,
  FormRootError,
  FormSelect,
  FormSwitch,
} from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/ui/stat-card';
import { Switch } from '@/components/ui/switch';
import { categoriasParaOpcoes, useCategorias } from '@/features/referencias';
import { getErrorMessage } from '@/lib/api/errors';
import { formatData } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';
import { FORMA_PAGAMENTO_LABELS, opcoesDe, TIPO_LANCAMENTO_LABELS } from '@/lib/labels';

import { useConfirmarImportacao, useDesfazerImportacao, usePreviewImportacao } from '../hooks';

type Etapa = 'upload' | 'mapear' | 'pre-visualizar' | 'concluido';

const ETAPAS: { id: Etapa; label: string }[] = [
  { id: 'upload', label: 'Arquivo' },
  { id: 'mapear', label: 'Mapeamento' },
  { id: 'pre-visualizar', label: 'Conferência' },
  { id: 'concluido', label: 'Concluído' },
];

const FORMA_PAGAMENTO_OPCOES = opcoesDe(FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABELS);
const STATUS_OPCOES = [
  { value: 'pago' as const, label: 'Pago' },
  { value: 'pendente' as const, label: 'Pendente' },
];
const TIPO_OPCOES = [
  { value: 'receita' as const, label: 'Receita' },
  { value: 'despesa' as const, label: 'Despesa' },
];
const MODO_TIPO_OPCOES = [
  {
    value: 'sinal' as const,
    label: 'Pelo sinal do valor',
    descricao: 'Negativo é despesa, positivo é receita',
  },
  {
    value: 'coluna' as const,
    label: 'Por uma coluna',
    descricao: 'Uma coluna diz o tipo (receita/despesa, C/D…)',
  },
  {
    value: 'fixo' as const,
    label: 'Sempre o mesmo tipo',
    descricao: 'Todo o arquivo é só receita ou só despesa',
  },
];

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Sugere a coluna do cabeçalho cujo nome mais se parece com um dos candidatos (heurística simples). */
function sugerirColuna(cabecalho: string[], candidatos: string[]): string {
  const normalizados = cabecalho.map((h) => ({ original: h, norm: normalizar(h) }));
  for (const candidato of candidatos) {
    const exata = normalizados.find((h) => h.norm === candidato);
    if (exata) return exata.original;
  }
  for (const candidato of candidatos) {
    const parcial = normalizados.find((h) => h.norm.includes(candidato));
    if (parcial) return parcial.original;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Etapa 1: upload
// ---------------------------------------------------------------------------

function EtapaUpload({
  onArquivo,
}: {
  onArquivo: (arquivo: File, cabecalho: string[], totalLinhas: number) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);

  const selecionar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro(null);
    setLendo(true);
    try {
      const texto = await arquivo.text();
      const resultado = parseCsvBrasileiro(texto);
      if (resultado.cabecalho.length === 0) {
        setErro(
          'Não encontramos um cabeçalho válido nesse arquivo. Confira se é um CSV com a primeira linha de títulos.',
        );
        return;
      }
      onArquivo(arquivo, resultado.cabecalho, resultado.linhas.length);
    } catch {
      setErro('Não foi possível ler esse arquivo. Confira se é um .csv válido.');
    } finally {
      setLendo(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-borda bg-superficie px-4 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        <FileUp aria-hidden="true" className="size-7" />
      </span>
      <div>
        <h2 className="text-base font-semibold">Envie o extrato ou planilha em CSV</h2>
        <p className="mt-1 max-w-md text-sm text-zinc-500">
          Exportado do seu banco, cartão ou de outro sistema. A primeira linha deve ter os nomes das
          colunas (data, valor, descrição…).
        </p>
      </div>
      <Button asChild loading={lendo} icon={<Upload aria-hidden="true" />}>
        <label>
          Escolher arquivo
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void selecionar(e)}
          />
        </label>
      </Button>
      {erro ? <p className="text-sm font-medium text-perigo-700">{erro}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 2: mapeamento
// ---------------------------------------------------------------------------

const mapeamentoFormSchema = z.object({
  data: z.string().min(1, 'Selecione a coluna'),
  valor: z.string().min(1, 'Selecione a coluna'),
  descricao: z.string().min(1, 'Selecione a coluna'),
  tipo: z.string(),
  modoTipo: z.enum(MODOS_TIPO_IMPORTACAO),
  tipoFixo: z.enum(TIPOS_LANCAMENTO).or(z.literal('')),
  categoria: z.string(),
  contato: z.string(),
  formaPagamento: z.string(),
  observacoes: z.string(),
  categoriaPadraoReceitaId: z.string().nullable(),
  categoriaPadraoDespesaId: z.string().nullable(),
  statusPadrao: z.enum(STATUS_LANCAMENTO),
  formaPagamentoPadrao: z.enum(FORMAS_PAGAMENTO).or(z.literal('')),
  inverterSinal: z.boolean(),
});
type MapeamentoFormValores = z.infer<typeof mapeamentoFormSchema>;

function valoresIniciaisMapeamento(cabecalho: string[]): MapeamentoFormValores {
  return {
    data: sugerirColuna(cabecalho, ['data', 'date', 'dt']),
    valor: sugerirColuna(cabecalho, ['valor', 'vlr', 'amount', 'value']),
    descricao: sugerirColuna(cabecalho, [
      'descricao',
      'historico',
      'description',
      'memo',
      'lancamento',
    ]),
    tipo: sugerirColuna(cabecalho, ['tipo', 'type', 'natureza']),
    modoTipo: 'sinal',
    tipoFixo: '',
    categoria: sugerirColuna(cabecalho, ['categoria', 'category']),
    contato: sugerirColuna(cabecalho, ['contato', 'cliente', 'fornecedor', 'favorecido']),
    formaPagamento: sugerirColuna(cabecalho, ['forma', 'pagamento', 'meio']),
    observacoes: sugerirColuna(cabecalho, ['obs', 'observacao', 'observacoes']),
    categoriaPadraoReceitaId: null,
    categoriaPadraoDespesaId: null,
    statusPadrao: 'pago',
    formaPagamentoPadrao: '',
    inverterSinal: false,
  };
}

function montarMapeamento(v: MapeamentoFormValores): unknown {
  return {
    data: v.data,
    valor: v.valor,
    descricao: v.descricao,
    tipo: v.tipo || undefined,
    modoTipo: v.modoTipo,
    tipoFixo: v.tipoFixo || undefined,
    categoria: v.categoria || undefined,
    contato: v.contato || undefined,
    formaPagamento: v.formaPagamento || undefined,
    observacoes: v.observacoes || undefined,
    categoriaPadraoReceitaId: v.categoriaPadraoReceitaId || undefined,
    categoriaPadraoDespesaId: v.categoriaPadraoDespesaId || undefined,
    statusPadrao: v.statusPadrao,
    formaPagamentoPadrao: v.formaPagamentoPadrao || undefined,
    inverterSinal: v.inverterSinal,
  };
}

function EtapaMapeamento({
  arquivo,
  cabecalho,
  mapeamentoAnterior,
  onVoltar,
  onAvancar,
}: {
  arquivo: File;
  cabecalho: string[];
  mapeamentoAnterior: MapeamentoCsv | null;
  onVoltar: () => void;
  onAvancar: (preview: PreviewImportacaoDto, mapeamento: MapeamentoCsv) => void;
}) {
  const preview = usePreviewImportacao();
  const categoriasReceita = useCategorias('receita');
  const categoriasDespesa = useCategorias('despesa');
  const opcoesColuna = [
    { value: '', label: 'Não mapear' },
    ...cabecalho.map((h) => ({ value: h, label: h })),
  ];

  const form = useForm<MapeamentoFormValores>({
    resolver: zodResolver(mapeamentoFormSchema),
    defaultValues: mapeamentoAnterior
      ? {
          data: mapeamentoAnterior.data,
          valor: mapeamentoAnterior.valor,
          descricao: mapeamentoAnterior.descricao,
          tipo: mapeamentoAnterior.tipo ?? '',
          modoTipo: mapeamentoAnterior.modoTipo,
          tipoFixo: mapeamentoAnterior.tipoFixo ?? '',
          categoria: mapeamentoAnterior.categoria ?? '',
          contato: mapeamentoAnterior.contato ?? '',
          formaPagamento: mapeamentoAnterior.formaPagamento ?? '',
          observacoes: mapeamentoAnterior.observacoes ?? '',
          categoriaPadraoReceitaId: mapeamentoAnterior.categoriaPadraoReceitaId ?? null,
          categoriaPadraoDespesaId: mapeamentoAnterior.categoriaPadraoDespesaId ?? null,
          statusPadrao: mapeamentoAnterior.statusPadrao,
          formaPagamentoPadrao: mapeamentoAnterior.formaPagamentoPadrao ?? '',
          inverterSinal: mapeamentoAnterior.inverterSinal,
        }
      : valoresIniciaisMapeamento(cabecalho),
  });
  const modoTipo = useWatch({ control: form.control, name: 'modoTipo' }) as ModoTipoImportacao;

  const onSubmit = async (valores: MapeamentoFormValores) => {
    const resultado = mapeamentoCsv.safeParse(montarMapeamento(valores));
    if (!resultado.success) {
      form.setError('root.serverError', {
        message: resultado.error.issues[0]?.message ?? 'Revise o mapeamento das colunas',
      });
      return;
    }
    try {
      const res = await preview.mutateAsync({ arquivo, mapeamento: resultado.data });
      onAvancar(res.data, resultado.data);
    } catch (err) {
      form.setError('root.serverError', { message: getErrorMessage(err) });
    }
  };

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FormRootError errors={form.formState.errors} />
      <p className="text-sm text-zinc-500">
        Arquivo <span className="font-medium text-texto">{arquivo.name}</span> — diga qual coluna do
        CSV corresponde a cada campo do lançamento.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormSelect
          control={form.control}
          name="data"
          label="Coluna da data"
          options={opcoesColuna.filter((o) => o.value)}
          placeholder="Selecione…"
        />
        <FormSelect
          control={form.control}
          name="valor"
          label="Coluna do valor"
          options={opcoesColuna.filter((o) => o.value)}
          placeholder="Selecione…"
        />
        <FormSelect
          control={form.control}
          name="descricao"
          label="Coluna da descrição"
          options={opcoesColuna.filter((o) => o.value)}
          placeholder="Selecione…"
        />
      </div>

      <FormRadioCards
        control={form.control}
        name="modoTipo"
        label="Como identificar receita ou despesa"
        columns={3}
        options={MODO_TIPO_OPCOES}
      />
      {modoTipo === 'coluna' ? (
        <FormSelect
          control={form.control}
          name="tipo"
          label="Coluna do tipo"
          options={opcoesColuna}
          opcaoVazia="Não mapear"
          placeholder="Selecione…"
        />
      ) : null}
      {modoTipo === 'fixo' ? (
        <FormRadioCards
          control={form.control}
          name="tipoFixo"
          label="Tipo fixo para todas as linhas"
          columns={2}
          options={TIPO_OPCOES}
        />
      ) : null}
      {modoTipo === 'sinal' ? (
        <FormSwitch
          control={form.control}
          name="inverterSinal"
          label="Inverter o sinal"
          descricao="Use quando o extrato traz despesas como valores positivos (comum em faturas de cartão)."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          control={form.control}
          name="categoria"
          label="Coluna da categoria"
          opcional
          options={opcoesColuna}
          opcaoVazia="Não mapear"
          placeholder="Selecione…"
          hint="Casada pelo nome; o que não bater usa a categoria padrão abaixo."
        />
        <FormSelect
          control={form.control}
          name="contato"
          label="Coluna do contato"
          opcional
          options={opcoesColuna}
          opcaoVazia="Não mapear"
          placeholder="Selecione…"
          hint="Casado pelo nome; não cria contatos novos."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormCombobox
          control={form.control}
          name="categoriaPadraoReceitaId"
          label="Categoria padrão (receitas)"
          opcional
          clearable
          options={categoriasParaOpcoes(categoriasReceita.data)}
          loading={categoriasReceita.isPending}
          placeholder="Nenhuma"
        />
        <FormCombobox
          control={form.control}
          name="categoriaPadraoDespesaId"
          label="Categoria padrão (despesas)"
          opcional
          clearable
          options={categoriasParaOpcoes(categoriasDespesa.data)}
          loading={categoriasDespesa.isPending}
          placeholder="Nenhuma"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          control={form.control}
          name="formaPagamento"
          label="Coluna da forma de pagamento"
          opcional
          options={opcoesColuna}
          opcaoVazia="Não mapear"
          placeholder="Selecione…"
        />
        <FormSelect
          control={form.control}
          name="observacoes"
          label="Coluna de observações"
          opcional
          options={opcoesColuna}
          opcaoVazia="Não mapear"
          placeholder="Selecione…"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          control={form.control}
          name="formaPagamentoPadrao"
          label="Forma de pagamento padrão"
          opcional
          options={FORMA_PAGAMENTO_OPCOES}
          opcaoVazia="Nenhuma"
          placeholder="Selecione…"
          hint="Usada quando a coluna de forma de pagamento não identifica nenhuma."
        />
        <FormRadioCards
          control={form.control}
          name="statusPadrao"
          label="Status dos lançamentos"
          columns={2}
          options={STATUS_OPCOES}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onVoltar} disabled={preview.isPending}>
          Voltar
        </Button>
        <Button type="submit" loading={preview.isPending}>
          Pré-visualizar
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Etapa 3: pré-visualização
// ---------------------------------------------------------------------------

const LIMITE_EXIBICAO = 300;

function situacaoDaLinha(l: LinhaImportacaoDto): {
  texto: string;
  tone: 'receita' | 'despesa' | 'alerta';
} {
  if (l.erro) return { texto: l.erro, tone: 'despesa' };
  if (l.duplicada) return { texto: 'Já importado', tone: 'alerta' };
  if (!l.categoriaId) return { texto: 'Sem categoria', tone: 'alerta' };
  return { texto: 'Pronta', tone: 'receita' };
}

function EtapaPreVisualizacao({
  arquivo,
  preview,
  mapeamento,
  onVoltar,
  onConcluir,
}: {
  arquivo: File;
  preview: PreviewImportacaoDto;
  mapeamento: MapeamentoCsv;
  onVoltar: () => void;
  onConcluir: (
    importacaoId: string,
    resumo: { importadas: number; ignoradas: number; duplicadas: number },
  ) => void;
}) {
  const confirmar = useConfirmarImportacao();
  const [ignorarDuplicadas, setIgnorarDuplicadas] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const prontas = preview.linhas.filter((l) => !l.erro && l.categoriaId);
  const semCategoria = preview.linhas.filter((l) => !l.erro && !l.categoriaId).length;

  const colunas: DataTableColumn<LinhaImportacaoDto>[] = [
    { id: 'numero', header: '#', cell: (l) => <span className="text-zinc-400">{l.numero}</span> },
    { id: 'data', header: 'Data', cell: (l) => (l.data ? formatData(l.data) : '—') },
    {
      id: 'descricao',
      header: 'Descrição',
      cell: (l) => <span className="block max-w-56 truncate">{l.descricao || '—'}</span>,
    },
    {
      id: 'tipo',
      header: 'Tipo',
      cell: (l) =>
        l.tipo ? (
          <Badge tone={l.tipo === 'receita' ? 'receita' : 'despesa'}>
            {TIPO_LANCAMENTO_LABELS[l.tipo as TipoLancamento]}
          </Badge>
        ) : (
          '—'
        ),
    },
    { id: 'categoria', header: 'Categoria', cell: (l) => l.categoriaNome ?? '—' },
    {
      id: 'valor',
      header: 'Valor',
      numeric: true,
      cell: (l) => (l.valor !== null ? formatBRL(l.valor) : '—'),
    },
    {
      id: 'situacao',
      header: 'Situação',
      cell: (l) => {
        const s = situacaoDaLinha(l);
        return <Badge tone={s.tone}>{s.texto}</Badge>;
      },
    },
  ];

  const confirmarImportacao = async () => {
    setErro(null);
    const body: ConfirmarImportacaoBody = {
      nomeArquivo: arquivo.name,
      totalLinhas: preview.totalLinhas,
      mapeamento,
      ignorarDuplicadas,
      linhas: prontas.map((l) => ({
        numero: l.numero,
        data: l.data!,
        valor: l.valor!,
        descricao: l.descricao,
        tipo: l.tipo!,
        categoriaId: l.categoriaId!,
        contatoId: l.contatoId,
        formaPagamento: l.formaPagamento,
        status: l.status,
        observacoes: l.observacoes,
        hash: l.hash,
      })),
    };
    try {
      const res = await confirmar.mutateAsync(body);
      onConcluir(res.data.id, {
        importadas: res.data.importadas,
        ignoradas: res.data.ignoradas,
        duplicadas: res.data.duplicadas,
      });
    } catch (err) {
      setErro(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard titulo="Linhas no arquivo" valor={String(preview.totalLinhas)} tone="neutral" />
        <StatCard titulo="Prontas para importar" valor={String(prontas.length)} tone="receita" />
        <StatCard titulo="Com erro" valor={String(preview.comErro)} tone="despesa" />
        <StatCard titulo="Já importadas" valor={String(preview.duplicadas)} tone="alerta" />
      </div>

      {semCategoria > 0 ? (
        <p className="flex items-start gap-2 rounded-md border border-alerta-200 bg-alerta-50 px-3 py-2 text-sm text-alerta-800">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {semCategoria} linha(s) sem categoria correspondente não serão importadas. Volte ao
          mapeamento e escolha uma categoria padrão, ou cadastre a categoria antes de importar.
        </p>
      ) : null}

      <div className="rounded-lg border border-borda p-3">
        <Switch
          checked={ignorarDuplicadas}
          onCheckedChange={setIgnorarDuplicadas}
          label="Pular linhas já importadas"
          descricao="Recomendado: evita duplicar lançamentos ao reimportar o mesmo período."
        />
      </div>

      <div className="max-h-[28rem] overflow-y-auto">
        <DataTable
          columns={colunas}
          data={preview.linhas.slice(0, LIMITE_EXIBICAO)}
          rowKey={(l) => `${l.numero}-${l.hash}`}
          caption="Linhas interpretadas do CSV"
          className="rounded-lg border border-borda"
        />
      </div>
      {preview.linhas.length > LIMITE_EXIBICAO ? (
        <p className="text-xs text-zinc-500">
          Mostrando as primeiras {LIMITE_EXIBICAO} de {preview.linhas.length} linhas. Todas as
          linhas prontas serão importadas, mesmo as que não aparecem na lista.
        </p>
      ) : null}

      {erro ? <p className="text-sm font-medium text-perigo-700">{erro}</p> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onVoltar} disabled={confirmar.isPending}>
          Voltar ao mapeamento
        </Button>
        <Button
          type="button"
          loading={confirmar.isPending}
          disabled={prontas.length === 0}
          onClick={() => void confirmarImportacao()}
        >
          Importar {prontas.length} lançamento(s)
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 4: concluído
// ---------------------------------------------------------------------------

function EtapaConcluido({
  importacaoId,
  resumo,
  onNovaImportacao,
}: {
  importacaoId: string;
  resumo: { importadas: number; ignoradas: number; duplicadas: number };
  onNovaImportacao: () => void;
}) {
  const confirm = useConfirm();
  const desfazer = useDesfazerImportacao();

  const confirmarDesfazer = async () => {
    const ok = await confirm({
      titulo: 'Desfazer esta importação?',
      descricao: `Os ${resumo.importadas} lançamento(s) criados por ela serão excluídos.`,
      confirmarTexto: 'Desfazer',
      tom: 'destructive',
    });
    if (ok) desfazer.mutate(importacaoId);
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-borda bg-superficie px-4 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-receita-50 text-receita-700">
        <CheckCircle2 aria-hidden="true" className="size-7" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">Importação concluída</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {resumo.importadas} lançamento(s) criado(s)
          {resumo.duplicadas > 0 ? `, ${resumo.duplicadas} pulado(s) por já existir` : ''}
          {resumo.ignoradas > 0 ? `, ${resumo.ignoradas} ignorado(s)` : ''}.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/lancamentos?origem=importacao">Ver lançamentos importados</Link>
        </Button>
        <Button
          variant="outline"
          icon={<RotateCcw aria-hidden="true" />}
          onClick={onNovaImportacao}
        >
          Importar outro arquivo
        </Button>
        {resumo.importadas > 0 ? (
          <Button
            variant="outline"
            icon={<Undo2 aria-hidden="true" />}
            loading={desfazer.isPending}
            onClick={() => void confirmarDesfazer()}
          >
            Desfazer importação
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

interface EstadoWizard {
  etapa: Etapa;
  arquivo: File | null;
  cabecalho: string[];
  mapeamento: MapeamentoCsv | null;
  preview: PreviewImportacaoDto | null;
  importacaoId: string | null;
  resumo: { importadas: number; ignoradas: number; duplicadas: number } | null;
}

const ESTADO_INICIAL: EstadoWizard = {
  etapa: 'upload',
  arquivo: null,
  cabecalho: [],
  mapeamento: null,
  preview: null,
  importacaoId: null,
  resumo: null,
};

export function ImportarCsvPage() {
  const [estado, setEstado] = useState<EstadoWizard>(ESTADO_INICIAL);
  const indiceEtapa = ETAPAS.findIndex((e) => e.id === estado.etapa);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        titulo="Importar CSV"
        descricao="Traga lançamentos de um extrato ou planilha, com conferência antes de salvar."
        voltar="/lancamentos"
      />

      <div className="mb-6">
        <Progress value={((indiceEtapa + 1) / ETAPAS.length) * 100} size="sm" />
        <div className="mt-2 flex justify-between text-xs text-zinc-500">
          {ETAPAS.map((e, i) => (
            <span
              key={e.id}
              className={i <= indiceEtapa ? 'font-medium text-primary-700' : undefined}
            >
              {e.label}
            </span>
          ))}
        </div>
      </div>

      {estado.etapa === 'upload' ? (
        <EtapaUpload
          onArquivo={(arquivo, cabecalho) =>
            setEstado((s) => ({ ...s, etapa: 'mapear', arquivo, cabecalho }))
          }
        />
      ) : null}

      {estado.etapa === 'mapear' && estado.arquivo ? (
        <EtapaMapeamento
          arquivo={estado.arquivo}
          cabecalho={estado.cabecalho}
          mapeamentoAnterior={estado.mapeamento}
          onVoltar={() => setEstado(ESTADO_INICIAL)}
          onAvancar={(preview, mapeamento) =>
            setEstado((s) => ({ ...s, etapa: 'pre-visualizar', preview, mapeamento }))
          }
        />
      ) : null}

      {estado.etapa === 'pre-visualizar' &&
      estado.arquivo &&
      estado.preview &&
      estado.mapeamento ? (
        <EtapaPreVisualizacao
          arquivo={estado.arquivo}
          preview={estado.preview}
          mapeamento={estado.mapeamento}
          onVoltar={() => setEstado((s) => ({ ...s, etapa: 'mapear' }))}
          onConcluir={(importacaoId, resumo) =>
            setEstado((s) => ({ ...s, etapa: 'concluido', importacaoId, resumo }))
          }
        />
      ) : null}

      {estado.etapa === 'concluido' && estado.importacaoId && estado.resumo ? (
        <EtapaConcluido
          importacaoId={estado.importacaoId}
          resumo={estado.resumo}
          onNovaImportacao={() => setEstado(ESTADO_INICIAL)}
        />
      ) : null}
    </div>
  );
}
