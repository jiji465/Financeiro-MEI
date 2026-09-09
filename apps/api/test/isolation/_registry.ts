// Registro de recursos do teste de isolamento multi-tenant (seção 6 do plano).
//
// Convenção para as fases seguintes: cada WP cria `apps/api/test/isolation/<modulo>.ts` exportando
// `export const recursos: RecursoIsolamento[]`. O runner (test/isolation.test.ts) carrega todos os
// arquivos desta pasta que não começam com "_" — ninguém edita o runner.
//
// Para cada recurso: `preparar` cria dados como o tenant A e devolve ids; cada caso é executado
// como o tenant B e deve responder 404 (ou 422 quando é a FK composta que barra). Casos de
// listagem usam `naoDeveConter` para garantir que nenhum id de A vaza no corpo.
import type { FastifyInstance, InjectOptions } from 'fastify';

import type { TenantSession } from '../helpers.js';

export type IdsDeA = Record<string, string>;

export interface CasoIsolamento {
  nome: string;
  /** Requisição feita como tenant B (o runner injeta o Authorization de B). */
  requisicao(ids: IdsDeA): InjectOptions;
  /** Status aceitos (padrão: [404]). */
  status?: number[];
  /** Ids de A que não podem aparecer no corpo da resposta (listagens). */
  naoDeveConter?(ids: IdsDeA): string[];
}

export interface RecursoIsolamento {
  /** Nome do recurso, só para o relatório (ex.: 'categorias'). */
  recurso: string;
  /**
   * Rotas com parâmetro cobertas por este recurso, no formato "METHOD /api/v1/caminho/:id".
   * O runner confere que toda rota com ":" de app.printRoutes() aparece em algum recurso.
   */
  rotasCobertas: string[];
  /** Cria os dados como o tenant A. */
  preparar(app: FastifyInstance, a: TenantSession): Promise<IdsDeA>;
  casos: CasoIsolamento[];
}

/** Rotas com parâmetro extraídas de app.printRoutes({ commonPrefix: false }). */
export interface RotaComParametro {
  method: string;
  url: string;
  chave: string;
}

const LINHA_RE = /^([│\s]*)(?:├──|└──)\s(.+?)(?:\s\(([A-Z, ]+)\))?$/;

/** Reconstrói as rotas completas a partir da árvore impressa pelo find-my-way. */
export function extrairRotasComParametro(app: FastifyInstance): RotaComParametro[] {
  const arvore = app.printRoutes({ commonPrefix: false });
  const pilha: string[] = [];
  const rotas: RotaComParametro[] = [];

  for (const linhaBruta of arvore.split('\n')) {
    const linha = linhaBruta.replace(/\r$/, '');
    const m = LINHA_RE.exec(linha);
    if (!m) continue;
    const profundidade = Math.round((m[1] ?? '').length / 4);
    const segmento = m[2] ?? '';
    const metodos = (m[3] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const caminho = (profundidade > 0 ? (pilha[profundidade - 1] ?? '') : '') + segmento;
    pilha[profundidade] = caminho;
    pilha.length = profundidade + 1;

    if (!caminho.includes(':') || caminho === '*') continue;
    for (const method of metodos) {
      if (method === 'HEAD' || method === 'OPTIONS') continue;
      rotas.push({ method, url: caminho, chave: `${method} ${caminho}` });
    }
  }
  return rotas;
}
