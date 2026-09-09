// Hooks de referência usados por todas as features (staleTime 5 min).
//   const { data: categorias } = useCategorias('despesa');
//   const { opcoes } = useContatosOpcoes('cliente');   // pronto para <Combobox options={opcoes}/>
import type { TipoContato, TipoLancamento } from '@meifin/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { ComboboxOption } from '@/components/ui/combobox';
import { useMe } from '@/features/auth/hooks';
import { formatDocumento } from '@/lib/format/documento';

import { referenciasApi, type CategoriaRef, type ContatoRef } from './api';
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
