// Contratos do módulo "configuracoes" (seção 4 do plano): GET, PATCH (dados do MEI, atividade, regime, alertas, preferências).
import { z } from 'zod';

import { ATIVIDADES, CAMINHONEIRO_TRIBUTOS, REGIMES_APURACAO } from '../constants.js';
import { cnpjInput } from './auth.js';
import {
  emailOpcional,
  endereco,
  enderecoDto,
  isoDate,
  itemResponse,
  telefone,
  timestamp,
  uuid,
} from './common.js';

export const TEMAS = ['claro', 'escuro', 'sistema'] as const;
export type Tema = (typeof TEMAS)[number];

/** Preferências livres do usuário (coluna jsonb). */
export const preferencias = z.object({
  tema: z.enum(TEMAS).default('sistema'),
  /** Oculta valores na tela (modo "privacidade"). */
  ocultarValores: z.boolean().default(false),
  /** Rota inicial após o login. */
  paginaInicial: z.string().trim().max(60).default('/'),
  /** Mostrar tutorial/boas-vindas. */
  mostrarBoasVindas: z.boolean().default(true),
});
export type Preferencias = z.infer<typeof preferencias>;

export const preferenciasDto = z.object({
  tema: z.enum(TEMAS),
  ocultarValores: z.boolean(),
  paginaInicial: z.string(),
  mostrarBoasVindas: z.boolean(),
});
export type PreferenciasDto = z.infer<typeof preferenciasDto>;

export const meiDto = z.object({
  id: uuid,
  nome: z.string(),
  nomeFantasia: z.string().nullable(),
  cnpj: z.string().nullable(),
  atividade: z.enum(ATIVIDADES),
  caminhoneiroTributos: z.enum(CAMINHONEIRO_TRIBUTOS).nullable(),
  dataAbertura: isoDate.nullable(),
  emailContato: z.string().nullable(),
  telefone: z.string().nullable(),
  endereco: enderecoDto,
  ativo: z.boolean(),
  createdAt: timestamp,
});
export type MeiDto = z.infer<typeof meiDto>;

export const configuracoesDto = z.object({
  mei: meiDto,
  regimeApuracao: z.enum(REGIMES_APURACAO),
  diasAlertaVencimento: z.number().int(),
  diasAlertaDas: z.number().int(),
  mostrarProjecao: z.boolean(),
  /** Categoria de sistema usada nos pagamentos de DAS. */
  categoriaDasId: uuid.nullable(),
  preferencias: preferenciasDto,
  updatedAt: timestamp,
});
export type ConfiguracoesDto = z.infer<typeof configuracoesDto>;

export const configuracoesResponse = itemResponse(configuracoesDto);
export type ConfiguracoesResponse = z.infer<typeof configuracoesResponse>;

const diasAlerta = z
  .number()
  .int('Informe um número inteiro de dias')
  .min(0, 'Mínimo de 0 dias')
  .max(90, 'Máximo de 90 dias');

export const atualizarConfiguracoesBody = z
  .object({
    mei: z
      .object({
        nome: z.string().trim().min(2, 'Informe o nome').max(120),
        nomeFantasia: z.string().trim().max(120).nullable(),
        cnpj: cnpjInput.nullable(),
        atividade: z.enum(ATIVIDADES, { error: 'Atividade inválida' }),
        caminhoneiroTributos: z.enum(CAMINHONEIRO_TRIBUTOS).nullable(),
        dataAbertura: isoDate.nullable(),
        emailContato: emailOpcional.nullable(),
        telefone: telefone.nullable(),
        endereco: endereco,
      })
      .partial()
      .optional(),
    regimeApuracao: z.enum(REGIMES_APURACAO, { error: 'Regime inválido' }).optional(),
    diasAlertaVencimento: diasAlerta.optional(),
    diasAlertaDas: diasAlerta.optional(),
    mostrarProjecao: z.boolean().optional(),
    categoriaDasId: uuid.optional(),
    preferencias: preferencias.partial().optional(),
  })
  .superRefine((c, ctx) => {
    const mei = c.mei;
    if (!mei) return;
    if (mei.atividade === 'caminhoneiro' && mei.caminhoneiroTributos === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['mei', 'caminhoneiroTributos'],
        message: 'Informe quais tributos o caminhoneiro recolhe (ICMS, ISS ou ambos)',
      });
    }
    if (
      mei.atividade !== undefined &&
      mei.atividade !== 'caminhoneiro' &&
      mei.caminhoneiroTributos
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['mei', 'caminhoneiroTributos'],
        message: 'Tributos do caminhoneiro só se aplicam à atividade de transporte',
      });
    }
  });
export type AtualizarConfiguracoesBody = z.infer<typeof atualizarConfiguracoesBody>;
