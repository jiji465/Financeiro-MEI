// Schema do formulário de contato e conversões formulário ↔ contrato da API.
// Separado do componente para o Fast Refresh (o .tsx só exporta componentes).
import { type ContatoDto, type CriarContatoBody, TIPOS_CONTATO, UFS } from '@meifin/shared';
import { z } from 'zod';

import { isValidCPFouCNPJ } from '@/lib/format/documento';
import { isValidTelefone } from '@/lib/format/telefone';

const texto = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres`);

export const contatoFormSchema = z.object({
  tipo: z.enum(TIPOS_CONTATO, { error: 'Escolha o tipo de contato' }),
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome')
    .max(120, 'Nome deve ter no máximo 120 caracteres'),
  documento: z.string().refine((v) => !v || isValidCPFouCNPJ(v), 'CPF ou CNPJ inválido'),
  email: z.union([z.literal(''), z.email('E-mail inválido').max(160, 'E-mail muito longo')]),
  telefone: z
    .string()
    .refine((v) => !v || isValidTelefone(v), 'Telefone deve ter DDD + 8 ou 9 dígitos'),
  cep: z.string().refine((v) => !v || v.length === 8, 'CEP deve ter 8 dígitos'),
  logradouro: texto(160),
  numero: texto(20),
  complemento: texto(60),
  bairro: texto(80),
  cidade: texto(80),
  uf: z.union([z.literal(''), z.enum(UFS, { error: 'UF inválida' })]),
  observacoes: texto(2000),
});

export type ContatoFormInput = z.input<typeof contatoFormSchema>;
export type ContatoFormValores = z.output<typeof contatoFormSchema>;

export const CONTATO_FORM_VAZIO: ContatoFormInput = {
  tipo: undefined as unknown as ContatoFormInput['tipo'],
  nome: '',
  documento: '',
  email: '',
  telefone: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  observacoes: '',
};

/** Converte um contato existente nos valores iniciais do formulário. */
export function contatoParaForm(contato: ContatoDto): ContatoFormInput {
  return {
    tipo: contato.tipo,
    nome: contato.nome,
    documento: contato.documento ?? '',
    email: contato.email ?? '',
    telefone: contato.telefone ?? '',
    cep: contato.endereco.cep ?? '',
    logradouro: contato.endereco.logradouro ?? '',
    numero: contato.endereco.numero ?? '',
    complemento: contato.endereco.complemento ?? '',
    bairro: contato.endereco.bairro ?? '',
    cidade: contato.endereco.cidade ?? '',
    uf: (contato.endereco.uf as ContatoFormInput['uf']) ?? '',
    observacoes: contato.observacoes ?? '',
  };
}

/** Corpo enviado à API (criar e editar usam o mesmo formato; campos vazios viram null). */
export function formParaBody(v: ContatoFormValores): CriarContatoBody {
  const endereco: NonNullable<CriarContatoBody['endereco']> = {};
  if (v.logradouro) endereco.logradouro = v.logradouro;
  if (v.numero) endereco.numero = v.numero;
  if (v.complemento) endereco.complemento = v.complemento;
  if (v.bairro) endereco.bairro = v.bairro;
  if (v.cidade) endereco.cidade = v.cidade;
  if (v.uf) endereco.uf = v.uf;
  if (v.cep) endereco.cep = v.cep;
  return {
    tipo: v.tipo,
    nome: v.nome,
    documento: v.documento || null,
    email: v.email || null,
    telefone: v.telefone || null,
    endereco,
    observacoes: v.observacoes || null,
  };
}
