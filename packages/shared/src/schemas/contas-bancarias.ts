// Contratos do módulo "contas-bancarias": cadastro manual das contas do MEI (banco, poupança,
// conta de pagamento ou dinheiro em espécie) com saldo calculado a partir dos lançamentos pagos.
// Não há integração bancária: saldo = saldo inicial + receitas pagas − despesas pagas da conta.
import { z } from 'zod';

import { TIPOS_CONTA_BANCARIA } from '../constants.js';
import {
  booleanoQuery,
  centavos,
  itemResponse,
  listaResponse,
  okResponse,
  textoNulavel,
  timestamp,
  uuid,
} from './common.js';

export const contaBancariaDto = z.object({
  id: uuid,
  nome: z.string(),
  instituicao: z.string().nullable(),
  tipo: z.enum(TIPOS_CONTA_BANCARIA),
  /** Saldo informado no cadastro (centavos; pode ser negativo em conta no vermelho). */
  saldoInicial: centavos,
  ativo: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ContaBancariaDto = z.infer<typeof contaBancariaDto>;

/** Conta + saldo agregado no banco (nunca somado em memória). */
export const contaBancariaSaldoDto = contaBancariaDto.extend({
  /** saldoInicial + receitas − despesas. */
  saldo: centavos,
  /** Receitas pagas vinculadas à conta. */
  receitas: centavos,
  /** Despesas pagas vinculadas à conta. */
  despesas: centavos,
  /** Lançamentos (pagos ou pendentes, não excluídos) vinculados à conta. */
  lancamentos: z.number().int(),
});
export type ContaBancariaSaldoDto = z.infer<typeof contaBancariaSaldoDto>;

/** Versão enxuta para combobox/seletores. */
export const contaBancariaOpcaoDto = z.object({
  id: uuid,
  nome: z.string(),
  instituicao: z.string().nullable(),
  tipo: z.enum(TIPOS_CONTA_BANCARIA),
});
export type ContaBancariaOpcaoDto = z.infer<typeof contaBancariaOpcaoDto>;

const contaBancariaCampos = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome da conta')
    .max(80, 'Nome deve ter no máximo 80 caracteres'),
  instituicao: textoNulavel,
  tipo: z.enum(TIPOS_CONTA_BANCARIA, {
    error: 'Tipo deve ser corrente, poupança, pagamento ou dinheiro',
  }),
  saldoInicial: centavos,
});

export const criarContaBancariaBody = contaBancariaCampos.extend({
  tipo: contaBancariaCampos.shape.tipo.default('corrente'),
  saldoInicial: centavos.default(0),
});
export type CriarContaBancariaBody = z.infer<typeof criarContaBancariaBody>;

export const atualizarContaBancariaBody = contaBancariaCampos
  .partial()
  .extend({ ativo: z.boolean().optional() });
export type AtualizarContaBancariaBody = z.infer<typeof atualizarContaBancariaBody>;

export const listarContasBancariasQuery = z.object({
  /** Omitido = ativas e inativas; true = só ativas; false = só inativas. */
  ativo: booleanoQuery.optional(),
});
export type ListarContasBancariasQuery = z.infer<typeof listarContasBancariasQuery>;

export const contaBancariaResponse = itemResponse(contaBancariaSaldoDto);
export type ContaBancariaResponse = z.infer<typeof contaBancariaResponse>;

export const listaContasBancariasResponse = listaResponse(contaBancariaSaldoDto).extend({
  /** Somatório das contas listadas. */
  totais: z.object({ saldoInicial: centavos, saldo: centavos }),
});
export type ListaContasBancariasResponse = z.infer<typeof listaContasBancariasResponse>;

export const opcoesContasBancariasResponse = listaResponse(contaBancariaOpcaoDto);
export type OpcoesContasBancariasResponse = z.infer<typeof opcoesContasBancariasResponse>;

export const excluirContaBancariaResponse = okResponse;
export type ExcluirContaBancariaResponse = z.infer<typeof excluirContaBancariaResponse>;
