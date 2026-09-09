// Prova de isolamento multi-tenant (seção 6 do plano). Runner genérico: carrega todos os
// test/isolation/<modulo>.ts (sem prefixo "_"), cria dois tenants e executa os casos como B.
// Também confere que toda rota com parâmetro registrada no app está coberta por algum recurso.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, signupTenant, type TenantSession, type TestApp } from './helpers.js';
import { extrairRotasComParametro, type RecursoIsolamento } from './isolation/_registry.js';

const PASTA = join(fileURLToPath(new URL('.', import.meta.url)), 'isolation');

async function carregarRecursos(): Promise<RecursoIsolamento[]> {
  const arquivos = readdirSync(PASTA)
    .filter((f) => /\.ts$/.test(f) && !f.startsWith('_') && !f.endsWith('.d.ts'))
    .sort();
  const recursos: RecursoIsolamento[] = [];
  for (const arquivo of arquivos) {
    const modulo = (await import(pathToFileURL(join(PASTA, arquivo)).href)) as {
      recursos?: RecursoIsolamento[];
      default?: RecursoIsolamento[];
    };
    const lista = modulo.recursos ?? modulo.default;
    if (!Array.isArray(lista)) {
      throw new Error(`test/isolation/${arquivo} precisa exportar "recursos: RecursoIsolamento[]"`);
    }
    recursos.push(...lista);
  }
  return recursos;
}

const recursos = await carregarRecursos();

describe('isolamento multi-tenant', () => {
  let ctx: TestApp;
  let a: TenantSession;
  let b: TenantSession;

  beforeAll(async () => {
    ctx = await buildTestApp();
    a = await signupTenant(ctx.app, { nome: 'Tenant A', atividade: 'comercio_servicos' });
    b = await signupTenant(ctx.app, { nome: 'Tenant B', atividade: 'comercio_servicos' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('carregou pelo menos os recursos do P1-B', () => {
    const nomes = recursos.map((r) => r.recurso);
    expect(nomes).toContain('categorias');
    expect(nomes).toContain('configuracoes');
  });

  for (const recurso of recursos) {
    describe(recurso.recurso, () => {
      let ids: Record<string, string>;

      beforeAll(async () => {
        ids = await recurso.preparar(ctx.app, a);
      });

      it('o próprio tenant A ainda enxerga o que criou (sanidade do preparar)', () => {
        expect(Object.keys(ids).length).toBeGreaterThan(0);
      });

      for (const caso of recurso.casos) {
        it(caso.nome, async () => {
          const req = caso.requisicao(ids);
          const res = await ctx.app.inject({
            ...req,
            headers: { ...b.headers, ...(req.headers as Record<string, string> | undefined) },
          });
          const esperados = caso.status ?? [404];
          expect(
            esperados,
            `status ${res.statusCode} fora de ${esperados.join('/')}: ${res.body}`,
          ).toContain(res.statusCode);
          if (caso.naoDeveConter) {
            for (const id of caso.naoDeveConter(ids)) {
              expect(res.body, `corpo contém id de A: ${id}`).not.toContain(id);
            }
          }
        });
      }
    });
  }

  it('toda rota com parâmetro (:id etc.) está coberta por algum recurso do registro', () => {
    const cobertas = new Set(recursos.flatMap((r) => r.rotasCobertas));
    const rotas = extrairRotasComParametro(ctx.app);
    expect(rotas.length).toBeGreaterThan(0);
    const descobertas = rotas.filter((r) => !cobertas.has(r.chave)).map((r) => r.chave);
    expect(
      descobertas,
      `Rotas sem caso de isolamento — adicione em test/isolation/<modulo>.ts: ${descobertas.join(', ')}`,
    ).toEqual([]);
  });

  it('rotasCobertas só referencia rotas que existem de fato', () => {
    const existentes = new Set(extrairRotasComParametro(ctx.app).map((r) => r.chave));
    const inexistentes = recursos
      .flatMap((r) => r.rotasCobertas)
      .filter((chave) => !existentes.has(chave));
    expect(inexistentes).toEqual([]);
  });
});
