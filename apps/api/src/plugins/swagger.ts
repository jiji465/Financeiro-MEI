// OpenAPI gerado a partir dos schemas zod (fastify-type-provider-zod) e servido em /docs.
// Registrado apenas quando env.SWAGGER === true.
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod';

import type { Env } from '../config/env.js';
import { apiVersion } from '../config/paths.js';

export interface SwaggerPluginOptions {
  env: Env;
}

export const swaggerPlugin = fp<SwaggerPluginOptions>(
  async (app, { env }) => {
    await app.register(swagger, {
      openapi: {
        openapi: '3.1.0',
        info: {
          title: 'MEI Financeiro API',
          description: 'API REST do sistema financeiro para MEIs',
          version: apiVersion(),
        },
        servers: [{ url: `http://${env.HOST}:${env.PORT}` }],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
      transform: jsonSchemaTransform,
      transformObject: jsonSchemaTransformObject,
    });
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: false },
    });
  },
  { name: 'meifin-swagger' },
);
