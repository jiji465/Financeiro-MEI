// Hooks de referência usados por todas as features (staleTime 5 min).
//   const { data: categorias } = useCategorias('despesa');
//   const { opcoes } = useContatosOpcoes('cliente');   // pronto para <Combobox options={opcoes}/>
import type { TipoContato, TipoLancamento, TipoProdutoServico } from '@meifin/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { ComboboxOption } from '@/components/ui/combobox';
import { useMe } from '@/features/auth/hooks';
import { formatDocumento } from '@/lib/format/documento';

import { formatBRL } from '@/lib/format/money';
import { TIPO_CONTA_BANCARIA_LABELS, TIPO_PRODUTO_SERVICO_LABELS } from '@/lib/labels';

import {
  referenciasApi,
  type CategoriaRef,
  type ContaBancariaRef,
  type ContatoRef,
  type ProdutoServicoRef,
} from './api';
import { referenciasKeys } from './keys';

const CINCO_MINUTOS = 5 * 60_000;

export function useCategorias(tipo?: TipoLancamento, opcoes: { apenasAtivas?: boolean } = {}) {
  const apenasAtivas = opcoes.apenasAtivas ?? true;
  return useQuery({
    queryKey: referenciasKeys.categorias(tipo),
    queryFn: () => referenciasApi.categorias(tipo),
    staleTime: CINCO_MINUTOS,
    select: (res) => (apenasAtivas ? res.data.filter((c) => c.ativo) : res.data),
  });
}

export function categoriasParaOpcoes(
  categorias: readonly CategoriaRef[] | undefined,
): ComboboxOption[] {
  return (categorias ?? []).map((c) => ({ value: c.id, label: c.nome }));
}

export function useContatosOpcoes(tipo?: TipoContato) {
  const query = useQuery({
    queryKey: referenciasKeys.contatos(tipo),
    queryFn: () => referenciasApi.contatos(tipo),
    staleTime: CINCO_MINUTOS,
    select: (res) => res.data.filter((c) => c.ativo),
  });
  const opcoes = useMemo(() => contatosParaOpcoes(query.data), [query.data]);
  return { ...query, opcoes };
}

export function contatosParaOpcoes(contatos: readonly ContatoRef[] | undefined): ComboboxOption[] {
  return (contatos ?? []).map((c) => ({
    value: c.id,
    label: c.nome,
    descricao: c.documento ? formatDocumento(c.documento) : undefined,
    keywords: c.documento ? [c.documento] : undefined,
  }));
}

/** Contas bancárias ativas para o seletor do lançamento (mesmo formato dos outros comboboxes). */
export function useContasBancariasOpcoes() {
  const query = useQuery({
    queryKey: referenciasKeys.contasBancarias(),
    queryFn: () => referenciasApi.contasBancarias(),
    staleTime: CINCO_MINUTOS,
    select: (res) => res.data,
  });
  const opcoes = useMemo(() => contasBancariasParaOpcoes(query.data), [query.data]);
  return { ...query, opcoes };
}

export function contasBancariasParaOpcoes(
  contas: readonly ContaBancariaRef[] | undefined,
): ComboboxOption[] {
  return (contas ?? []).map((c) => ({
    value: c.id,
    label: c.nome,
    descricao: c.instituicao ?? TIPO_CONTA_BANCARIA_LABELS[c.tipo],
    keywords: c.instituicao ? [c.instituicao] : undefined,
  }));
}

/** Catálogo ativo para o seletor de itens do lançamento (produtos e serviços juntos). */
export function useProdutosServicosOpcoes(tipo?: TipoProdutoServico) {
  const query = useQuery({
    queryKey: referenciasKeys.produtosServicos(tipo),
    queryFn: () => referenciasApi.produtosServicos(tipo),
    staleTime: CINCO_MINUTOS,
    select: (res) => res.data,
  });
  const opcoes = useMemo(() => produtosServicosParaOpcoes(query.data), [query.data]);
  return { ...query, opcoes };
}

export function produtosServicosParaOpcoes(
  itens: readonly ProdutoServicoRef[] | undefined,
): ComboboxOption[] {
  return (itens ?? []).map((p) => ({
    value: p.id,
    label: p.nome,
    descricao: [
      TIPO_PRODUTO_SERVICO_LABELS[p.tipo],
      p.precoPadrao !== null ? formatBRL(p.precoPadrao) : null,
      p.unidade,
    ]
      .filter(Boolean)
      .join(' · '),
    keywords: p.unidade ? [p.unidade] : undefined,
  }));
}

export function useDasParametros(ano: number) {
  return useQuery({
    queryKey: referenciasKeys.dasParametros(ano),
    queryFn: () => referenciasApi.dasParametros(ano),
    staleTime: CINCO_MINUTOS,
    select: (res) => res.data,
    enabled: Number.isInteger(ano) && ano >= 2000,
  });
}

/** Usuário + MEI (tenant) atuais — GET /auth/me. */
export function useMei() {
  return useMe();
}
