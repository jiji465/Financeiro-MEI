// Diálogo "Novo produto" / "Novo serviço" / "Editar item do catálogo".
//
// O preço padrão é SUGESTÃO: ele entra preenchido na linha de item do lançamento e pode ser
// trocado ali mesmo, venda a venda. Por isso pode ficar vazio — quem combina o valor a cada
// trabalho não é obrigado a inventar um número aqui.
import { zodResolver } from '@hookform/resolvers/zod';
import {
  TIPOS_PRODUTO_SERVICO,
  UNIDADES_SUGERIDAS,
  type ProdutoServicoDto,
  type TipoProdutoServico,
} from '@meifin/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormInput,
  FormMoneyInput,
  FormRadioCards,
  FormRootError,
  FormTextarea,
} from '@/components/ui/form-field';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { aplicarErrosDoServidor } from '@/lib/api/errors';

import { useAtualizarProdutoServico, useCriarProdutoServico } from '../hooks';

const TIPO_OPCOES = [
  { value: 'produto' as const, label: 'Produto', descricao: 'Algo que você vende' },
  { value: 'servico' as const, label: 'Serviço', descricao: 'Algo que você faz' },
];

const produtoSchema = z.object({
  tipo: z.enum(TIPOS_PRODUTO_SERVICO),
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome')
    .max(120, 'Nome deve ter no máximo 120 caracteres'),
  descricao: z.string().trim().max(2000, 'Máximo de 2000 caracteres').nullable(),
  precoPadrao: z.number().nullable(),
  unidade: z.string().trim().max(10, 'Unidade deve ter no máximo 10 caracteres').nullable(),
});
type ProdutoFormInput = z.input<typeof produtoSchema>;
type ProdutoFormValores = z.output<typeof produtoSchema>;

const vazio = (tipo: TipoProdutoServico): ProdutoFormInput => ({
  tipo,
  nome: '',
  descricao: '',
  precoPadrao: null,
  unidade: tipo === 'servico' ? 'h' : 'un',
});

export interface ProdutoServicoDialogProps {
  /** undefined = criando; ProdutoServicoDto = editando. */
  item?: ProdutoServicoDto | undefined;
  /** Tipo pré-selecionado na criação (o atalho [+] do topo abre já em produto ou serviço). */
  tipoInicial?: TipoProdutoServico;
  aberto: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProdutoServicoDialog({
  item,
  tipoInicial = 'produto',
  aberto,
  onOpenChange,
}: ProdutoServicoDialogProps) {
  const criar = useCriarProdutoServico();
  const atualizar = useAtualizarProdutoServico(item?.id ?? '');
  const salvando = criar.isPending || atualizar.isPending;
  const editando = Boolean(item);

  const form = useForm<ProdutoFormInput, unknown, ProdutoFormValores>({
    resolver: zodResolver(produtoSchema),
    defaultValues: vazio(tipoInicial),
  });

  useEffect(() => {
    if (!aberto) return;
    form.reset(
      item
        ? {
            tipo: item.tipo,
            nome: item.nome,
            descricao: item.descricao ?? '',
            precoPadrao: item.precoPadrao,
            unidade: item.unidade ?? '',
          }
        : vazio(tipoInicial),
    );
  }, [aberto, item, tipoInicial, form]);

  const onSubmit = (valores: ProdutoFormValores) => {
    const body = {
      tipo: valores.tipo,
      nome: valores.nome,
      descricao: valores.descricao || null,
      precoPadrao: valores.precoPadrao,
      unidade: valores.unidade || null,
    };
    const opcoes = {
      onSuccess: () => onOpenChange(false),
      onError: (err: unknown) => aplicarErrosDoServidor(err, form.setError),
    };
    if (item) atualizar.mutate(body, opcoes);
    else criar.mutate(body, opcoes);
  };

  const titulo = editando
    ? `Editar "${item?.nome}"`
    : tipoInicial === 'servico'
      ? 'Novo serviço'
      : 'Novo produto';

  return (
    <ResponsiveDialog
      open={aberto}
      onOpenChange={onOpenChange}
      titulo={titulo}
      bloqueado={salvando}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-produto-servico" loading={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        id="form-produto-servico"
        className="space-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FormRootError errors={form.formState.errors} />
        <FormRadioCards
          control={form.control}
          name="tipo"
          label="O que é"
          columns={2}
          options={TIPO_OPCOES}
        />
        <FormInput
          control={form.control}
          name="nome"
          label="Nome"
          autoFocus
          placeholder="Ex.: Bolo de cenoura, Corte de cabelo"
          hint="Como esse item aparece na hora de lançar a venda."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormMoneyInput
            control={form.control}
            name="precoPadrao"
            label="Preço padrão"
            opcional
            hint="Só uma sugestão: dá para mudar o valor em cada venda."
          />
          <FormInput
            control={form.control}
            name="unidade"
            label="Unidade"
            opcional
            list="unidades-sugeridas"
            placeholder="un, kg, h, m²…"
            hint="Como você conta esse item."
          />
        </div>
        <datalist id="unidades-sugeridas">
          {UNIDADES_SUGERIDAS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <FormTextarea
          control={form.control}
          name="descricao"
          label="Descrição"
          opcional
          rows={2}
          placeholder="Detalhes que ajudam a lembrar o que é."
        />
      </form>
    </ResponsiveDialog>
  );
}
