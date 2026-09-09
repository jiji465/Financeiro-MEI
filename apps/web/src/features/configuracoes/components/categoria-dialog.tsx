// Diálogo "Nova categoria" / "Editar categoria". O tipo (receita/despesa) só pode ser escolhido
// na criação — depois de criada, a API não permite mudar (atualizarCategoriaBody omite `tipo`).
import { zodResolver } from '@hookform/resolvers/zod';
import { type CategoriaDto, GRUPOS_DASN, TIPOS_LANCAMENTO } from '@meifin/shared';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormInput, FormRadioCards, FormRootError } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { GRUPO_DASN_LABELS, opcoesDe, TIPO_LANCAMENTO_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils/cn';

import { useAtualizarCategoria, useCriarCategoria } from '../hooks';

export const CORES_CATEGORIA = [
  '#16a34a',
  '#dc2626',
  '#2563eb',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#64748b',
] as const;

const OPCOES_TIPO = opcoesDe(TIPOS_LANCAMENTO, TIPO_LANCAMENTO_LABELS);
const OPCOES_GRUPO = opcoesDe(GRUPOS_DASN, GRUPO_DASN_LABELS);

const categoriaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da categoria').max(60, 'Máximo de 60 caracteres'),
  tipo: z.enum(TIPOS_LANCAMENTO, { error: 'Escolha receita ou despesa' }),
  grupoDasn: z.enum(GRUPOS_DASN).nullable(),
  cor: z.string().nullable(),
});

type CategoriaForm = z.input<typeof categoriaSchema>;
type CategoriaValores = z.output<typeof categoriaSchema>;

function SeletorCor({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (cor: string) => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 block">Cor</Label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor da categoria">
        {CORES_CATEGORIA.map((cor) => (
          <button
            key={cor}
            type="button"
            role="radio"
            aria-checked={value === cor}
            aria-label={cor}
            onClick={() => onChange(cor)}
            className={cn(
              'size-8 rounded-full ring-offset-2 transition-shadow',
              value === cor ? 'ring-2 ring-primary-600' : 'hover:ring-2 hover:ring-zinc-300',
            )}
            style={{ backgroundColor: cor }}
          />
        ))}
      </div>
    </div>
  );
}

export interface CategoriaDialogProps {
  /** null = fechado; undefined = criando; CategoriaDto = editando. */
  categoria: CategoriaDto | null | undefined;
  /** Tipo pré-selecionado ao criar (a aba ativa da lista). */
  tipoPadrao?: 'receita' | 'despesa';
  aberto: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoriaDialog({
  categoria,
  tipoPadrao = 'despesa',
  aberto,
  onOpenChange,
}: CategoriaDialogProps) {
  const criar = useCriarCategoria();
  const atualizar = useAtualizarCategoria();
  const salvando = criar.isPending || atualizar.isPending;
  const editando = Boolean(categoria);

  const form = useForm<CategoriaForm, unknown, CategoriaValores>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { nome: '', tipo: tipoPadrao, grupoDasn: null, cor: CORES_CATEGORIA[0] },
  });
  const tipo = useWatch({ control: form.control, name: 'tipo' });
  const cor = useWatch({ control: form.control, name: 'cor' }) ?? null;

  useEffect(() => {
    if (!aberto) return;
    if (categoria) {
      form.reset({
        nome: categoria.nome,
        tipo: categoria.tipo,
        grupoDasn: categoria.grupoDasn,
        cor: categoria.cor ?? CORES_CATEGORIA[0],
      });
    } else {
      form.reset({ nome: '', tipo: tipoPadrao, grupoDasn: null, cor: CORES_CATEGORIA[0] });
    }
  }, [aberto, categoria, tipoPadrao, form]);

  const onSubmit = (valores: CategoriaValores) => {
    const grupoDasn = valores.tipo === 'receita' ? valores.grupoDasn : null;
    if (categoria) {
      atualizar.mutate(
        { id: categoria.id, body: { nome: valores.nome, grupoDasn, cor: valores.cor } },
        {
          onSuccess: () => onOpenChange(false),
          onError: (err) => aplicarErrosDoServidor(err, form.setError),
        },
      );
    } else {
      criar.mutate(
        { nome: valores.nome, tipo: valores.tipo, grupoDasn, cor: valores.cor },
        {
          onSuccess: () => onOpenChange(false),
          onError: (err) => aplicarErrosDoServidor(err, form.setError),
        },
      );
    }
  };

  return (
    <ResponsiveDialog
      open={aberto}
      onOpenChange={onOpenChange}
      titulo={editando ? `Editar "${categoria?.nome}"` : 'Nova categoria'}
      bloqueado={salvando}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-categoria" loading={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        id="form-categoria"
        className="space-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FormRootError errors={form.formState.errors} />
        <FormInput
          control={form.control}
          name="nome"
          label="Nome"
          autoFocus
          placeholder="Ex.: Fornecedores, Vendas online"
        />
        {editando ? (
          <p className="text-sm text-zinc-500">
            Tipo: <span className="font-medium text-texto">{TIPO_LANCAMENTO_LABELS[tipo]}</span>{' '}
            (não pode ser alterado depois de criada)
          </p>
        ) : (
          <FormRadioCards
            control={form.control}
            name="tipo"
            label="Tipo"
            options={OPCOES_TIPO}
            columns={2}
          />
        )}
        {tipo === 'receita' ? (
          <FormRadioCards
            control={form.control}
            name="grupoDasn"
            label="Grupo na DASN-SIMEI"
            hint="Usado para separar o faturamento entre comércio e serviços na declaração anual."
            options={OPCOES_GRUPO}
            columns={2}
          />
        ) : null}
        <SeletorCor value={cor} onChange={(v) => form.setValue('cor', v, { shouldDirty: true })} />
      </form>
    </ResponsiveDialog>
  );
}
