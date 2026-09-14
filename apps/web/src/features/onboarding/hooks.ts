// Abertura automática do tour na primeira visita (preferencias.mostrarBoasVindas) e as ações de
// encerrar (marca mostrarBoasVindas: false) e reabrir manualmente (botão em Configurações).
import { useEffect, useRef } from 'react';

import { useAtualizarConfiguracoes, useConfiguracoes } from '@/features/configuracoes/hooks';

import { useTourStore } from './store';

export function useAberturaAutomaticaDoTour() {
  const config = useConfiguracoes();
  const abrir = useTourStore((s) => s.abrir);
  const decidido = useRef(false);

  useEffect(() => {
    if (decidido.current || !config.data) return;
    decidido.current = true;
    if (config.data.preferencias.mostrarBoasVindas) abrir();
  }, [config.data, abrir]);
}

/** Sem mensagem de sucesso: encerrar o tour não deveria disparar um toast de "salvo". */
export function useEncerrarTour() {
  const atualizar = useAtualizarConfiguracoes('');
  return () => atualizar.mutate({ preferencias: { mostrarBoasVindas: false } });
}

export function useReabrirTour() {
  return useTourStore((s) => s.abrir);
}
