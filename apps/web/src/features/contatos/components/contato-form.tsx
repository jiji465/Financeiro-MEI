// Formulário de cliente/fornecedor (criar e editar). Os campos são strings simples no formulário
// (máscaras guardam o valor "cru"); schema e conversões em contato-form-schema.ts.
import { zodResolver } from '@hookform/resolvers/zod';
import { type CriarContatoBody, UFS } from '@meifin/shared';
import { Building2, Handshake, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import {
  FormInput,
  FormMaskedInput,
  FormRadioCards,
  FormRootError,
  FormSelect,
  FormTextarea,
} from '@/components/ui/form-field';
import { aplicarErrosDoServidor } from '@/lib/api/errors';
import { buscarCEP } from '@/lib/format/cep';
import { TIPO_CONTATO_LABELS } from '@/lib/labels';

import {
  CONTATO_FORM_VAZIO,
  type ContatoFormInput,
  type ContatoFormValores,
  contatoFormSchema,
  formParaBody,
} from './contato-form-schema';

const OPCOES_TIPO = [
  {
    value: 'cliente' as const,
    label: TIPO_CONTATO_LABELS.cliente,
    descricao: 'Quem compra de você (gera receitas)',
    icone: <UserRound aria-hidden="true" />,
  },
  {
    value: 'fornecedor' as const,
    label: TIPO_CONTATO_LABELS.fornecedor,
    descricao: 'De quem você compra (gera despesas)',
    icone: <Building2 aria-hidden="true" />,
  },
  {
    value: 'ambos' as const,
    label: TIPO_CONTATO_LABELS.ambos,
    descricao: 'Compra e vende com você',
    icone: <Handshake aria-hidden="true" />,
  },
];

const OPCOES_UF = UFS.map((uf) => ({ value: uf, label: uf }));

export interface ContatoFormProps {
  defaultValues?: ContatoFormInput;
  onSubmit: (body: CriarContatoBody) => Promise<unknown>;
  submitting?: boolean;
  submitLabel?: string;
  cancelarPara?: string;
}

export function ContatoForm({
  defaultValues = CONTATO_FORM_VAZIO,
  onSubmit,
  submitting,
  submitLabel = 'Salvar',
  cancelarPara = '/contatos',
}: ContatoFormProps) {
  const form = useForm<ContatoFormInput, unknown, ContatoFormValores>({
    resolver: zodResolver(contatoFormSchema),
    defaultValues,
  });
  const { control, setValue, getValues } = form;

  // ViaCEP: ao completar 8 dígitos preenche logradouro/bairro/cidade/UF.
  const cep = useWatch({ control, name: 'cep' }) ?? '';
  const ultimoCepBuscado = useRef(defaultValues.cep ?? '');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoCep, setAvisoCep] = useState<string | null>(null);

  useEffect(() => {
    if (cep.length !== 8 || cep === ultimoCepBuscado.current) return;
    ultimoCepBuscado.current = cep;
    const controller = new AbortController();
    setBuscandoCep(true);
    setAvisoCep(null);
    buscarCEP(cep, { signal: controller.signal })
      .then((endereco) => {
        if (!endereco) {
          setAvisoCep('CEP não encontrado. Preencha o endereço manualmente.');
          return;
        }
        const opcoes = { shouldDirty: true };
        if (endereco.logradouro) setValue('logradouro', endereco.logradouro, opcoes);
        if (endereco.bairro) setValue('bairro', endereco.bairro, opcoes);
        if (endereco.cidade) setValue('cidade', endereco.cidade, opcoes);
        if (endereco.uf) setValue('uf', endereco.uf as ContatoFormInput['uf'], opcoes);
        if (endereco.complemento && !getValues('complemento')) {
          setValue('complemento', endereco.complemento, opcoes);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setAvisoCep(err instanceof Error ? err.message : 'Não foi possível consultar o CEP.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setBuscandoCep(false);
      });
    return () => controller.abort();
  }, [cep, setValue, getValues]);

  const submit = (valores: ContatoFormValores) =>
    onSubmit(formParaBody(valores)).catch((err: unknown) => {
      aplicarErrosDoServidor(err, form.setError);
    });

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(submit)} noValidate>
      <FormRootError errors={form.formState.errors} />

      <section className="space-y-4" aria-labelledby="contato-identificacao">
        <h2 id="contato-identificacao" className="text-base font-semibold">
          Identificação
        </h2>
        <FormRadioCards
          control={control}
          name="tipo"
          label="Tipo de contato"
          options={OPCOES_TIPO}
          columns={3}
        />
        <FormInput
          control={control}
          name="nome"
          label="Nome ou razão social"
          autoComplete="organization"
          placeholder="Ex.: Maria da Silva ou Padaria Central"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormMaskedInput
            control={control}
            name="documento"
            mask="cpfCnpj"
            label="CPF ou CNPJ"
            opcional
            hint="Usado para evitar cadastros duplicados."
          />
          <FormMaskedInput
            control={control}
            name="telefone"
            mask="telefone"
            label="Telefone"
            opcional
            autoComplete="tel"
          />
        </div>
        <FormInput
          control={control}
          name="email"
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          opcional
          placeholder="contato@exemplo.com.br"
        />
      </section>

      <section className="space-y-4" aria-labelledby="contato-endereco">
        <h2 id="contato-endereco" className="text-base font-semibold">
          Endereço <span className="font-normal text-zinc-500">(opcional)</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormMaskedInput
            control={control}
            name="cep"
            mask="cep"
            label="CEP"
            autoComplete="postal-code"
            hint={
              buscandoCep
                ? 'Consultando CEP…'
                : (avisoCep ?? 'Preenche o endereço automaticamente.')
            }
            aria-busy={buscandoCep || undefined}
          />
          <FormInput
            control={control}
            name="logradouro"
            label="Logradouro"
            className="sm:col-span-2"
            autoComplete="address-line1"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormInput control={control} name="numero" label="Número" inputMode="numeric" />
          <FormInput
            control={control}
            name="complemento"
            label="Complemento"
            className="sm:col-span-2"
            autoComplete="address-line2"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormInput control={control} name="bairro" label="Bairro" />
          <FormInput control={control} name="cidade" label="Cidade" autoComplete="address-level2" />
          <FormSelect
            control={control}
            name="uf"
            label="UF"
            options={OPCOES_UF}
            opcaoVazia="Não informada"
            placeholder="UF"
          />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="contato-observacoes">
        <h2 id="contato-observacoes" className="text-base font-semibold">
          Observações
        </h2>
        <FormTextarea
          control={control}
          name="observacoes"
          label="Anotações sobre o contato"
          opcional
          placeholder="Condições de pagamento, horário de atendimento, contato principal…"
          rows={3}
        />
      </section>

      <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
        <Button variant="outline" asChild>
          <Link to={cancelarPara}>Cancelar</Link>
        </Button>
        <Button type="submit" loading={submitting || form.formState.isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
