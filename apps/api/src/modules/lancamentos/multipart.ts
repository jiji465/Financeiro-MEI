// Leitura de multipart/form-data (anexos e importação CSV): um arquivo + campos de texto.
// O limite de 10 MB é do plugin (plugins/multipart.ts); estourar → 413 PAYLOAD_TOO_LARGE.
import type { FastifyRequest } from 'fastify';

import { ValidationError } from '../../lib/errors.js';
import type { ArquivoEntrada } from '../../lib/storage.js';

export interface MultipartLido {
  /** Primeiro arquivo enviado (campo informado em `campo`) ou undefined. */
  arquivo: (ArquivoEntrada & { campo: string }) | undefined;
  /** Campos de texto (valor bruto). */
  campos: Record<string, string>;
}

export async function lerMultipart(request: FastifyRequest): Promise<MultipartLido> {
  if (!request.isMultipart()) {
    throw new ValidationError('Envie o arquivo como multipart/form-data', [
      { campo: 'arquivo', mensagem: 'Arquivo obrigatório' },
    ]);
  }
  const campos: Record<string, string> = {};
  let arquivo: MultipartLido['arquivo'];
  for await (const parte of request.parts()) {
    if (parte.type === 'file') {
      const conteudo = await parte.toBuffer();
      if (!arquivo) {
        arquivo = {
          campo: parte.fieldname,
          nome: parte.filename,
          mime: parte.mimetype,
          conteudo,
        };
      }
    } else {
      campos[parte.fieldname] = typeof parte.value === 'string' ? parte.value : String(parte.value);
    }
  }
  return { arquivo, campos };
}

/** Exige o arquivo; sem ele → 400 com detalhe no campo informado. */
export function exigirArquivo(lido: MultipartLido, campo = 'arquivo'): ArquivoEntrada {
  if (!lido.arquivo || lido.arquivo.conteudo.length === 0) {
    throw new ValidationError('Arquivo obrigatório', [{ campo, mensagem: 'Selecione um arquivo' }]);
  }
  return lido.arquivo;
}
