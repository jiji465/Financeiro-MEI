// Upload multipart (anexos ≤ 10 MB: pdf/jpg/png/xml). P1-B/WP2 usam request.file() nas rotas.
import multipart from '@fastify/multipart';
import { ANEXO } from '@meifin/shared';
import fp from 'fastify-plugin';

export const multipartPlugin = fp(
  async (app) => {
    await app.register(multipart, {
      limits: { fileSize: ANEXO.tamanhoMaxBytes, files: 1 },
    });
  },
  { name: 'meifin-multipart' },
);
