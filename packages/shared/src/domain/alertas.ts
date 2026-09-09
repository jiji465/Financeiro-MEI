// Alertas calculados a cada request (nunca persistidos), com chaves estáveis para dispensa:
//   das:<comp>:vence_em | das:<comp>:atrasado
//   limite:<ano>:70 | 85 | 100 | projecao | excesso_ate_20 | excesso_acima_20
//   dasn:<ano>:prazo | dasn:<ano>:atrasada
//   parcelas:pagar|receber:atrasadas|proximas
//   parametros:<ano>:desatualizados
//   cadastro:data_abertura_ausente
//   dasn:categoria_sem_grupo
import {
  LABEL_TIPO_TITULO,
  type SeveridadeAlerta,
  type StatusDas,
  type StatusDasn,
  type TipoTitulo,
} from '../constants.js';
import { type Competencia, diasEntre, formatData, formatMesAno, type IsoDate } from '../dates.js';
import { type Centavos, formatBRL } from '../money.js';
import type { SituacaoLimite } from './limite.js';

export interface AlertaAcao {
  rotulo: string;
  /** Rota do web (ex.: /das, /contas/pagar). */
  url: string;
}

export interface AlertaReferencia {
  tipo: string;
  competencia: Competencia | null;
  ano: number | null;
}

export interface Alerta {
  chave: string;
  severidade: SeveridadeAlerta;
  titulo: string;
  mensagem: string;
  acao: AlertaAcao | null;
  referencia: AlertaReferencia;
  dispensavel: boolean;
}

export interface DasParaAlerta {
  competencia: Competencia;
  vencimento: IsoDate;
  status: StatusDas;
  valor: Centavos;
}

export interface DasnParaAlerta {
  anoBase: number;
  prazo: IsoDate;
  status: StatusDasn;
  janelaAberta: boolean;
}

export interface GrupoParcelasAlerta {
  quantidade: number;
  valor: Centavos;
}

export interface ParcelasParaAlerta {
  atrasadas: GrupoParcelasAlerta;
  /** Vencem entre hoje e hoje + diasAlertaVencimento. */
  proximas: GrupoParcelasAlerta;
}

export interface ContextoAlertas {
  hoje: IsoDate;
  diasAlertaDas: number;
  diasAlertaVencimento: number;
  das: readonly DasParaAlerta[];
  limite: SituacaoLimite | null;
  dasn: readonly DasnParaAlerta[];
  parcelas: Partial<Record<TipoTitulo, ParcelasParaAlerta>>;
  /** Anos consultados sem linha em parametros_mei. */
  parametrosDesatualizados: readonly number[];
  dataAberturaAusente: boolean;
  /** Existe receita em categoria sem grupo DASN no ano corrente/anterior. */
  receitaSemGrupoDasn: boolean;
  /** Chaves dispensadas pelo usuário (ainda vigentes). */
  dispensados: readonly string[];
}

const ORDEM_SEVERIDADE: Record<SeveridadeAlerta, number> = { critico: 0, aviso: 1, info: 2 };

function alerta(
  chave: string,
  severidade: SeveridadeAlerta,
  titulo: string,
  mensagem: string,
  acao: AlertaAcao | null,
  referencia: AlertaReferencia,
  dispensavel = true,
): Alerta {
  return { chave, severidade, titulo, mensagem, acao, referencia, dispensavel };
}

function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

function alertasDas(ctx: ContextoAlertas): Alerta[] {
  const lista: Alerta[] = [];
  for (const d of ctx.das) {
    const ref: AlertaReferencia = { tipo: 'das', competencia: d.competencia, ano: null };
    const acao: AlertaAcao = { rotulo: 'Ver DAS', url: '/das' };
    const comp = formatMesAno(d.competencia);
    if (d.status === 'atrasado') {
      const dias = diasEntre(d.vencimento, ctx.hoje);
      lista.push(
        alerta(
          `das:${d.competencia}:atrasado`,
          'critico',
          `DAS de ${comp} em atraso`,
          `Venceu em ${formatData(d.vencimento)} (${plural(dias, 'dia', 'dias')} de atraso). Valor: ${formatBRL(d.valor)}. Gere a guia atualizada no portal do Simples Nacional.`,
          acao,
          ref,
          false,
        ),
      );
    } else if (d.status === 'pendente') {
      const dias = diasEntre(ctx.hoje, d.vencimento);
      if (dias <= ctx.diasAlertaDas) {
        const quando = dias === 0 ? 'vence hoje' : `vence em ${plural(dias, 'dia', 'dias')}`;
        lista.push(
          alerta(
            `das:${d.competencia}:vence_em`,
            dias <= 2 ? 'aviso' : 'info',
            `DAS de ${comp} ${quando}`,
            `Vencimento em ${formatData(d.vencimento)}. Valor: ${formatBRL(d.valor)}.`,
            acao,
            ref,
          ),
        );
      }
    }
  }
  return lista;
}

function alertasLimite(ctx: ContextoAlertas): Alerta[] {
  const s = ctx.limite;
  if (!s) return [];
  const lista: Alerta[] = [];
  const ref: AlertaReferencia = { tipo: 'limite', competencia: null, ano: s.ano };
  const acao: AlertaAcao = { rotulo: 'Ver limite', url: '/relatorios/faturamento' };
  const pct = s.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  if (s.excesso === 'acima_20') {
    lista.push(
      alerta(
        `limite:${s.ano}:excesso_acima_20`,
        'critico',
        `Faturamento ultrapassou o limite em mais de 20% (${pct}%)`,
        `Acumulado de ${formatBRL(s.acumulado)} contra o limite de ${formatBRL(s.limite)}. ${s.consequencia ?? ''} Procure um contador.`,
        acao,
        ref,
        false,
      ),
    );
  } else if (s.excesso === 'ate_20') {
    lista.push(
      alerta(
        `limite:${s.ano}:excesso_ate_20`,
        'critico',
        `Faturamento ultrapassou o limite (${pct}%)`,
        `Acumulado de ${formatBRL(s.acumulado)} contra o limite de ${formatBRL(s.limite)}. ${s.consequencia ?? ''}`,
        acao,
        ref,
        false,
      ),
    );
  } else if (s.nivel === 'estourado') {
    lista.push(
      alerta(
        `limite:${s.ano}:100`,
        'critico',
        'Faturamento atingiu 100% do limite anual',
        `Acumulado de ${formatBRL(s.acumulado)}. Qualquer receita adicional em ${s.ano} caracteriza excesso.`,
        acao,
        ref,
      ),
    );
  } else if (s.nivel === 'alerta') {
    lista.push(
      alerta(
        `limite:${s.ano}:85`,
        'aviso',
        `Faturamento em ${pct}% do limite anual`,
        `Restam ${formatBRL(s.restante)} para atingir o limite de ${formatBRL(s.limite)} em ${s.ano}.`,
        acao,
        ref,
      ),
    );
  } else if (s.nivel === 'atencao') {
    lista.push(
      alerta(
        `limite:${s.ano}:70`,
        'info',
        `Faturamento em ${pct}% do limite anual`,
        `Restam ${formatBRL(s.restante)} para atingir o limite de ${formatBRL(s.limite)} em ${s.ano}.`,
        acao,
        ref,
      ),
    );
  }

  if (s.projecaoExcede && s.nivel !== 'estourado' && s.projecao !== null) {
    lista.push(
      alerta(
        `limite:${s.ano}:projecao`,
        'aviso',
        'No ritmo atual, o faturamento vai passar do limite',
        `Projeção para o fim de ${s.ano}: ${formatBRL(s.projecao)} (${(s.projecaoPercentual ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% do limite).`,
        acao,
        ref,
      ),
    );
  }
  return lista;
}

function alertasDasn(ctx: ContextoAlertas): Alerta[] {
  const lista: Alerta[] = [];
  for (const d of ctx.dasn) {
    if (d.status !== 'pendente' || !d.janelaAberta) continue;
    const ref: AlertaReferencia = { tipo: 'dasn', competencia: null, ano: d.anoBase };
    const acao: AlertaAcao = { rotulo: 'Ver DASN', url: '/das?aba=dasn' };
    const dias = diasEntre(ctx.hoje, d.prazo);
    if (dias < 0) {
      lista.push(
        alerta(
          `dasn:${d.anoBase}:atrasada`,
          'critico',
          `DASN-SIMEI ${d.anoBase} não entregue`,
          `O prazo terminou em ${formatData(d.prazo)}. Entregue o quanto antes para evitar multa.`,
          acao,
          ref,
          false,
        ),
      );
    } else {
      lista.push(
        alerta(
          `dasn:${d.anoBase}:prazo`,
          dias <= 30 ? 'aviso' : 'info',
          `DASN-SIMEI ${d.anoBase} pendente`,
          `Prazo de entrega: ${formatData(d.prazo)} (${plural(dias, 'dia', 'dias')}).`,
          acao,
          ref,
        ),
      );
    }
  }
  return lista;
}

function alertasParcelas(ctx: ContextoAlertas): Alerta[] {
  const lista: Alerta[] = [];
  for (const tipo of ['pagar', 'receber'] as const) {
    const p = ctx.parcelas[tipo];
    if (!p) continue;
    const ref: AlertaReferencia = { tipo: `parcelas_${tipo}`, competencia: null, ano: null };
    const acao: AlertaAcao = {
      rotulo: `Ver contas ${LABEL_TIPO_TITULO[tipo].toLowerCase()}`,
      url: `/contas/${tipo}`,
    };
    if (p.atrasadas.quantidade > 0) {
      lista.push(
        alerta(
          `parcelas:${tipo}:atrasadas`,
          tipo === 'pagar' ? 'critico' : 'aviso',
          `${plural(p.atrasadas.quantidade, 'conta', 'contas')} ${LABEL_TIPO_TITULO[tipo].toLowerCase()} em atraso`,
          `Total em atraso: ${formatBRL(p.atrasadas.valor)}.`,
          acao,
          ref,
        ),
      );
    }
    if (p.proximas.quantidade > 0) {
      lista.push(
        alerta(
          `parcelas:${tipo}:proximas`,
          'info',
          `${plural(p.proximas.quantidade, 'conta', 'contas')} ${LABEL_TIPO_TITULO[tipo].toLowerCase()} nos próximos ${plural(ctx.diasAlertaVencimento, 'dia', 'dias')}`,
          `Total: ${formatBRL(p.proximas.valor)}.`,
          acao,
          ref,
        ),
      );
    }
  }
  return lista;
}

function alertasCadastro(ctx: ContextoAlertas): Alerta[] {
  const lista: Alerta[] = [];
  for (const ano of ctx.parametrosDesatualizados) {
    lista.push(
      alerta(
        `parametros:${ano}:desatualizados`,
        'aviso',
        `Parâmetros do MEI para ${ano} ainda não cadastrados`,
        `Os valores de DAS e limite de ${ano} estão sendo estimados com a tabela do ano anterior. Confira o salário mínimo vigente.`,
        null,
        { tipo: 'parametros', competencia: null, ano },
      ),
    );
  }
  if (ctx.dataAberturaAusente) {
    lista.push(
      alerta(
        'cadastro:data_abertura_ausente',
        'aviso',
        'Informe a data de abertura do MEI',
        'Sem a data de abertura, o limite proporcional do primeiro ano e as competências devidas de DAS ficam imprecisos.',
        { rotulo: 'Completar cadastro', url: '/configuracoes' },
        { tipo: 'cadastro', competencia: null, ano: null },
      ),
    );
  }
  if (ctx.receitaSemGrupoDasn) {
    lista.push(
      alerta(
        'dasn:categoria_sem_grupo',
        'aviso',
        'Há receitas em categorias sem grupo da DASN',
        'Classifique as categorias de receita como comércio ou serviços para apurar corretamente a declaração anual.',
        { rotulo: 'Revisar categorias', url: '/configuracoes?aba=categorias' },
        { tipo: 'dasn', competencia: null, ano: null },
      ),
    );
  }
  return lista;
}

/** Gera a lista de alertas (sem os dispensados), ordenada por severidade e depois por chave. */
export function gerarAlertas(ctx: ContextoAlertas): Alerta[] {
  const dispensados = new Set(ctx.dispensados);
  return [
    ...alertasDas(ctx),
    ...alertasLimite(ctx),
    ...alertasDasn(ctx),
    ...alertasParcelas(ctx),
    ...alertasCadastro(ctx),
  ]
    .filter((a) => !dispensados.has(a.chave))
    .sort(
      (a, b) =>
        ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade] ||
        a.chave.localeCompare(b.chave),
    );
}

/** Contagem por severidade (badge do topo). */
export function contarAlertas(alertas: readonly Alerta[]): Record<SeveridadeAlerta, number> {
  const contagem: Record<SeveridadeAlerta, number> = { critico: 0, aviso: 0, info: 0 };
  for (const a of alertas) contagem[a.severidade]++;
  return contagem;
}
