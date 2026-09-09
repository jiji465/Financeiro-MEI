// Utilitário de teste: monta um corpo multipart/form-data para app.inject (sem dependências).
// Usado pelos testes de anexo (lancamentos) e de importação CSV.
import { randomUUID } from 'node:crypto';

export type ParteMultipart =
  | { nome: string; valor: string }
  | { nome: string; arquivo: { nome: string; mime: string; conteudo: Buffer | string } };

export function montarMultipart(partes: ParteMultipart[]): {
  payload: Buffer;
  headers: { 'content-type': string };
} {
  const boundary = `----meifin-${randomUUID()}`;
  const pedacos: Buffer[] = [];
  for (const parte of partes) {
    pedacos.push(Buffer.from(`--${boundary}\r\n`));
    if ('arquivo' in parte) {
      pedacos.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${parte.nome}"; filename="${parte.arquivo.nome}"\r\n` +
            `Content-Type: ${parte.arquivo.mime}\r\n\r\n`,
        ),
      );
      pedacos.push(
        Buffer.isBuffer(parte.arquivo.conteudo)
          ? parte.arquivo.conteudo
          : Buffer.from(parte.arquivo.conteudo, 'utf8'),
      );
      pedacos.push(Buffer.from('\r\n'));
    } else {
      pedacos.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${parte.nome}"\r\n\r\n${parte.valor}\r\n`,
        ),
      );
    }
  }
  pedacos.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(pedacos),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}
