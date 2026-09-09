// Regras de configurações: consistência atividade × tributos do caminhoneiro, CNPJ válido e
// único, categoria DAS precisa ser uma despesa do próprio tenant (senão 404). Contratos: @meifin/shared.
import {
  type AtualizarConfiguracoesBody,
  type ConfiguracoesDto,
  type EnderecoDto,
  type MeiDto,
  preferencias as preferenciasSchema,
  validarCNPJ,
} from '@meifin/shared';

import type { DbExecutor } from '../../db/index.js';
import { categorias } from '../../db/schema/categorias.js';
import type { ConfiguracoesRow, EnderecoJson, TenantRow } from '../../db/schema/tenants.js';
import {
  ConflictError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../lib/errors.js';
import { isoTimestamp } from '../../lib/hoje.js';
import { forTenant } from '../../lib/tenant-db.js';
import { buscarTenantPorCnpj } from '../auth/repository.js';
import * as repo from './repository.js';

export function toEnderecoDto(e: EnderecoJson | null | undefined): EnderecoDto {
  return {
    logradouro: e?.logradouro ?? null,
    numero: e?.numero ?? null,
    complemento: e?.complemento ?? null,
    bairro: e?.bairro ?? null,
    cidade: e?.cidade ?? null,
    uf: e?.uf ?? null,
    cep: e?.cep ?? null,
  };
}

export function toMeiDto(t: TenantRow): MeiDto {
  return {
    id: t.id,
    nome: t.nome,
    nomeFantasia: t.nomeFantasia,
    cnpj: t.cnpj,
    atividade: t.atividade,
    caminhoneiroTributos: t.caminhoneiroTributos,
    dataAbertura: t.dataAbertura,
    emailContato: t.emailContato,
    telefone: t.telefone,
    endereco: toEnderecoDto(t.endereco),
    ativo: t.ativo,
    createdAt: isoTimestamp(t.createdAt) ?? t.createdAt,
  };
}

/** Aplica os defaults do schema de preferências ao jsonb (chaves desconhecidas são descartadas). */
export function normalizarPreferencias(bruto: unknown): ConfiguracoesDto['preferencias'] {
  const resultado = preferenciasSchema.safeParse(bruto ?? {});
  return resultado.success ? resultado.data : preferenciasSchema.parse({});
}

export function toConfiguracoesDto(tenant: TenantRow, cfg: ConfiguracoesRow): ConfiguracoesDto {
  return {
    mei: toMeiDto(tenant),
    regimeApuracao: cfg.regimeApuracao,
    diasAlertaVencimento: cfg.diasAlertaVencimento,
    diasAlertaDas: cfg.diasAlertaDas,
    mostrarProjecao: cfg.mostrarProjecao,
    categoriaDasId: cfg.categoriaDasId,
    preferencias: normalizarPreferencias(cfg.preferencias),
    updatedAt: isoTimestamp(cfg.updatedAt) ?? cfg.updatedAt,
  };
}

export async function obter(exec: DbExecutor, tenantId: string): Promise<ConfiguracoesDto> {
  const { tenant, configuracoes } = await repo.obter(exec, tenantId);
  return toConfiguracoesDto(tenant, configuracoes);
}

const CAMPOS_MEI = [
  'nome',
  'nomeFantasia',
  'cnpj',
  'atividade',
  'caminhoneiroTributos',
  'dataAbertura',
  'emailContato',
  'telefone',
  'endereco',
] as const;

const CAMPOS_CONFIG = [
  'regimeApuracao',
  'diasAlertaVencimento',
  'diasAlertaDas',
  'mostrarProjecao',
  'categoriaDasId',
] as const;

/** Deve rodar dentro de uma transação (tx) para tenant e configurações mudarem juntos. */
export async function atualizar(
  tx: DbExecutor,
  tenantId: string,
  body: AtualizarConfiguracoesBody,
): Promise<ConfiguracoesDto> {
  const atual = await repo.obter(tx, tenantId);
  const mei = body.mei ?? {};

  const atividade = mei.atividade ?? atual.tenant.atividade;
  let tributos =
    mei.caminhoneiroTributos !== undefined
      ? mei.caminhoneiroTributos
      : atual.tenant.caminhoneiroTributos;
  if (atividade === 'caminhoneiro') {
    if (!tributos) {
      throw new UnprocessableError('Informe quais tributos o caminhoneiro recolhe', [
        { campo: 'mei.caminhoneiroTributos', mensagem: 'Obrigatório para caminhoneiro' },
      ]);
    }
  } else {
    tributos = null;
  }

  if (mei.cnpj !== undefined && mei.cnpj !== null && mei.cnpj !== atual.tenant.cnpj) {
    if (!validarCNPJ(mei.cnpj)) {
      throw new ValidationError('CNPJ inválido', [
        { campo: 'mei.cnpj', mensagem: 'CNPJ inválido' },
      ]);
    }
    const outro = await buscarTenantPorCnpj(tx, mei.cnpj);
    if (outro && outro.id !== tenantId) {
      throw new ConflictError('CNPJ já cadastrado em outra conta', [
        { campo: 'mei.cnpj', mensagem: 'CNPJ já cadastrado' },
      ]);
    }
  }

  if (body.categoriaDasId !== undefined) {
    const categoria = await forTenant(tx, tenantId).findByIdOrNull(categorias, body.categoriaDasId);
    if (!categoria) throw new NotFoundError('Categoria não encontrada');
    if (categoria.tipo !== 'despesa') {
      throw new UnprocessableError('A categoria do DAS precisa ser de despesa', [
        { campo: 'categoriaDasId', mensagem: 'Escolha uma categoria de despesa' },
      ]);
    }
  }

  const valoresTenant: Record<string, unknown> = {};
  for (const campo of CAMPOS_MEI) {
    if (mei[campo] !== undefined) valoresTenant[campo] = mei[campo];
  }
  valoresTenant.caminhoneiroTributos = tributos;

  const valoresConfig: Record<string, unknown> = {};
  for (const campo of CAMPOS_CONFIG) {
    if (body[campo] !== undefined) valoresConfig[campo] = body[campo];
  }
  if (body.preferencias !== undefined) {
    valoresConfig.preferencias = normalizarPreferencias({
      ...normalizarPreferencias(atual.configuracoes.preferencias),
      ...body.preferencias,
    });
  }

  const tenant = await repo.atualizarTenant(tx, tenantId, valoresTenant);
  const configuracoes =
    Object.keys(valoresConfig).length > 0
      ? await repo.atualizarConfiguracoes(tx, tenantId, valoresConfig)
      : atual.configuracoes;
  return toConfiguracoesDto(tenant, configuracoes);
}
