// Registro de módulos da API. Criado no Phase 0 com TODOS os módulos; ninguém edita depois —
// cada WP preenche apenas src/modules/<modulo>/**.
//
// prefix: montado como /api/v1 + prefix. Módulos que expõem mais de um recurso de topo
// (titulos + parcelas, lancamentos + recorrencias) usam prefix '' e declaram os caminhos completos.
// requiresAuth: true → onRequest: [app.authenticate] no contexto encapsulado do módulo.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { authModule } from './auth/index.js';
import { categoriasModule } from './categorias/index.js';
import { configuracoesModule } from './configuracoes/index.js';
import { contatosModule } from './contatos/index.js';
import { dashboardModule } from './dashboard/index.js';
import { importacoesModule } from './importacoes/index.js';
import { lancamentosModule } from './lancamentos/index.js';
import { notasFiscaisModule } from './notas-fiscais/index.js';
import { obrigacoesModule } from './obrigacoes/index.js';
import { relatoriosModule } from './relatorios/index.js';
import { titulosModule } from './titulos/index.js';

export interface ModuleDefinition {
  name: string;
  prefix: string;
  plugin: FastifyPluginAsyncZod;
  requiresAuth: boolean;
}

export const modules: readonly ModuleDefinition[] = [
  { name: 'auth', prefix: '/auth', plugin: authModule, requiresAuth: false },
  {
    name: 'configuracoes',
    prefix: '/configuracoes',
    plugin: configuracoesModule,
    requiresAuth: true,
  },
  { name: 'categorias', prefix: '/categorias', plugin: categoriasModule, requiresAuth: true },
  { name: 'contatos', prefix: '/contatos', plugin: contatosModule, requiresAuth: true },
  { name: 'lancamentos', prefix: '', plugin: lancamentosModule, requiresAuth: true },
  { name: 'importacoes', prefix: '/importacoes', plugin: importacoesModule, requiresAuth: true },
  { name: 'titulos', prefix: '', plugin: titulosModule, requiresAuth: true },
  {
    name: 'notas-fiscais',
    prefix: '/notas-fiscais',
    plugin: notasFiscaisModule,
    requiresAuth: true,
  },
  { name: 'obrigacoes', prefix: '/obrigacoes', plugin: obrigacoesModule, requiresAuth: true },
  { name: 'dashboard', prefix: '/dashboard', plugin: dashboardModule, requiresAuth: true },
  { name: 'relatorios', prefix: '/relatorios', plugin: relatoriosModule, requiresAuth: true },
];
