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
  totalDoItem,
} from '@meifin/shared';
import { eq } from 'drizzle-orm';

import type { Database } from '../index.js';
import { type CategoriaRow } from '../schema/categorias.js';
import { contasBancarias } from '../schema/contas-bancarias.js';
import { contatos } from '../schema/contatos.js';
import { notasFiscais } from '../schema/notas-fiscais.js';
import { lancamentoItens, produtosServicos } from '../schema/produtos-servicos.js';
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
    contasBancarias: number;
    produtosServicos: number;
    itensDeVenda: number;
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

/**
 * Contas bancárias da demonstração: a conta do dia a dia e o caixa em espécie da loja. Os
 * lançamentos abaixo são distribuídos entre as duas para a tela de contas nascer com saldo.
 */
const CONTAS_BANCARIAS = [
  {
    nome: 'Nubank PJ',
    instituicao: 'Nu Pagamentos S.A.',
    tipo: 'corrente' as const,
    saldoInicial: 350_000,
  },
  {
    nome: 'Caixa da loja',
    instituicao: null,
    tipo: 'dinheiro' as const,
    saldoInicial: 30_000,
  },
] as const;

/**
 * Catálogo da demonstração: três produtos e três serviços. Os três primeiros movimentam vendas
 * todo mês (ver a montagem dos itens abaixo); os outros ficam cadastrados sem movimento, que é o
 * estado normal de boa parte de um catálogo real. "Pacote mensal de design" nasce sem preço
 * padrão de propósito: é o caso de quem combina o valor a cada trabalho.
 */
const CATALOGO = [
  {
    tipo: 'produto' as const,
    nome: 'Bolo de cenoura com cobertura',
    descricao: 'Bolo caseiro de 1,2 kg, cobertura de chocolate.',
    precoPadrao: 4_500,
    unidade: 'un',
  },
  {
    tipo: 'produto' as const,
    nome: 'Camiseta personalizada',
    descricao: 'Camiseta de algodão com estampa sob encomenda.',
    precoPadrao: 3_990,
    unidade: 'un',
  },
  {
    tipo: 'produto' as const,
    nome: 'Caneca personalizada',
    descricao: null,
    precoPadrao: 2_500,
    unidade: 'un',
  },
  {
    tipo: 'servico' as const,
    nome: 'Pacote mensal de design',
    descricao: 'Peças para redes sociais; o valor é combinado a cada mês.',
    precoPadrao: null,
    unidade: 'mês',
  },
  {
    tipo: 'servico' as const,
    nome: 'Hora de consultoria',
    descricao: null,
    precoPadrao: 9_000,
    unidade: 'h',
  },
  {
    tipo: 'servico' as const,
    nome: 'Ajuste de roupa sob medida',
    descricao: null,
    precoPadrao: 3_500,
    unidade: 'un',
  },
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

    // ------------------------------------------------------ contas bancárias
    const contas = await tx
      .insert(contasBancarias)
      .values(CONTAS_BANCARIAS.map((c) => ({ tenantId: tenant.id, ...c })))
      .returning();
    const contaCorrente = contas[0]!;
    const contaCaixa = contas[1]!;

    // ---------------------------------------------------- catálogo (produtos/serviços)
    const catalogo = await tx
      .insert(produtosServicos)
      .values(CATALOGO.map((p) => ({ tenantId: tenant.id, ...p })))
      .returning();
    const itemDoCatalogo = (nomeItem: string) => {
      const encontrado = catalogo.find((p) => p.nome === nomeItem);
      if (!encontrado) throw new Error(`Item "${nomeItem}" não encontrado no catálogo demo`);
      return encontrado;
    };
    const bolo = itemDoCatalogo('Bolo de cenoura com cobertura');
    const camiseta = itemDoCatalogo('Camiseta personalizada');
    const pacoteDesign = itemDoCatalogo('Pacote mensal de design');
    let qtdItens = 0;

    /**
     * Grava os itens de uma venda. A soma dos totais TEM que bater com o valor do lançamento
     * (a API recusa o contrário), então aqui é o valor que sai dos itens — nunca o contrário.
     */
    const gravarItens = async (
      lancamentoId: string,
      linhas: { produtoServicoId: string; quantidade: number; valorUnitario: number }[],
    ) => {
      await tx.insert(lancamentoItens).values(
        linhas.map((l, ordem) => ({
          tenantId: tenant.id,
          lancamentoId,
          ...l,
          valorTotal: totalDoItem(l.quantidade, l.valorUnitario),
          ordem,
        })),
      );
      qtdItens += linhas.length;
    };

    // ------------------------------------------------------------ lançamentos
    let qtdLancamentos = 0;
    for (let i = 0; i < meses.length; i++) {
      const competencia = meses[i]!;
      const totalMes = MESES_RECEITA[i]!;
      const ehMesAtual = competencia === mesAtual;
      // A venda do mês é composta de bolos + camisetas: em vez de fatiar o faturamento em 60/40
      // e inventar itens que não fecham, as quantidades saem de ~60% do mês e o VALOR sai delas.
      // O que sobra vai para a prestação de serviços, então o total do mês não muda.
      const alvoVenda = Math.round(totalMes * 0.6);
      const qtdBolos = Math.max(1, Math.floor((alvoVenda * 0.6) / bolo.precoPadrao!));
      const qtdCamisetas = Math.max(
        1,
        Math.floor((alvoVenda - qtdBolos * bolo.precoPadrao!) / camiseta.precoPadrao!),
      );
      const itensDaVenda = [
        {
          produtoServicoId: bolo.id,
          quantidade: qtdBolos * 1000,
          valorUnitario: bolo.precoPadrao!,
        },
        {
          produtoServicoId: camiseta.id,
          quantidade: qtdCamisetas * 1000,
          valorUnitario: camiseta.precoPadrao!,
        },
      ];
      const valorVenda = itensDaVenda.reduce(
        (soma, l) => soma + totalDoItem(l.quantidade, l.valorUnitario),
        0,
      );
      const valorServico = totalMes - valorVenda;
      const clienteVenda = clientes[i % clientes.length]!;
      const clienteServico = clientes[(i + 3) % clientes.length]!;

      const venda = await criarLancamentoInterno(tx, tenant.id, {
        tipo: 'receita',
        data: diaDoMes(competencia, 8),
        valor: valorVenda,
        descricao: 'Venda de produtos do mês',
        categoriaId: nome('Venda de produtos').id,
        contatoId: clienteVenda.id,
        contaBancariaId: contaCorrente.id,
        formaPagamento: 'cartao',
        status: 'pago',
        origem: 'manual',
      });
      await gravarItens(venda.id, itensDaVenda);
      qtdLancamentos++;
      // No mês corrente o segundo recebimento ainda não caiu: fica pendente (mostra em
      // "receitas pendentes" e no fluxo de caixa previsto).
      const servico = await criarLancamentoInterno(tx, tenant.id, {
        tipo: 'receita',
        data: diaDoMes(competencia, 22),
        valor: valorServico,
        descricao: 'Prestação de serviços do mês',
        categoriaId: nome('Prestação de serviços').id,
        contatoId: clienteServico.id,
        contaBancariaId: contaCorrente.id,
        formaPagamento: 'pix',
        status: ehMesAtual ? 'pendente' : 'pago',
        origem: 'manual',
      });
      // Um pacote de design fechado no mês: preço combinado (o item não tem preço padrão).
      await gravarItens(servico.id, [
        { produtoServicoId: pacoteDesign.id, quantidade: 1000, valorUnitario: valorServico },
      ]);
      qtdLancamentos++;

      const despesas: {
        categoria: string;
        valor: number;
        dia: number;
        descricao: string;
        contatoId?: string | null;
        /** Omitido = conta corrente. */
        contaBancariaId?: string;
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
          contaBancariaId: contaCaixa.id,
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
          contaBancariaId: d.contaBancariaId ?? contaCorrente.id,
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
        contasBancarias: contas.length,
        produtosServicos: catalogo.length,
        itensDeVenda: qtdItens,
        notasFiscais: qtdNotas,
        titulos: qtdTitulos,
        parcelas: qtdParcelas,
        dasPagos,
      },
    };
  });
}
