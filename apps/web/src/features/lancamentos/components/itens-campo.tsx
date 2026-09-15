// Seção "Itens" do diálogo de lançamento: detalha uma venda (ou uma compra) em linhas do
// catálogo — 3 bolos + 2 tortas —, cada uma com quantidade e valor unitário.
//
// Regras que esta tela precisa respeitar, porque a API as impõe (produtos-servicos/service.ts):
//   - o total de cada linha é quantidade × valor unitário, arredondado ao centavo meio para cima
//     (`totalDoItem`, a MESMA função que a API usa — não há duas contas de arredondamento);
//   - havendo itens, a soma dos totais tem que ser igual ao valor do lançamento. Por isso o campo
//     "Valor" fica somado a partir das linhas e travado enquanto existir pelo menos uma.
//
// Quantidade é digitada em unidades ("1,5") e guardada em MILÉSIMOS inteiros (1500): o projeto
// não usa ponto flutuante para dinheiro nem para o que multiplica dinheiro.
import {
  formatQuantidade,
  ITENS_POR_LANCAMENTO_MAX,
  parseQuantidade,
  type ProdutoServicoOpcaoDto,
} from '@meifin/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
  type UseFormSetValue,
} from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { FormField, FormMoneyInput } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { produtosServicosParaOpcoes, useProdutosServicosOpcoes } from '@/features/referencias';
import { formatBRL } from '@/lib/format/money';

import { ITEM_VAZIO, somaDosItens, totalDaLinha, type ItemFormValores } from '../itens';

/**
 * Entrada de quantidade em unidades ("3", "1,5", "0,25"), guardada em milésimos.
 * Mantém o texto digitado enquanto o campo está em uso (senão "1," viraria "1" a cada tecla) e
 * se realinha quando o valor muda por fora (reset do formulário, troca de lançamento).
 */
function QuantidadeInput({
  value,
  onChange,
  onBlur,
  ...props
}: {
  value: number | null;
  onChange: (valor: number | null) => void;
  onBlur?: () => void;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const [texto, setTexto] = useState(() => (value === null ? '' : formatQuantidade(value)));
  const ultimo = useRef(value);

  useEffect(() => {
    if (value === ultimo.current) return;
    ultimo.current = value;
    setTexto(value === null ? '' : formatQuantidade(value));
  }, [value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className="text-right tabular-nums"
      placeholder="1"
      value={texto}
      onChange={(e) => {
        const bruto = e.target.value;
        setTexto(bruto);
        const milesimos = bruto.trim() === '' ? null : parseQuantidade(bruto);
        ultimo.current = milesimos;
        onChange(milesimos);
      }}
      onBlur={() => {
        // Ao sair do campo, normaliza o texto ("1,50" → "1,5"; lixo → vazio).
        setTexto(ultimo.current === null ? '' : formatQuantidade(ultimo.current));
        onBlur?.();
      }}
    />
  );
}

export interface ItensCampoProps<T extends FieldValues> {
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  /** Nome do array no formulário (sempre "itens"; parametrizado só para o tipo fechar). */
  nome: FieldArrayPath<T>;
  disabled?: boolean;
  /** Receita = venda; despesa = compra. Só muda o texto. */
  tipo: 'receita' | 'despesa';
}

export function ItensCampo<T extends FieldValues>({
  control,
  setValue,
  nome,
  disabled,
  tipo,
}: ItensCampoProps<T>) {
  const array = useFieldArray({ control, name: nome });
  // O caminho do array é o mesmo em FieldArrayPath e FieldPath; o cast existe só porque o
  // componente é genérico (o formulário dono é que conhece o nome de verdade).
  const itens = (useWatch({ control, name: nome as unknown as FieldPath<T> }) ??
    []) as ItemFormValores[];
  const catalogo = useProdutosServicosOpcoes();
  const opcoes = produtosServicosParaOpcoes(catalogo.data);
  const total = somaDosItens(itens);

  const caminho = (i: number, campo: keyof ItemFormValores) =>
    `${nome}.${i}.${campo}` as FieldPath<T>;

  /** Ao escolher um item do catálogo, sugere o preço padrão dele (ainda dá para trocar). */
  const escolherProduto = (i: number, id: string | null) => {
    setValue(caminho(i, 'produtoServicoId'), id as never, { shouldDirty: true });
    const produto: ProdutoServicoOpcaoDto | undefined = catalogo.data?.find((p) => p.id === id);
    if (produto?.precoPadrao != null) {
      setValue(caminho(i, 'valorUnitario'), produto.precoPadrao as never, { shouldDirty: true });
    }
  };

  if (array.fields.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-borda p-3">
        <p className="text-sm text-zinc-600">
          {tipo === 'receita'
            ? 'Vendeu produtos ou serviços do seu catálogo? Detalhe a venda em itens e o valor é somado sozinho.'
            : 'Comprou itens do seu catálogo? Detalhe a compra em itens e o valor é somado sozinho.'}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          icon={<Plus aria-hidden="true" />}
          onClick={() => array.append(ITEM_VAZIO as never)}
          disabled={disabled}
        >
          Adicionar itens
        </Button>
      </div>
    );
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-borda p-3">
      <legend className="px-1 text-sm font-medium">Itens</legend>
      {array.fields.map((campo, i) => (
        <div
          key={campo.id}
          className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[minmax(0,2fr)_5.5rem_minmax(0,1fr)_auto] sm:items-end"
        >
          <FormField
            control={control}
            name={caminho(i, 'produtoServicoId')}
            label={i === 0 ? 'Produto ou serviço' : undefined}
            className="col-span-2 sm:col-span-1"
            render={({ field, id, invalid, describedBy }) => (
              <Combobox
                id={id}
                aria-label={`Produto ou serviço do item ${i + 1}`}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                value={field.value as string | null}
                onChange={(v) => escolherProduto(i, v)}
                onBlur={field.onBlur}
                options={opcoes}
                loading={catalogo.isPending}
                emptyText="Nada no catálogo ainda."
                placeholder="Selecione…"
                disabled={disabled}
              />
            )}
          />
          <FormField
            control={control}
            name={caminho(i, 'quantidade')}
            label={i === 0 ? 'Qtd.' : undefined}
            render={({ field, id, invalid, describedBy }) => (
              <QuantidadeInput
                id={id}
                aria-label={`Quantidade do item ${i + 1}`}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                value={field.value as number | null}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={disabled}
              />
            )}
          />
          <FormMoneyInput
            control={control}
            name={caminho(i, 'valorUnitario')}
            label={i === 0 ? 'Valor unitário' : undefined}
            aria-label={`Valor unitário do item ${i + 1}`}
            disabled={disabled}
          />
          <div className="flex items-center justify-end gap-2">
            <span
              className="text-sm text-zinc-600 tabular-nums sm:hidden"
              aria-label={`Total do item ${i + 1}`}
            >
              {formatBRL(totalDaLinha(itens[i]))}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover item ${i + 1}`}
              onClick={() => array.remove(i)}
              disabled={disabled}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
          <p className="col-span-full hidden text-right text-xs text-zinc-500 tabular-nums sm:block">
            Total da linha: {formatBRL(totalDaLinha(itens[i]))}
          </p>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Plus aria-hidden="true" />}
          onClick={() => array.append(ITEM_VAZIO as never)}
          disabled={disabled || array.fields.length >= ITENS_POR_LANCAMENTO_MAX}
        >
          Adicionar item
        </Button>
        <p className="text-sm font-medium text-texto tabular-nums" aria-live="polite">
          Total dos itens: {formatBRL(total)}
        </p>
      </div>
    </fieldset>
  );
}
