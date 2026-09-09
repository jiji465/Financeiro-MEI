// Formulário "Dados do MEI": nome, CNPJ, atividade (define os tributos do DAS), data de abertura
// (define o limite proporcional no ano de abertura) e endereço. Envia sempre o objeto `mei` inteiro.
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ATIVIDADES,
  CAMINHONEIRO_TRIBUTOS,
  hojeSP,
  isoDate,
  type ConfiguracoesDto,
  UFS,
} from '@meifin/shared';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormDateInput,
  FormInput,
  FormMaskedInput,
  FormRadioCards,
  FormRootError,
  FormSelect,
} from '@/components/ui/form-field';
import { isValidCNPJ } from '@/lib/format/documento';
import {
  ATIVIDADE_DESCRICOES,
  ATIVIDADE_LABELS,
  CAMINHONEIRO_TRIBUTOS_LABELS,
  opcoesDe,
} from '@/lib/labels';

import { useAtualizarConfiguracoes } from '../hooks';
import { aplicarErrosAninhados } from '../utils';

const OPCOES_ATIVIDADE = ATIVIDADES.map((value) => ({
  value,
  label: ATIVIDADE_LABELS[value],
  descricao: ATIVIDADE_DESCRICOES[value],
}));
const OPCOES_TRIBUTOS = opcoesDe(CAMINHONEIRO_TRIBUTOS, CAMINHONEIRO_TRIBUTOS_LABELS);
const OPCOES_UF = UFS.map((uf) => ({ value: uf, label: uf }));

const meiSchema = z
  .object({
    nome: z.string().trim().min(2, 'Informe o nome').max(120, 'Nome muito longo'),
    nomeFantasia: z.string().trim().max(120, 'Máximo de 120 caracteres').optional(),
    cnpj: z
      .string()
      .optional()
      .refine((v) => !v || isValidCNPJ(v), 'CNPJ inválido'),
    atividade: z.enum(ATIVIDADES, { error: 'Escolha a atividade do seu MEI' }),
    caminhoneiroTributos: z.enum(CAMINHONEIRO_TRIBUTOS).optional(),
    dataAbertura: z
      .union([z.literal(''), isoDate])
      .optional()
      .refine((v) => !v || v <= hojeSP(), 'A data de abertura não pode ser futura'),
    emailContato: z.union([z.literal(''), z.email('E-mail inválido')]).optional(),
    telefone: z
      .string()
      .optional()
      .refine((v) => !v || /^\d{10,11}$/.test(v), 'Telefone deve ter DDD + 8 ou 9 dígitos'),
    cep: z
      .string()
      .optional()
      .refine((v) => !v || /^\d{8}$/.test(v), 'CEP deve ter 8 dígitos'),
    logradouro: z.string().trim().max(160).optional(),
    numero: z.string().trim().max(20).optional(),
    complemento: z.string().trim().max(60).optional(),
    bairro: z.string().trim().max(80).optional(),
    cidade: z.string().trim().max(80).optional(),
    uf: z.string().optional(),
  })
  .refine((v) => v.atividade !== 'caminhoneiro' || v.caminhoneiroTributos !== undefined, {
    path: ['caminhoneiroTributos'],
    message: 'Informe quais tributos o caminhoneiro recolhe (ICMS, ISS ou ambos)',
  });

type MeiForm = z.input<typeof meiSchema>;
type MeiValores = z.output<typeof meiSchema>;

function valoresDe(config: ConfiguracoesDto): MeiForm {
  const { mei } = config;
  return {
    nome: mei.nome,
    nomeFantasia: mei.nomeFantasia ?? '',
    cnpj: mei.cnpj ?? '',
    atividade: mei.atividade,
    caminhoneiroTributos: mei.caminhoneiroTributos ?? undefined,
    dataAbertura: mei.dataAbertura ?? '',
    emailContato: mei.emailContato ?? '',
    telefone: mei.telefone ?? '',
    cep: mei.endereco.cep ?? '',
    logradouro: mei.endereco.logradouro ?? '',
    numero: mei.endereco.numero ?? '',
    complemento: mei.endereco.complemento ?? '',
    bairro: mei.endereco.bairro ?? '',
    cidade: mei.endereco.cidade ?? '',
    uf: mei.endereco.uf ?? '',
  };
}

export function MeiForm({ config }: { config: ConfiguracoesDto }) {
  const atualizar = useAtualizarConfiguracoes('Dados do MEI salvos.');
  const form = useForm<MeiForm, unknown, MeiValores>({
    resolver: zodResolver(meiSchema),
    defaultValues: valoresDe(config),
  });
  const atividade = useWatch({ control: form.control, name: 'atividade' });

  useEffect(() => {
    form.reset(valoresDe(config));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.updatedAt]);

  const onSubmit = (v: MeiValores) => {
    atualizar.mutate(
      {
        mei: {
          nome: v.nome,
          nomeFantasia: v.nomeFantasia || null,
          cnpj: v.cnpj || null,
          atividade: v.atividade,
          caminhoneiroTributos:
            v.atividade === 'caminhoneiro' ? (v.caminhoneiroTributos ?? null) : null,
          dataAbertura: v.dataAbertura || null,
          emailContato: v.emailContato || null,
          telefone: v.telefone || null,
          endereco: {
            logradouro: v.logradouro || undefined,
            numero: v.numero || undefined,
            complemento: v.complemento || undefined,
            bairro: v.bairro || undefined,
            cidade: v.cidade || undefined,
            uf: (v.uf || undefined) as (typeof UFS)[number] | undefined,
            cep: v.cep || undefined,
          },
        },
      },
      { onError: (err) => aplicarErrosAninhados(err, form.setError, 'mei') },
    );
  };

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FormRootError errors={form.formState.errors} />

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500">Identificação</h2>
        <FormInput control={form.control} name="nome" label="Nome" autoComplete="name" />
        <FormInput
          control={form.control}
          name="nomeFantasia"
          label="Nome fantasia"
          opcional
          placeholder="Como o negócio é conhecido"
        />
        <FormMaskedInput control={form.control} name="cnpj" mask="cnpj" label="CNPJ" opcional />
        <FormDateInput
          control={form.control}
          name="dataAbertura"
          label="Data de abertura do MEI"
          opcional
          max={hojeSP()}
          hint="Usada para calcular o limite proporcional no ano de abertura e as competências devidas de DAS."
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500">Atividade</h2>
        <FormRadioCards
          control={form.control}
          name="atividade"
          label="Atividade do MEI"
          hint="Define quais tributos entram no DAS mensal."
          options={OPCOES_ATIVIDADE}
        />
        {atividade === 'caminhoneiro' ? (
          <FormRadioCards
            control={form.control}
            name="caminhoneiroTributos"
            label="Tributos do MEI Caminhoneiro"
            options={OPCOES_TRIBUTOS}
          />
        ) : null}
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500">Contato</h2>
        <FormInput
          control={form.control}
          name="emailContato"
          label="E-mail de contato"
          type="email"
          opcional
        />
        <FormMaskedInput
          control={form.control}
          name="telefone"
          mask="telefone"
          label="Telefone"
          opcional
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500">Endereço</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormMaskedInput control={form.control} name="cep" mask="cep" label="CEP" opcional />
          <FormInput control={form.control} name="logradouro" label="Logradouro" opcional />
          <FormInput control={form.control} name="numero" label="Número" opcional />
          <FormInput control={form.control} name="complemento" label="Complemento" opcional />
          <FormInput control={form.control} name="bairro" label="Bairro" opcional />
          <FormInput control={form.control} name="cidade" label="Cidade" opcional />
          <FormSelect
            control={form.control}
            name="uf"
            label="UF"
            opcional
            options={OPCOES_UF}
            opcaoVazia="Selecione"
          />
        </div>
      </div>

      <Button type="submit" loading={atualizar.isPending}>
        Salvar dados do MEI
      </Button>
    </form>
  );
}
