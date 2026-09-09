// Registro manual: o MEI emite a nota no portal (NFS-e nacional, SEFAZ, prefeitura) e só cadastra
// aqui. Nada é enviado a lugar nenhum; a chave de acesso é guardada se o usuário informar.
import type {
  NfeProvider,
  NotaParaEmissao,
  ResultadoCancelamento,
  ResultadoEmissao,
} from './index.js';

export class ManualProvider implements NfeProvider {
  readonly nome = 'manual' as const;

  async emitir(nota: NotaParaEmissao): Promise<ResultadoEmissao> {
    return {
      provedor: 'manual',
      chaveAcesso: nota.chaveAcesso,
      protocolo: null,
      ambiente: null,
      xmlPath: null,
      payload: null,
    };
  }

  async cancelar(): Promise<ResultadoCancelamento> {
    return { protocolo: null, payload: null };
  }
}
