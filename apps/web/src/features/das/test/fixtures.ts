// Fábricas de DTOs de obrigações para testes (formas dos contratos em @meifin/shared/schemas/obrigacoes).
// Valores em centavos batem com o seed 2026 do plano: serviços = 8605 (INSS 8105 + ISS 500).
import type {
  AlertaDto,
  ConfiguracoesDto,
  DasAnoDto,
  DasCompetenciaDto,
  DasnDto,
  DetalhamentoDasDto,
  LimiteDto,
  ParametrosMeiDto,
} from '@meifin/shared';

export function criarParametros(sobrescrever: Partial<ParametrosMeiDto> = {}): ParametrosMeiDto {
  return {
    ano: 2026,
    salarioMinimo: 162100,
    aliquotaInssBp: 500,
    aliquotaInssCaminhoneiroBp: 1200,
    icms: 100,
    iss: 500,
    limiteAnual: 8_100_000,
    limiteMensalProporcional: 675_000,
    toleranciaExcessoBp: 2000,
    diaVencimentoDas: 20,
    dasnPrazoDia: 31,
    dasnPrazoMes: 5,
    alertasLimitePct: [70, 85, 100],
    ...sobrescrever,
  };
}

export function criarDetalhamento(
  sobrescrever: Partial<DetalhamentoDasDto> = {},
): DetalhamentoDasDto {
  return {
    inss: 8105,
    icms: 0,
    iss: 500,
    total: 8605,
    aliquotaInssBp: 500,
    salarioMinimo: 162100,
    ...sobrescrever,
  };
}

export function criarCompetencia(
  competencia: string,
  sobrescrever: Partial<DasCompetenciaDto> = {},
): DasCompetenciaDto {
  const [ano, mes] = competencia.split('-').map(Number);
  const mesSeguinte = mes === 12 ? 1 : (mes ?? 1) + 1;
  const anoVencimento = mes === 12 ? (ano ?? 2026) + 1 : ano;
  return {
    competencia,
    devida: true,
    valor: 8605,
    detalhamento: criarDetalhamento(),
    vencimento: `${anoVencimento}-${String(mesSeguinte).padStart(2, '0')}-20`,
    status: 'pendente',
    diasAtraso: 0,
    pagamento: null,
    ...sobrescrever,
  };
}

export function criarDasAno(sobrescrever: Partial<DasAnoDto> = {}): DasAnoDto {
  const competencias = Array.from({ length: 12 }, (_, i) =>
    criarCompetencia(`2026-${String(i + 1).padStart(2, '0')}`),
  );
  return {
    ano: 2026,
    atividade: 'servicos',
    caminhoneiroTributos: null,
    parametros: criarParametros(),
    parametrosDesatualizados: false,
    competencias,
    totais: { devido: 8605 * 8, pago: 0, pendente: 8605 * 8, atrasado: 0, quantidadeAtrasadas: 0 },
    ...sobrescrever,
  };
}

export function criarDasn(sobrescrever: Partial<DasnDto> = {}): DasnDto {
  return {
    anoBase: 2025,
    faturamentoApurado: 0,
    receitaComercio: 0,
    receitaServicos: 0,
    receitaSemGrupo: 0,
    faturamentoDeclarado: null,
    status: 'pendente',
    dataEntrega: null,
    numeroRecibo: null,
    prazo: '2026-05-31',
    janelaAberta: true,
    atrasada: false,
    diasParaPrazo: 90,
    dasPendentes: [],
    alertaSemGrupo: false,
    percentualLimite: 0,
    excesso: null,
    ...sobrescrever,
  };
}

export function criarLimite(sobrescrever: Partial<LimiteDto> = {}): LimiteDto {
  return {
    ano: 2026,
    anoAbertura: false,
    mesInicio: 1,
    mesesConsiderados: 12,
    limite: 8_100_000,
    tolerancia: 9_720_000,
    acumulado: 0,
    restante: 8_100_000,
    percentual: 0,
    nivel: 'ok',
    excesso: null,
    valorExcedido: 0,
    diasDecorridos: 60,
    diasTotais: 365,
    mediaMensal: 0,
    projecao: 0,
    projecaoPercentual: 0,
    projecaoExcede: false,
    consequencia: null,
    regime: 'competencia',
    porMes: [],
    marcas: [70, 85, 100],
    ...sobrescrever,
  };
}

export function criarAlerta(sobrescrever: Partial<AlertaDto> = {}): AlertaDto {
  return {
    chave: 'das:2026-01:vence_em',
    severidade: 'aviso',
    titulo: 'DAS de janeiro vence em breve',
    mensagem: 'O DAS de janeiro/2026 vence em alguns dias.',
    acao: { rotulo: 'Ver DAS', url: '/das' },
    referencia: { tipo: 'das', competencia: '2026-01', ano: null },
    dispensavel: true,
    ...sobrescrever,
  };
}

export function criarConfiguracoes(sobrescrever: Partial<ConfiguracoesDto> = {}): ConfiguracoesDto {
  return {
    mei: {
      id: '22222222-2222-4222-8222-222222222222',
      nome: 'Maria da Silva',
      nomeFantasia: 'Doces da Maria',
      cnpj: null,
      atividade: 'servicos',
      caminhoneiroTributos: null,
      dataAbertura: '2024-03-15',
      emailContato: null,
      telefone: null,
      endereco: {
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        uf: null,
        cep: null,
      },
      ativo: true,
      createdAt: '2024-03-15T10:00:00.000Z',
    },
    regimeApuracao: 'competencia',
    diasAlertaVencimento: 7,
    diasAlertaDas: 7,
    mostrarProjecao: true,
    categoriaDasId: '33333333-3333-4333-8333-333333333333',
    preferencias: {
      tema: 'sistema',
      ocultarValores: false,
      paginaInicial: '/',
      mostrarBoasVindas: true,
    },
    updatedAt: '2024-03-15T10:00:00.000Z',
    ...sobrescrever,
  };
}
