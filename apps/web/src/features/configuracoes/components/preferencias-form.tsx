// Formulário "Preferências": regime de apuração do limite anual, prazos de alerta, categoria usada
// nos pagamentos de DAS e preferências de interface (tema, ocultar valores, tela de boas-vindas).
import { zodResolver } from '@hookform/resolvers/zod';
import { REGIMES_APURACAO, TEMAS, type ConfiguracoesDto } from '@meifin/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormRadioCards, FormRootError, FormSelect, FormSwitch } from '@/components/ui/form-field';
import { REGIME_APURACAO_LABELS, opcoesDe } from '@/lib/labels';

import { categoriasParaOpcoes } from '@/features/referencias/hooks';

import { useAtualizarConfiguracoes, useCategoriasConfig } from '../hooks';
import { aplicarErrosAninhados } from '../utils';

const OPCOES_REGIME = opcoesDe(REGIMES_APURACAO, REGIME_APURACAO_LABELS).map((o) => ({
  ...o,
  descricao:
    o.value === 'competencia'
      ? 'Conta a receita na data do lançamento, mesmo que ainda não tenha recebido.'
      : 'Conta a receita só quando é marcada como paga.',
}));

const TEMA_LABELS: Record<(typeof TEMAS)[number], string> = {
  claro: 'Claro',
  escuro: 'Escuro',
  sistema: 'Igual ao sistema',
};
const OPCOES_TEMA = opcoesDe(TEMAS, TEMA_LABELS);

const DIAS_ALERTA = [3, 5, 7, 10, 15, 30] as const;
const OPCOES_DIAS_ALERTA = DIAS_ALERTA.map((d) => ({ value: String(d), label: `${d} dias antes` }));

const preferenciasSchema = z.object({
  regimeApuracao: z.enum(REGIMES_APURACAO, { error: 'Escolha o regime de apuração' }),
  diasAlertaVencimento: z.string(),
  diasAlertaDas: z.string(),
  mostrarProjecao: z.boolean(),
  categoriaDasId: z.string().optional(),
  tema: z.enum(TEMAS),
  ocultarValores: z.boolean(),
  mostrarBoasVindas: z.boolean(),
});

type PreferenciasForm = z.input<typeof preferenciasSchema>;
type PreferenciasValores = z.output<typeof preferenciasSchema>;

function valoresDe(config: ConfiguracoesDto): PreferenciasForm {
  return {
    regimeApuracao: config.regimeApuracao,
    diasAlertaVencimento: String(config.diasAlertaVencimento),
    diasAlertaDas: String(config.diasAlertaDas),
    mostrarProjecao: config.mostrarProjecao,
    categoriaDasId: config.categoriaDasId ?? '',
    tema: config.preferencias.tema,
    ocultarValores: config.preferencias.ocultarValores,
    mostrarBoasVindas: config.preferencias.mostrarBoasVindas,
  };
}

export function PreferenciasForm({ config }: { config: ConfiguracoesDto }) {
  const atualizar = useAtualizarConfiguracoes('Preferências salvas.');
  const categoriasDespesa = useCategoriasConfig('despesa');
  const form = useForm<PreferenciasForm, unknown, PreferenciasValores>({
    resolver: zodResolver(preferenciasSchema),
    defaultValues: valoresDe(config),
  });

  useEffect(() => {
    form.reset(valoresDe(config));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.updatedAt]);

  const onSubmit = (v: PreferenciasValores) => {
    atualizar.mutate(
      {
        regimeApuracao: v.regimeApuracao,
        diasAlertaVencimento: Number(v.diasAlertaVencimento),
        diasAlertaDas: Number(v.diasAlertaDas),
        mostrarProjecao: v.mostrarProjecao,
        categoriaDasId: v.categoriaDasId || undefined,
        preferencias: {
          tema: v.tema,
          ocultarValores: v.ocultarValores,
          mostrarBoasVindas: v.mostrarBoasVindas,
        },
      },
      { onError: (err) => aplicarErrosAninhados(err, form.setError, 'preferencias') },
    );
  };

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FormRootError errors={form.formState.errors} />

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500">Limite anual e alertas</h2>
        <FormRadioCards
          control={form.control}
          name="regimeApuracao"
          label="Regime de apuração"
          hint="Usado para calcular o limite anual e o faturamento da DASN-SIMEI."
          options={OPCOES_REGIME}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect
            control={form.control}
            name="diasAlertaVencimento"
            label="Avisar contas a vencer com"
            options={OPCOES_DIAS_ALERTA}
          />
          <FormSelect
            control={form.control}
            name="diasAlertaDas"
            label="Avisar DAS a vencer com"
            options={OPCOES_DIAS_ALERTA}
          />
        </div>
        <FormSwitch
          control={form.control}
          name="mostrarProjecao"
          label="Mostrar projeção do limite anual"
          descricao="Estimativa de faturamento até dezembro no card do limite."
        />
        <FormSelect
          control={form.control}
          name="categoriaDasId"
          label="Categoria usada nos pagamentos de DAS"
          hint="Precisa ser uma categoria de despesa. Se não escolher, usamos automaticamente “Impostos e DAS”."
          opcional
          opcaoVazia="Automática (Impostos e DAS)"
          options={categoriasParaOpcoes(categoriasDespesa.data).map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500">Interface</h2>
        <FormSelect control={form.control} name="tema" label="Tema" options={OPCOES_TEMA} />
        <FormSwitch
          control={form.control}
          name="ocultarValores"
          label="Ocultar valores por padrão"
          descricao="Modo privacidade: os valores ficam borrados até você clicar para revelar."
        />
        <FormSwitch
          control={form.control}
          name="mostrarBoasVindas"
          label="Mostrar tutorial de boas-vindas"
        />
      </div>

      <Button type="submit" loading={atualizar.isPending}>
        Salvar preferências
      </Button>
    </form>
  );
}
