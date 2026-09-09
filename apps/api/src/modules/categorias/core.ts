// Helpers de categorias usados por outros módulos (obrigações/DAS, títulos, notas).
// getCategoriaSistema(exec, tenantId, 'das') devolve a categoria "Impostos e DAS" do tenant,
// recriando-a (e religando configuracoes.categoria_das_id) se alguém a tiver perdido.
import { CATEGORIA_DAS_NOME, CATEGORIAS_PADRAO } from '@meifin/shared';
import { and, eq, sql } from 'drizzle-orm';

import type { DbExecutor } from '../../db/index.js';
import { categorias, type CategoriaRow } from '../../db/schema/categorias.js';
import { configuracoes } from '../../db/schema/tenants.js';
import { forTenant } from '../../lib/tenant-db.js';

export type ChaveCategoriaSistema = 'das';

const TEMPLATE_DAS = CATEGORIAS_PADRAO.find((c) => c.sistema && c.nome === CATEGORIA_DAS_NOME);

const DEFINICAO: Record<ChaveCategoriaSistema, { nome: string; cor: string; icone: string }> = {
  das: {
    nome: CATEGORIA_DAS_NOME,
    cor: TEMPLATE_DAS?.cor ?? '#dc2626',
    icone: TEMPLATE_DAS?.icone ?? 'landmark',
  },
};

export async function getCategoriaSistema(
  exec: DbExecutor,
  tenantId: string,
  chave: ChaveCategoriaSistema,
): Promise<CategoriaRow> {
  const tdb = forTenant(exec, tenantId);
  const definicao = DEFINICAO[chave];

  const [config] = await exec
    .select({ categoriaDasId: configuracoes.categoriaDasId })
    .from(configuracoes)
    .where(eq(configuracoes.tenantId, tenantId))
    .limit(1);

  if (chave === 'das' && config?.categoriaDasId) {
    const configurada = await tdb.findByIdOrNull(categorias, config.categoriaDasId);
    if (configurada) return configurada;
  }

  const [porNome] = await exec
    .select()
    .from(categorias)
    .where(
      and(
        tdb.scoped(categorias),
        eq(categorias.tipo, 'despesa'),
        sql`lower(${categorias.nome}) = lower(${definicao.nome})`,
      ),
    )
    .limit(1);

  let categoria: CategoriaRow;
  if (porNome) {
    categoria = porNome.sistema
      ? porNome
      : await tdb.update(categorias, porNome.id, { sistema: true, ativo: true });
  } else {
    categoria = await tdb.insert(categorias, {
      nome: definicao.nome,
      tipo: 'despesa',
      cor: definicao.cor,
      icone: definicao.icone,
      padrao: true,
      sistema: true,
      ativo: true,
      ordem: 0,
    });
  }

  if (chave === 'das') {
    await exec
      .update(configuracoes)
      .set({ categoriaDasId: categoria.id, updatedAt: sql`now()` })
      .where(eq(configuracoes.tenantId, tenantId));
  }
  return categoria;
}
