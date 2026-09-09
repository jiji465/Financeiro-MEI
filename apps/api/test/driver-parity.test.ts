// Paridade PGlite × Postgres: cada tipo de coluna (uuid, text, varchar, enum, integer, boolean,
// date string, timestamptz string, jsonb) faz ida e volta com o mesmo formato, e agregados
// ::int voltam como number. Roda sempre no PGlite; no pg só quando DATABASE_URL está definida.
import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/env.js';
import { createDb, type Database, MEMORY_DATA_DIR } from '../src/db/index.js';
import { categorias } from '../src/db/schema/categorias.js';
import { lancamentos } from '../src/db/schema/lancamentos.js';
import { parametrosMei } from '../src/db/schema/parametros.js';
import { tenants } from '../src/db/schema/tenants.js';
import { isoTimestamp } from '../src/lib/hoje.js';
import { forTenant } from '../src/lib/tenant-db.js';
import { criarLancamentoInterno } from '../src/modules/lancamentos/core.js';
import { TEST_ENV } from './helpers.js';

const drivers: Array<{ nome: string; env: Record<string, string> }> = [
  { nome: 'pglite', env: { PGLITE_DATA_DIR: MEMORY_DATA_DIR } },
];
if (process.env.DATABASE_URL?.trim()) {
  drivers.push({ nome: 'pg', env: { DATABASE_URL: process.env.DATABASE_URL.trim() } });
}

describe.each(drivers)('paridade de tipos no driver $nome', ({ env }) => {
  let database: Database;
  const tenantId = randomUUID();
  const anoTeste = 2900 + Math.floor(Math.random() * 90);

  beforeAll(async () => {
    database = await createDb(loadEnv({ ...TEST_ENV, ...env }));
    await database.migrate();
  });

  afterAll(async () => {
    // Limpa o que criou (importante no pg remoto); cascata apaga categorias/lançamentos.
    await database.db.delete(tenants).where(eq(tenants.id, tenantId));
    await database.db.delete(parametrosMei).where(eq(parametrosMei.ano, anoTeste));
    await database.close();
  });

  it('tenants: uuid, text, varchar, enum, date string, jsonb, boolean, timestamptz string', async () => {
    const [criado] = await database.db
      .insert(tenants)
      .values({
        id: tenantId,
        nome: 'Paridade Ltda — acentuação çã',
        nomeFantasia: null,
        cnpj: '12ABC345000195',
        atividade: 'comercio_servicos',
        caminhoneiroTributos: null,
        dataAbertura: '2024-02-29',
        endereco: { cidade: 'São Paulo', uf: 'SP', cep: '01001000' },
        ativo: true,
      })
      .returning();
    expect(criado).toBeDefined();
    const [lido] = await database.db.select().from(tenants).where(eq(tenants.id, tenantId));
    expect(lido).toBeDefined();
    expect(lido!.id).toBe(tenantId);
    expect(lido!.nome).toBe('Paridade Ltda — acentuação çã');
    expect(lido!.cnpj).toBe('12ABC345000195');
    expect(lido!.atividade).toBe('comercio_servicos');
    expect(lido!.dataAbertura).toBe('2024-02-29');
    expect(typeof lido!.dataAbertura).toBe('string');
    expect(lido!.endereco).toEqual({ cidade: 'São Paulo', uf: 'SP', cep: '01001000' });
    expect(lido!.ativo).toBe(true);
    expect(typeof lido!.createdAt).toBe('string');
    const iso = isoTimestamp(lido!.createdAt);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Math.abs(new Date(iso!).getTime() - Date.now())).toBeLessThan(60_000);
  });

  it('parametros_mei: integer PK, integers e jsonb array', async () => {
    await database.db
      .insert(parametrosMei)
      .values({ ano: anoTeste, salarioMinimo: 162_100, alertasLimitePct: [70, 85, 100] });
    const [lido] = await database.db
      .select()
      .from(parametrosMei)
      .where(eq(parametrosMei.ano, anoTeste));
    expect(lido!.salarioMinimo).toBe(162_100);
    expect(typeof lido!.salarioMinimo).toBe('number');
    expect(lido!.limiteAnual).toBe(8_100_000);
    expect(lido!.alertasLimitePct).toEqual([70, 85, 100]);
    expect(lido!.confirmado).toBe(true);
  });

  it('sumInt/countInt devolvem number (não string/bigint) e datas de negócio voltam como AAAA-MM-DD', async () => {
    const tdb = forTenant(database.db, tenantId);
    const categoria = await tdb.insert(categorias, { nome: 'Vendas', tipo: 'receita' });
    await criarLancamentoInterno(database.db, tenantId, {
      tipo: 'receita',
      data: '2026-01-31',
      valor: 12_345,
      descricao: 'Venda 1',
      categoriaId: categoria.id,
      formaPagamento: 'pix',
      status: 'pago',
      origem: 'manual',
    });
    await criarLancamentoInterno(database.db, tenantId, {
      tipo: 'receita',
      data: '2026-02-01',
      valor: 655,
      descricao: 'Venda 2',
      categoriaId: categoria.id,
      formaPagamento: 'dinheiro',
      status: 'pendente',
      origem: 'manual',
    });
    const [agregado] = await database.db
      .select({ total: tdb.sumInt(lancamentos.valor), n: tdb.countInt() })
      .from(lancamentos)
      .where(tdb.scoped(lancamentos));
    expect(agregado).toEqual({ total: 13_000, n: 2 });
    expect(typeof agregado!.total).toBe('number');

    const linhas = await database.db.select().from(lancamentos).where(tdb.scoped(lancamentos));
    const pago = linhas.find((l) => l.status === 'pago')!;
    expect(pago.data).toBe('2026-01-31');
    expect(pago.dataPagamento).toBe('2026-01-31');
    const pendente = linhas.find((l) => l.status === 'pendente')!;
    expect(pendente.dataPagamento).toBeNull();
    expect(pendente.deletedAt).toBeNull();
  });
});
