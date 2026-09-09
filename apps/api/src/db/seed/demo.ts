// Seed de demonstração (WP5 / Phase 3 do plano): cria um tenant completo com 12 meses de dados
// determinísticos para o usuário explorar o sistema sem digitar nada. Idempotente: se o e-mail
// demo já existir, não faz nada (roda de novo sem duplicar).
//
// Convenções: reaproveita as regras reais em vez de inserir linhas "cruas" onde existe uma —
// `criarLancamentoInterno` (congelado) para todo lançamento, `registrarPagamento`/`salvarDasn`
// de obrigacoes/service.ts para os DAS e a DASN (mesma lógica que a rota HTTP usa). O período
// coberto é sempre "os últimos 12 meses até hoje", então os valores mensais foram calibrados
// para que o acumulado de jan–hoje do ano corrente fique perto de 79% do limite anual quando
// o script roda perto de setembro (ver MESES_RECEITA); rodando em outro mês o percentual muda,
// o que é esperado — é uma calibração, não uma trava.
import {
  addDias,
  addMesesCompetencia,
  type Competencia,
  competenciaDe,
  gerarParcelas,
  hojeSP,
  type IsoDate,
} from '@meifin/shared';
import { eq } from 'drizzle-orm';

import type { Database } from '../index.js';
import { type CategoriaRow } from '../schema/categorias.js';
import { contatos } from '../schema/contatos.js';
import { notasFiscais } from '../schema/notas-fiscais.js';
import { parcelas, titulos } from '../schema/titulos.js';
import { hashSenha } from '../../lib/senha.js';
import * as authRepo from '../../modules/auth/repository.js';
import * as configRepo from '../../modules/configuracoes/repository.js';
import { criarLancamentoInterno } from '../../modules/lancamentos/core.js';
import { registrarPagamento, salvarDasn } from '../../modules/obrigacoes/service.js';
import { aplicarCategoriasPadrao } from './categorias-padrao.js';

export const DEMO_EMAIL = 'demo@meifin.com.br';
export const DEMO_SENHA = 'Demo@1234';
export const DEMO_NOME = 'Ateliê & Serviços Demo MEI';

export interface DemoSeedResult {
  criado: boolean;
  tenantId?: string;
  contadores?: {
    clientes: number;
    fornecedores: number;
    lancamentos: number;
    notasFiscais: number;
    titulos: number;
    parcelas: number;
    dasPagos: number;
  };
}

// ---------------------------------------------------------------------------
// Dados de referência (determinísticos)
// ---------------------------------------------------------------------------

const CLIENTES = [
  { nome: 'Ana Paula Ribeiro', cidade: 'São Paulo', uf: 'SP' },
  { nome: 'Carlos Eduardo Souza', cidade: 'São Paulo', uf: 'SP' },
  { nome: 'Loja Bela Vista Confecções', cidade: 'Campinas', uf: 'SP' },
  { nome: 'Mercado São José Ltda', cidade: 'São Paulo', uf: 'SP' },
  { nome: 'Fernanda Lima Consultoria', cidade: 'Belo Horizonte', uf: 'MG' },
  { nome: 'Roberto Alves', cidade: 'Osasco', uf: 'SP' },
  { nome: 'Studio Criativo Design', cidade: 'Curitiba', uf: 'PR' },
  { nome: 'Juliana Martins', cidade: 'São Paulo', uf: 'SP' },
] as const;

const FORNECEDORES = [
  { nome: 'Distribuidora Nordeste Ltda', cidade: 'Recife', uf: 'PE' },
  { nome: 'Papelaria Central', cidade: 'São Paulo', uf: 'SP' },
  { nome: 'Gráfica Rápida Express', cidade: 'São Paulo', uf: 'SP' },
  { nome: 'Transportadora Vale Verde', cidade: 'Guarulhos', uf: 'SP' },
  { nome: 'Assessoria Contábil Prime', cidade: 'São Paulo', uf: 'SP' },
  { nome: 'Fornecedora de Embalagens União', cidade: 'Santo André', uf: 'SP' },
] as const;

/**
 * Faturamento mensal (centavos), do mais antigo (índice 0, hoje − 11 meses) ao mais recente
 * (índice 11, mês atual). Os 9 valores mais recentes (jan–set, quando rodado perto de setembro)
 * já descontam os ~R$ 6.000 que as parcelas baixadas de "Projeto de identidade visual" (ver
 * `criarTitulo` abaixo) somam de volta, para o acumulado do ano ficar perto de R$ 64.000 ≈ 79%
 * de R$ 81.000 de limite — ver comentário no topo do arquivo.
 */
const MESES_RECEITA = [
  480_000, 500_000, 550_000, 525_000, 545_000, 575_000, 605_000, 625_000, 645_000, 675_000, 695_000,
  910_000,
] as const;

function diaDoMes(competencia: Competencia, dia: number): IsoDate {
  return `${competencia}-${String(dia).padStart(2, '0')}` as IsoDate;
}

function minIso(a: IsoDate, b: IsoDate): IsoDate {
  return a < b ? a : b;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export async function seedDemo(database: Database, hojeParam?: IsoDate): Promise<DemoSeedResult> {
  const db = database.db;
  const hoje = hojeParam ?? hojeSP();

  const existente = await authRepo.buscarUserPorEmail(db, DEMO_EMAIL);
  if (existente) return { criado: false };

  const mesAtual = competenciaDe(hoje);
  // 12 competências, da mais antiga à mais recente (a mais recente = mês atual).
  const meses = Array.from({ length: 12 }, (_, i) => addMesesCompetencia(mesAtual, i - 11));
  // Abertura no mês mais antigo das 12 competências: nenhum DAS fica devido antes disso (senão
  // sobrariam competências "em atraso" sem lançamento nem pagamento, fora da nossa janela de dados).
  const dataAbertura = diaDoMes(meses[0]!, 1);

  return database.withTx(async (tx) => {
    const tenant = await authRepo.inserirTenant(tx, {
      nome: DEMO_NOME,
      cnpj: null,
      atividade: 'comercio_servicos',
      caminhoneiroTributos: null,
      dataAbertura,
      emailContato: DEMO_EMAIL,
      telefone: '(11) 91234-5678',
    });
    await configRepo.inserirPadrao(tx, tenant.id);
    const senhaHash = await hashSenha(DEMO_SENHA);
    await authRepo.inserirUser(tx, {
      tenantId: tenant.id,
      nome: 'Usuário Demonstração',
      email: DEMO_EMAIL,
      senhaHash,
      role: 'owner',
      ultimoLoginAt: null,
    });
    const categoriasCriadas = await aplicarCategoriasPadrao(tx, tenant.id, 'comercio_servicos');
    const cat = new Map(categoriasCriadas.map((c) => [c.nome, c]));
    const categoriaDas = categoriasCriadas.find((c) => c.sistema);
    if (categoriaDas) {
      await configRepo.atualizarConfiguracoes(tx, tenant.id, { categoriaDasId: categoriaDas.id });
    }
    const nome = (n: string): CategoriaRow => {
      const c = cat.get(n);
      if (!c) throw new Error(`Categoria padrão "${n}" não encontrada no seed demo`);
      return c;
    };

    // ---------------------------------------------------------------- contatos
    const clientes = await tx
      .insert(contatos)
      .values(
        CLIENTES.map((c) => ({
          tenantId: tenant.id,
          tipo: 'cliente' as const,
          nome: c.nome,
          cidade: c.cidade,
          uf: c.uf,
          email: `${c.nome.toLowerCase().replace(/[^a-z]+/g, '.')}@exemplo.com.br`,
          telefone: '(11) 98888-0000',
        })),
      )
      .returning();
    const fornecedores = await tx
      .insert(contatos)
      .values(
        FORNECEDORES.map((f) => ({
          tenantId: tenant.id,
          tipo: 'fornecedor' as const,
          nome: f.nome,
          cidade: f.cidade,
          uf: f.uf,
          email: `contato@${f.nome.toLowerCase().replace(/[^a-z]+/g, '')}.com.br`,
          telefone: '(11) 97777-0000',
        })),
      )
      .returning();

    // ------------------------------------------------------------ lançamentos
    let qtdLancamentos = 0;
    for (let i = 0; i < meses.length; i++) {
      const competencia = meses[i]!;
      const totalMes = MESES_RECEITA[i]!;
      const ehMesAtual = competencia === mesAtual;
      const valorVenda = Math.round(totalMes * 0.6);
      const valorServico = totalMes - valorVenda;
      const clienteVenda = clientes[i % clientes.length]!;
      const clienteServico = clientes[(i + 3) % clientes.length]!;

      await criarLancamentoInterno(tx, tenant.id, {
        tipo: 'receita',
        data: diaDoMes(competencia, 8),
        valor: valorVenda,
        descricao: 'Venda de produtos do mês',
        categoriaId: nome('Venda de produtos').id,
        contatoId: clienteVenda.id,
        formaPagamento: 'cartao',
        status: 'pago',
        origem: 'manual',
      });
      qtdLancamentos++;
      // No mês corrente o segundo recebimento ainda não caiu: fica pendente (mostra em
      // "receitas pendentes" e no fluxo de caixa previsto).
      await criarLancamentoInterno(tx, tenant.id, {
        tipo: 'receita',
        data: diaDoMes(competencia, 22),
        valor: valorServico,
        descricao: 'Prestação de serviços do mês',
        categoriaId: nome('Prestação de serviços').id,
        contatoId: clienteServico.id,
        formaPagamento: 'pix',
        status: ehMesAtual ? 'pendente' : 'pago',
        origem: 'manual',
      });
      qtdLancamentos++;

      const despesas: {
        categoria: string;
        valor: number;
        dia: number;
        descricao: string;
        contatoId?: string | null;
      }[] = [
        { categoria: 'Aluguel', valor: 120_000, dia: 5, descricao: 'Aluguel do ponto comercial' },
        {
          categoria: 'Água, luz e gás',
          valor: 16_000 + (i % 4) * 500,
          dia: 7,
          descricao: 'Contas de água, luz e gás',
        },
        {
          categoria: 'Telefone e internet',
          valor: 9_900,
          dia: 9,
          descricao: 'Internet e telefone',
        },
        {
          categoria: 'Mercadorias e fornecedores',
          valor: Math.round(valorVenda * 0.35),
          dia: 12,
          descricao: 'Compra de mercadorias para revenda',
          contatoId: fornecedores[i % fornecedores.length]!.id,
        },
        {
          categoria: 'Transporte e deslocamento',
          valor: 7_000 + (i % 3) * 500,
          dia: 15,
          descricao: 'Combustível e deslocamentos',
        },
        {
          categoria: 'Taxas bancárias',
          valor: 2_200,
          dia: 21,
          descricao: 'Tarifas da conta PJ',
        },
        {
          categoria: 'Pró-labore (retirada)',
          valor: 150_000,
          dia: 27,
          descricao: 'Retirada do sócio (pró-labore)',
        },
      ];
      if (i % 2 === 0) {
        despesas.push({
          categoria: 'Marketing e divulgação',
          valor: 12_000,
          dia: 18,
          descricao: 'Anúncios em redes sociais',
        });
      }
      for (const d of despesas) {
        const data = diaDoMes(competencia, d.dia);
        // No mês corrente, despesas com dia > hoje ainda não venceram: ficam pendentes.
        const pendente = ehMesAtual && data > hoje;
        await criarLancamentoInterno(tx, tenant.id, {
          tipo: 'despesa',
          data,
          valor: d.valor,
          descricao: d.descricao,
          categoriaId: nome(d.categoria).id,
          contatoId: d.contatoId ?? null,
          formaPagamento: 'boleto',
          status: pendente ? 'pendente' : 'pago',
          origem: 'manual',
        });
        qtdLancamentos++;
      }
    }

    // -------------------------------------------------------------------- DAS
    // Paga os 11 meses mais antigos das 12 competências; o mês corrente fica pendente
    // (aparece no dashboard como "DAS do mês a pagar").
    let dasPagos = 0;
    for (const competencia of meses.slice(0, 11)) {
      const candidato = diaDoMes(addMesesCompetencia(competencia, 1), 5);
      await registrarPagamento(
        tx,
        tenant.id,
        competencia,
        { dataPagamento: minIso(candidato, hoje), observacao: null },
        hoje,
      );
      dasPagos++;
    }

    // DASN do ano-base anterior: entregue (mostra o painel de DASN com um ano já ok).
    const anoBaseAnterior = Number(mesAtual.slice(0, 4)) - 1;
    if (Number(dataAbertura.slice(0, 4)) <= anoBaseAnterior) {
      await salvarDasn(
        tx,
        tenant.id,
        anoBaseAnterior,
        {
          status: 'entregue',
          dataEntrega: `${anoBaseAnterior + 1}-05-20`,
          numeroRecibo: 'REC-DEMO-0001',
        },
        hoje,
      );
    }

    // -------------------------------------------------------------- notas fiscais
    let numeroNota = 1000;
    let qtdNotas = 0;
    const mesesParaNotas = [...meses.slice(-9), ...meses.slice(-9)].slice(0, 14);
    for (let i = 0; i < mesesParaNotas.length; i++) {
      const competencia = mesesParaNotas[i]!;
      const servico = i % 2 === 0;
      const cliente = clientes[i % clientes.length]!;
      await tx.insert(notasFiscais).values({
        tenantId: tenant.id,
        tipo: servico ? 'nfse' : 'nfe',
        numero: String(numeroNota++),
        serie: '1',
        dataEmissao: diaDoMes(competencia, servico ? 22 : 8),
        contatoId: cliente.id,
        valor: servico ? 180_000 : 220_000,
        descricao: servico ? 'Prestação de serviços' : 'Venda de produtos',
        status: 'emitida',
      });
      qtdNotas++;
    }

    // ------------------------------------------------------------ parcelamentos
    let qtdTitulos = 0;
    let qtdParcelas = 0;

    async function criarTitulo(opts: {
      tipo: 'pagar' | 'receber';
      descricao: string;
      contatoId: string;
      categoria: string;
      valorTotal: number;
      numeroParcelas: number;
      dataEmissao: IsoDate;
      primeiroVencimento: IsoDate;
      parcelasPagas: number;
    }): Promise<void> {
      const categoria = nome(opts.categoria);
      const [titulo] = await tx
        .insert(titulos)
        .values({
          tenantId: tenant.id,
          tipo: opts.tipo,
          descricao: opts.descricao,
          contatoId: opts.contatoId,
          categoriaId: categoria.id,
          valorTotal: opts.valorTotal,
          numeroParcelas: opts.numeroParcelas,
          dataEmissao: opts.dataEmissao,
        })
        .returning();
      if (!titulo) throw new Error('INSERT em titulos não devolveu linha');
      qtdTitulos++;

      const geradas = gerarParcelas(opts.valorTotal, opts.numeroParcelas, opts.primeiroVencimento);
      for (const g of geradas) {
        const [parcela] = await tx
          .insert(parcelas)
          .values({
            tenantId: tenant.id,
            tituloId: titulo.id,
            numero: g.numero,
            vencimento: g.vencimento,
            valor: g.valor,
          })
          .returning();
        if (!parcela) throw new Error('INSERT em parcelas não devolveu linha');
        qtdParcelas++;

        if (g.numero <= opts.parcelasPagas) {
          const dataPagamento = minIso(g.vencimento, hoje);
          const lancamento = await criarLancamentoInterno(tx, tenant.id, {
            tipo: opts.tipo === 'receber' ? 'receita' : 'despesa',
            data: dataPagamento,
            valor: g.valor,
            descricao: `${opts.descricao} (${g.numero}/${opts.numeroParcelas})`,
            categoriaId: categoria.id,
            contatoId: opts.contatoId,
            formaPagamento: 'pix',
            status: 'pago',
            dataPagamento,
            origem: 'baixa',
            parcelaId: parcela.id,
          });
          qtdLancamentos++;
          await tx
            .update(parcelas)
            .set({
              status: 'paga',
              lancamentoId: lancamento.id,
              dataPagamento,
              valorPago: g.valor,
              formaPagamento: 'pix',
            })
            .where(eq(parcelas.id, parcela.id));
        }
      }
    }

    const mesRecente = meses.at(-1)!;
    const mesAnterior = meses.at(-2)!;
    const doisMesesAtras = meses.at(-3)!;

    await criarTitulo({
      tipo: 'receber',
      descricao: 'Projeto de identidade visual — Studio Criativo',
      contatoId: clientes[6]!.id,
      categoria: 'Prestação de serviços',
      valorTotal: 900_000,
      numeroParcelas: 3,
      dataEmissao: diaDoMes(doisMesesAtras, 3),
      primeiroVencimento: diaDoMes(doisMesesAtras, 10),
      parcelasPagas: 2,
    });

    await criarTitulo({
      tipo: 'pagar',
      descricao: 'Equipamentos novos — Gráfica Rápida Express',
      contatoId: fornecedores[2]!.id,
      categoria: 'Equipamentos e ferramentas',
      valorTotal: 400_000,
      numeroParcelas: 2,
      dataEmissao: diaDoMes(mesAnterior, 4),
      primeiroVencimento: diaDoMes(mesAnterior, 20),
      parcelasPagas: 1,
    });

    await criarTitulo({
      tipo: 'receber',
      descricao: 'Reforma da loja — Mercado São José',
      contatoId: clientes[3]!.id,
      categoria: 'Venda de produtos',
      valorTotal: 1_600_000,
      numeroParcelas: 4,
      dataEmissao: diaDoMes(mesRecente, 1),
      primeiroVencimento: addDias(hoje, 12),
      parcelasPagas: 0,
    });

    return {
      criado: true,
      tenantId: tenant.id,
      contadores: {
        clientes: clientes.length,
        fornecedores: fornecedores.length,
        lancamentos: qtdLancamentos,
        notasFiscais: qtdNotas,
        titulos: qtdTitulos,
        parcelas: qtdParcelas,
        dasPagos,
      },
    };
  });
}
