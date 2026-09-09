// Provedores de nota fiscal. v1: só registro manual (ManualProvider). Uma integração SEFAZ
// (provedor 'sefaz') implementa a mesma interface e preenche chave de acesso, protocolo, ambiente,
// xml_path e provedor_payload — as colunas já existem em notas_fiscais.
import type { IsoDate, ProvedorNota, TipoNota } from '@meifin/shared';

export interface NotaParaEmissao {
  tipo: TipoNota;
  numero: string;
  serie: string;
  dataEmissao: IsoDate;
  valor: number;
  descricao: string | null;
  /** Chave de acesso informada manualmente (44 dígitos) quando existir. */
  chaveAcesso: string | null;
  contato: { nome: string; documento: string | null } | null;
}

/** Dados de integração gravados na nota (provedor, chave, protocolo, ambiente, xml, payload). */
export interface ResultadoEmissao {
  provedor: ProvedorNota;
  chaveAcesso: string | null;
  protocolo: string | null;
  ambiente: 'producao' | 'homologacao' | null;
  xmlPath: string | null;
  payload: Record<string, unknown> | null;
}

export interface ResultadoCancelamento {
  protocolo: string | null;
  payload: Record<string, unknown> | null;
}

export interface NfeProvider {
  readonly nome: ProvedorNota;
  /** Registra/emite a nota e devolve os dados de integração a gravar. */
  emitir(nota: NotaParaEmissao): Promise<ResultadoEmissao>;
  /** Cancela a nota no provedor (no manual, só registra o motivo). */
  cancelar(
    nota: { chaveAcesso: string | null; protocolo: string | null },
    motivo: string,
  ): Promise<ResultadoCancelamento>;
}

export { ManualProvider } from './manual.js';

import { ManualProvider } from './manual.js';

const PROVIDERS: Record<ProvedorNota, () => NfeProvider> = {
  manual: () => new ManualProvider(),
  sefaz: () => {
    throw new Error('Provedor SEFAZ ainda não disponível; use o registro manual');
  },
};

export function obterProvider(nome: ProvedorNota = 'manual'): NfeProvider {
  return PROVIDERS[nome]();
}
