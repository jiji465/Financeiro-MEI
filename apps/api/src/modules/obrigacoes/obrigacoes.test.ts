// Obrigações do MEI com relógio fixo em 2026-09-09 (quarta-feira). Parâmetros do seed 2026:
// salário mínimo R$ 1.621,00 → INSS 8105; ICMS 100; ISS 500; limite 8.100.000; proporcional 675.000/mês.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  injectComo,
  signupTenant,
  type TenantSession,
  type TestApp,
} from '../../../test/helpers.js';
import { lancamentos } from '../../db/schema/lancamentos.js';
import { criarLancamentoInterno } from '../lancamentos/core.js';

const HOJE = '2026-09-09';
const BASE = '/api/v1/obrigacoes';

interface Categoria {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  grupoDasn: 'comercio' | 'servicos' | null;
}

async function categoriasDe(ctx: TestApp, s: TenantSession): Promise<Categoria[]> {
  const res = await injectComo(ctx.app, s, { method: 'GET', url: '/api/v1/categorias' });
  return res.json<{ data: Categoria[] }>().data;
}

async function criarReceita(
  ctx: TestApp,
  s: TenantSession,
  categoriaId: string,
  data: string,
  valor: number,
  status: 'pago' | 'pendente' = 'pago',
) {
  return ctx.database.withTx((tx) =>
    criarLancamentoInterno(tx, s.tenantId, {
      tipo: 'receita',
      data,
      valor,
      descricao: `Receita ${data}`,
      categoriaId,
      formaPagamento: 'pix',
      status,
      origem: 'manual',
    }),
  );
}

describe('obrigacoes (hoje = 2026-09-09)', () => {
  let ctx: TestApp;
  let servicos: TenantSession;
  let comercio: TenantSession;
  let ambos: TenantSession;
  let caminhoneiro: TenantSession;

  beforeAll(async () => {
    ctx = await buildTestApp({}, { hoje: () => HOJE });
    servicos = await signupTenant(ctx.app, { atividade: 'servicos', dataAbertura: '2026-03-15' });
    comercio = await signupTenant(ctx.app, { atividade: 'comercio' });
    ambos = await signupTenant(ctx.app, { atividade: 'comercio_servicos' });
    caminhoneiro = await signupTenant(ctx.app, {
      atividade: 'caminhoneiro',
      caminhoneiroTributos: 'icms',
    });
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('parâmetros', () => {
    it('ano exato devolve origem=exato e o DAS do MEI logado', async () => {
      const res = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/parametros?ano=2026`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({
        anoSolicitado: 2026,
        parametros: { ano: 2026, salarioMinimo: 162_100, iss: 500, icms: 100 },
        desatualizado: false,
        confirmar: false,
        origem: 'exato',
        dasMensal: { inss: 8105, icms: 0, iss: 500, total: 8605 },
      });
    });

    it('ano sem linha usa o maior ano anterior (fallback + desatualizado)', async () => {
      const res = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/parametros?ano=2027`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({
        anoSolicitado: 2027,
        parametros: { ano: 2026 },
        desatualizado: true,
        origem: 'fallback',
      });
    });

    it('2025 vem marcado para confirmar; ano sem nenhum anterior → 422', async () => {
      const r2025 = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/parametros?ano=2025`,
      });
      expect(r2025.json().data).toMatchObject({ confirmar: true, origem: 'exato' });
      const r2024 = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/parametros?ano=2024`,
      });
      expect(r2024.statusCode).toBe(422);
    });

    it('sem token → 401', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: `${BASE}/das` });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('DAS mensal', () => {
    it.each([
      ['comercio', 8205, { inss: 8105, icms: 100, iss: 0 }],
      ['servicos', 8605, { inss: 8105, icms: 0, iss: 500 }],
      ['comercio_servicos', 8705, { inss: 8105, icms: 100, iss: 500 }],
      ['caminhoneiro', 19_552, { inss: 19_452, icms: 100, iss: 0, aliquotaInssBp: 1200 }],
    ])('valor 2026 para %s = %i', async (atividade, total, detalhamento) => {
      const sessao = { comercio, servicos, comercio_servicos: ambos, caminhoneiro }[
        atividade as 'comercio'
      ]!;
      const res = await injectComo(ctx.app, sessao, { method: 'GET', url: `${BASE}/das?ano=2026` });
      expect(res.statusCode).toBe(200);
      const { data } = res.json();
      expect(data.atividade).toBe(atividade);
      expect(data.competencias).toHaveLength(12);
      expect(data.competencias[5]).toMatchObject({
        competencia: '2026-06',
        valor: total,
        detalhamento: { ...detalhamento, total },
      });
    });

    it('status por competência: não devida antes da abertura, atrasado, pendente e futuro', async () => {
      const res = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/das?ano=2026`,
      });
      const { data } = res.json();
      const porComp = Object.fromEntries(
        (data.competencias as { competencia: string; diasAtraso: number }[]).map((c) => [
          c.competencia,
          c,
        ]),
      );
      expect(porComp['2026-02']).toMatchObject({ devida: false });
      expect(porComp['2026-03']).toMatchObject({
        devida: true,
        status: 'atrasado',
        vencimento: '2026-04-20',
      });
      // 20/06/2026 é sábado → vence na segunda 22/06.
      expect(porComp['2026-05']).toMatchObject({ status: 'atrasado', vencimento: '2026-06-22' });
      // 20/09/2026 é domingo → 21/09; ainda não venceu em 09/09.
      expect(porComp['2026-08']).toMatchObject({
        status: 'pendente',
        vencimento: '2026-09-21',
        diasAtraso: 0,
      });
      expect(porComp['2026-09']).toMatchObject({ status: 'pendente', vencimento: '2026-10-20' });
      expect(porComp['2026-10']).toMatchObject({ status: 'futuro' });
      expect(porComp['2026-07']!.diasAtraso).toBe(20);
      expect(data.totais).toEqual({
        devido: 7 * 8605,
        pago: 0,
        pendente: 2 * 8605,
        atrasado: 5 * 8605,
        quantidadeAtrasadas: 5,
      });
      expect(data.parametrosDesatualizados).toBe(false);
    });

    it('ano futuro sem parâmetros usa o fallback e marca parametrosDesatualizados', async () => {
      const res = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/das?ano=2027`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.parametrosDesatualizados).toBe(true);
      expect(
        res.json().data.competencias.every((c: { status: string }) => c.status === 'futuro'),
      ).toBe(true);
    });

    it('GET /das/:competencia devolve uma competência; formato inválido → 400', async () => {
      const ok = await injectComo(ctx.app, servicos, { method: 'GET', url: `${BASE}/das/2026-08` });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().data).toMatchObject({ competencia: '2026-08', valor: 8605 });
      const ruim = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/das/2026-13`,
      });
      expect(ruim.statusCode).toBe(400);
    });

    it('marcar como pago cria a despesa na categoria "Impostos e DAS" com origem das', async () => {
      const res = await injectComo(ctx.app, servicos, {
        method: 'POST',
        url: `${BASE}/das/2026-08/pagamento`,
        payload: {},
      });
      expect(res.statusCode).toBe(201);
      const { data } = res.json();
      expect(data.competencia).toMatchObject({
        competencia: '2026-08',
        status: 'pago',
        diasAtraso: 0,
        pagamento: {
          valorCalculado: 8605,
          valorPago: 8605,
          dataPagamento: HOJE,
          formaPagamento: 'pix',
        },
      });
      expect(data.lancamento).toMatchObject({
        tipo: 'despesa',
        valor: 8605,
        descricao: 'DAS MEI 08/2026',
        origem: 'das',
        status: 'pago',
        data: HOJE,
        dataPagamento: HOJE,
        competencia: '2026-08',
        categoria: { nome: 'Impostos e DAS' },
      });
      expect(data.competencia.pagamento.lancamentoId).toBe(data.lancamento.id);

      const config = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: '/api/v1/configuracoes',
      });
      expect(data.lancamento.categoriaId).toBe(config.json().data.categoriaDasId);

      const ano = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/das?ano=2026`,
      });
      expect(ano.json().data.totais).toMatchObject({ pago: 8605, pendente: 8605 });
    });

    it('pagar de novo → 409; competência futura ou anterior à abertura → 422', async () => {
      const repetido = await injectComo(ctx.app, servicos, {
        method: 'POST',
        url: `${BASE}/das/2026-08/pagamento`,
        payload: {},
      });
      expect(repetido.statusCode).toBe(409);
      const futuro = await injectComo(ctx.app, servicos, {
        method: 'POST',
        url: `${BASE}/das/2026-10/pagamento`,
        payload: {},
      });
      expect(futuro.statusCode).toBe(422);
      const antes = await injectComo(ctx.app, servicos, {
        method: 'POST',
        url: `${BASE}/das/2026-02/pagamento`,
        payload: {},
      });
      expect(antes.statusCode).toBe(422);
    });

    it('aceita valor pago diferente (juros), data e forma; valor inválido → 400', async () => {
      const res = await injectComo(ctx.app, servicos, {
        method: 'POST',
        url: `${BASE}/das/2026-03/pagamento`,
        payload: {
          valorPago: 9000,
          dataPagamento: '2026-09-01',
          formaPagamento: 'boleto',
          observacao: 'Com multa e juros',
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.competencia.pagamento).toMatchObject({
        valorCalculado: 8605,
        valorPago: 9000,
        dataPagamento: '2026-09-01',
        formaPagamento: 'boleto',
        observacao: 'Com multa e juros',
      });
      expect(res.json().data.lancamento).toMatchObject({
        valor: 9000,
        formaPagamento: 'boleto',
        observacoes: 'Com multa e juros',
      });
      const ruim = await injectComo(ctx.app, servicos, {
        method: 'POST',
        url: `${BASE}/das/2026-04/pagamento`,
        payload: { valorPago: -1 },
      });
      expect(ruim.statusCode).toBe(400);
    });

    it('desfazer remove o registro e exclui (soft) a despesa; repetir → 404', async () => {
      const antes = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/das/2026-08`,
      });
      const lancamentoId = antes.json().data.pagamento.lancamentoId as string;

      const res = await injectComo(ctx.app, servicos, {
        method: 'DELETE',
        url: `${BASE}/das/2026-08/pagamento`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({
        competencia: '2026-08',
        status: 'pendente',
        pagamento: null,
      });

      const [linha] = await ctx.database.db
        .select()
        .from(lancamentos)
        .where(eq(lancamentos.id, lancamentoId));
      expect(linha?.deletedAt).not.toBeNull();

      const repetido = await injectComo(ctx.app, servicos, {
        method: 'DELETE',
        url: `${BASE}/das/2026-08/pagamento`,
      });
      expect(repetido.statusCode).toBe(404);
    });
  });

  describe('DASN-SIMEI', () => {
    let vendas: Categoria;
    let prestacao: Categoria;
    let outras: Categoria;

    beforeAll(async () => {
      const cats = await categoriasDe(ctx, ambos);
      vendas = cats.find((c) => c.grupoDasn === 'comercio')!;
      prestacao = cats.find((c) => c.grupoDasn === 'servicos')!;
      outras = cats.find((c) => c.tipo === 'receita' && c.grupoDasn === null)!;
      await criarReceita(ctx, ambos, vendas.id, '2025-02-10', 1_000_000);
      await criarReceita(ctx, ambos, vendas.id, '2025-11-05', 500_000);
      await criarReceita(ctx, ambos, prestacao.id, '2025-06-20', 300_000);
      await criarReceita(ctx, ambos, outras.id, '2025-08-01', 20_000);
      // Fora do ano-base: não entra.
      await criarReceita(ctx, ambos, vendas.id, '2026-01-10', 999_999);
    });

    it('apura o faturamento separado por grupo, DAS pendentes e prazo', async () => {
      const res = await injectComo(ctx.app, ambos, { method: 'GET', url: `${BASE}/dasn?ano=2025` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({
        anoBase: 2025,
        faturamentoApurado: 1_820_000,
        receitaComercio: 1_500_000,
        receitaServicos: 300_000,
        receitaSemGrupo: 20_000,
        alertaSemGrupo: true,
        faturamentoDeclarado: null,
        status: 'pendente',
        prazo: '2026-05-31',
        janelaAberta: true,
        atrasada: true,
        excesso: null,
      });
      const { data } = res.json();
      expect(data.diasParaPrazo).toBeLessThan(0);
      expect(data.dasPendentes).toHaveLength(12);
      expect(data.dasPendentes[0]).toBe('2025-01');
      expect(data.percentualLimite).toBeCloseTo(22.47, 1);
    });

    it('ano-base sem ano seguinte iniciado: janela fechada', async () => {
      const res = await injectComo(ctx.app, ambos, { method: 'GET', url: `${BASE}/dasn?ano=2026` });
      expect(res.json().data).toMatchObject({
        anoBase: 2026,
        prazo: '2027-05-31',
        janelaAberta: false,
        atrasada: false,
      });
    });

    it('PUT marca como entregue com snapshot do faturamento; sem data → 400', async () => {
      const semData = await injectComo(ctx.app, ambos, {
        method: 'PUT',
        url: `${BASE}/dasn/2025`,
        payload: { status: 'entregue' },
      });
      expect(semData.statusCode).toBe(400);

      const res = await injectComo(ctx.app, ambos, {
        method: 'PUT',
        url: `${BASE}/dasn/2025`,
        payload: { status: 'entregue', dataEntrega: '2026-05-10', numeroRecibo: 'REC-123' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({
        status: 'entregue',
        dataEntrega: '2026-05-10',
        numeroRecibo: 'REC-123',
        faturamentoDeclarado: 1_820_000,
        atrasada: false,
      });

      const reaberta = await injectComo(ctx.app, ambos, {
        method: 'PUT',
        url: `${BASE}/dasn/2025`,
        payload: { status: 'pendente' },
      });
      expect(reaberta.json().data).toMatchObject({ status: 'pendente', dataEntrega: null });
    });
  });

  describe('limite anual', () => {
    let receitaServicos: Categoria;

    beforeAll(async () => {
      const cats = await categoriasDe(ctx, servicos);
      receitaServicos = cats.find((c) => c.grupoDasn === 'servicos')!;
      await criarReceita(ctx, servicos, receitaServicos.id, '2026-05-10', 3_000_000);
      await criarReceita(ctx, servicos, receitaServicos.id, '2026-06-10', 1_000_000, 'pendente');
    });

    it('MEI aberto em março: limite proporcional de 10 meses (675.000 × 10)', async () => {
      const res = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/limite?ano=2026`,
      });
      expect(res.statusCode).toBe(200);
      const { data } = res.json();
      expect(data).toMatchObject({
        ano: 2026,
        anoAbertura: true,
        mesInicio: 3,
        mesesConsiderados: 10,
        limite: 6_750_000,
        tolerancia: 8_100_000,
        acumulado: 4_000_000,
        restante: 2_750_000,
        nivel: 'ok',
        excesso: null,
        regime: 'competencia',
        marcas: [70, 85, 100],
      });
      expect(data.percentual).toBeCloseTo(59.26, 1);
      expect(data.projecao).toBeGreaterThan(0);
      expect(data.porMes).toHaveLength(12);
      expect(data.porMes[4]).toMatchObject({ competencia: '2026-05', valor: 3_000_000 });
      expect(data.porMes[5]).toMatchObject({
        competencia: '2026-06',
        valor: 1_000_000,
        acumulado: 4_000_000,
      });
    });

    it('MEI sem data de abertura usa o limite cheio', async () => {
      const res = await injectComo(ctx.app, comercio, { method: 'GET', url: `${BASE}/limite` });
      expect(res.json().data).toMatchObject({
        anoAbertura: false,
        limite: 8_100_000,
        acumulado: 0,
        percentual: 0,
      });
    });

    it('regime de caixa ignora receitas pendentes', async () => {
      const patch = await injectComo(ctx.app, servicos, {
        method: 'PATCH',
        url: '/api/v1/configuracoes',
        payload: { regimeApuracao: 'caixa' },
      });
      expect(patch.statusCode).toBe(200);
      const res = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/limite?ano=2026`,
      });
      expect(res.json().data).toMatchObject({ regime: 'caixa', acumulado: 3_000_000 });
      await injectComo(ctx.app, servicos, {
        method: 'PATCH',
        url: '/api/v1/configuracoes',
        payload: { regimeApuracao: 'competencia' },
      });
    });
  });

  describe('calendário', () => {
    it('lista vencimentos de DAS no período (dia útil) e rejeita período invertido', async () => {
      const res = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/calendario?de=2026-09-01&ate=2026-10-31`,
      });
      expect(res.statusCode).toBe(200);
      const eventos = res.json().data as { data: string; tipo: string; titulo: string }[];
      expect(eventos.map((e) => [e.data, e.tipo, e.titulo])).toEqual([
        ['2026-09-21', 'das', 'DAS 08/2026'],
        ['2026-10-20', 'das', 'DAS 09/2026'],
      ]);
      const ruim = await injectComo(ctx.app, servicos, {
        method: 'GET',
        url: `${BASE}/calendario?de=2026-10-01&ate=2026-09-01`,
      });
      expect(ruim.statusCode).toBe(400);
    });

    it('inclui o prazo da DASN quando cai no período', async () => {
      const res = await injectComo(ctx.app, comercio, {
        method: 'GET',
        url: `${BASE}/calendario?de=2026-05-01&ate=2026-05-31`,
      });
      const eventos = res.json().data as { data: string; tipo: string; status: string }[];
      expect(eventos.find((e) => e.tipo === 'dasn')).toMatchObject({
        data: '2026-05-31',
        status: 'atrasado',
      });
    });
  });

  describe('alertas', () => {
    it('gera alertas de DAS atrasado e de limite; sem data de abertura pede o cadastro', async () => {
      const res = await injectComo(ctx.app, servicos, { method: 'GET', url: `${BASE}/alertas` });
      expect(res.statusCode).toBe(200);
      const chaves = (res.json().data as { chave: string; severidade: string }[]).map(
        (a) => a.chave,
      );
      expect(chaves).toContain('das:2026-04:atrasado');
      expect(chaves).toContain('das:2026-07:atrasado');
      expect(chaves).not.toContain('das:2026-03:atrasado'); // pago no teste anterior
      expect(chaves).not.toContain('cadastro:data_abertura_ausente');
      expect(chaves).not.toContain('parametros:2026:desatualizados');
      const primeiro = res.json().data[0];
      expect(primeiro.severidade).toBe('critico');

      const semAbertura = await injectComo(ctx.app, comercio, {
        method: 'GET',
        url: `${BASE}/alertas`,
      });
      const chavesB = (semAbertura.json().data as { chave: string }[]).map((a) => a.chave);
      expect(chavesB).toContain('cadastro:data_abertura_ausente');
      expect(chavesB).toContain('das:2026-01:atrasado');
      // Sem data de abertura e cadastrado em 2026, a DASN 2025 não é cobrada.
      expect(chavesB).not.toContain('dasn:2025:atrasada');
    });

    it('receita em categoria sem grupo dispara dasn:categoria_sem_grupo', async () => {
      const res = await injectComo(ctx.app, ambos, { method: 'GET', url: `${BASE}/alertas` });
      const chaves = (res.json().data as { chave: string }[]).map((a) => a.chave);
      expect(chaves).toContain('dasn:categoria_sem_grupo');
    });

    it('dispensar oculta o alerta até a data; reativar volta a exibir; chave inválida → 400', async () => {
      const chave = 'cadastro:data_abertura_ausente';
      const dispensa = await injectComo(ctx.app, comercio, {
        method: 'POST',
        url: `${BASE}/alertas/${chave}/dispensar`,
        payload: {},
      });
      expect(dispensa.statusCode).toBe(200);
      expect(dispensa.json().data).toEqual({ chave, dispensadoAte: '2026-10-09' });

      const oculto = await injectComo(ctx.app, comercio, { method: 'GET', url: `${BASE}/alertas` });
      expect((oculto.json().data as { chave: string }[]).map((a) => a.chave)).not.toContain(chave);

      const reativa = await injectComo(ctx.app, comercio, {
        method: 'DELETE',
        url: `${BASE}/alertas/${chave}/dispensar`,
      });
      expect(reativa.statusCode).toBe(200);
      const visivel = await injectComo(ctx.app, comercio, {
        method: 'GET',
        url: `${BASE}/alertas`,
      });
      expect((visivel.json().data as { chave: string }[]).map((a) => a.chave)).toContain(chave);

      const denovo = await injectComo(ctx.app, comercio, {
        method: 'DELETE',
        url: `${BASE}/alertas/${chave}/dispensar`,
      });
      expect(denovo.statusCode).toBe(404);

      const invalida = await injectComo(ctx.app, comercio, {
        method: 'POST',
        url: `${BASE}/alertas/nao-e-chave/dispensar`,
        payload: {},
      });
      expect(invalida.statusCode).toBe(400);

      const passado = await injectComo(ctx.app, comercio, {
        method: 'POST',
        url: `${BASE}/alertas/${chave}/dispensar`,
        payload: { ate: '2026-01-01' },
      });
      expect(passado.statusCode).toBe(422);
    });

    it('dispensa expirada volta a exibir o alerta', async () => {
      const chave = 'cadastro:data_abertura_ausente';
      await injectComo(ctx.app, comercio, {
        method: 'POST',
        url: `${BASE}/alertas/${chave}/dispensar`,
        payload: { ate: HOJE },
      });
      const hoje = await injectComo(ctx.app, comercio, { method: 'GET', url: `${BASE}/alertas` });
      expect((hoje.json().data as { chave: string }[]).map((a) => a.chave)).not.toContain(chave);
      await injectComo(ctx.app, comercio, {
        method: 'DELETE',
        url: `${BASE}/alertas/${chave}/dispensar`,
      });
    });
  });
});
