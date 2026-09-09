// Campos de formulário integrados ao react-hook-form. FormField cuida de id, label, hint,
// mensagem de erro e da ligação aria (aria-invalid / aria-describedby) automaticamente.
//
//   <FormInput control={control} name="email" label="E-mail" type="email" />
//   <FormMoneyInput control={control} name="valor" label="Valor" />
//   <FormField control={control} name="categoriaId" label="Categoria"
//     render={({ field, id, invalid, describedBy }) => <Combobox id={id} aria-invalid={invalid} … />} />
import {
  Controller,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldErrors,
  type FieldPath,
  type FieldValues,
  useFormContext,
} from 'react-hook-form';
import { type HTMLAttributes, type ReactElement, type ReactNode, useId } from 'react';

import { cn } from '@/lib/utils/cn';

import { Checkbox, type CheckboxProps } from './checkbox';
import { Combobox, type ComboboxProps } from './combobox';
import { DateInput, type DateInputProps } from './date-input';
import { Input, type InputProps } from './input';
import { Label } from './label';
import { MaskedInput, type MaskedInputProps } from './masked-input';
import { MoneyInput, type MoneyInputProps } from './money-input';
import { RadioCards, type RadioCardsProps } from './radio-cards';
import { SimpleSelect, type SimpleSelectProps } from './select';
import { Switch, type SwitchProps } from './switch';
import { Textarea, type TextareaProps } from './textarea';

/* ------------------------------------------------------------------ */
/* Layout básico (sem react-hook-form)                                 */
/* ------------------------------------------------------------------ */

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  opcional?: boolean;
  /** Para grupos (RadioCards) o rótulo vira um <span> ligado por aria-labelledby. */
  grupo?: boolean;
  children: ReactNode;
}

export function fieldIds(id: string) {
  return { hintId: `${id}-hint`, errorId: `${id}-error`, labelId: `${id}-label` };
}

export function Field({
  id,
  label,
  hint,
  error,
  opcional,
  grupo,
  children,
  className,
  ...props
}: FieldProps) {
  const { hintId, errorId, labelId } = fieldIds(id);
  return (
    <div className={cn('grid gap-1.5', className)} {...props}>
      {label ? (
        grupo ? (
          <span id={labelId} className="text-sm leading-none font-medium">
            {label}
            {opcional ? <span className="ml-1 font-normal text-zinc-500">(opcional)</span> : null}
          </span>
        ) : (
          <Label htmlFor={id} opcional={opcional}>
            {label}
          </Label>
        )
      ) : null}
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-perigo-700" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FormField genérico (Controller)                                     */
/* ------------------------------------------------------------------ */

export interface FormFieldRenderArgs<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  id: string;
  invalid: boolean;
  /** ids de hint/erro para aria-describedby (undefined quando não há nenhum). */
  describedBy: string | undefined;
  /** id do rótulo (para grupos com aria-labelledby). */
  labelId: string;
}

export interface FormFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> {
  name: TName;
  /** Opcional dentro de <FormProvider>. */
  control?: Control<TFieldValues>;
  label?: ReactNode;
  hint?: ReactNode;
  opcional?: boolean;
  grupo?: boolean;
  className?: string;
  id?: string;
  render: (args: FormFieldRenderArgs<TFieldValues, TName>) => ReactElement;
}

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  label,
  hint,
  opcional,
  grupo,
  className,
  id: idProp,
  render,
}: FormFieldProps<TFieldValues, TName>) {
  const autoId = useId();
  const id = idProp ?? `campo-${autoId}`;
  const contexto = useFormContext<TFieldValues>();
  const resolvido = control ?? contexto?.control;
  if (!resolvido) {
    throw new Error(`FormField "${name}" precisa de "control" ou de um <FormProvider>`);
  }
  const { hintId, errorId, labelId } = fieldIds(id);
  return (
    <Controller
      name={name}
      control={resolvido}
      render={({ field, fieldState }) => {
        const invalid = Boolean(fieldState.error);
        const describedBy =
          [invalid ? errorId : null, hint && !invalid ? hintId : null].filter(Boolean).join(' ') ||
          undefined;
        return (
          <Field
            id={id}
            label={label}
            hint={hint}
            error={fieldState.error?.message}
            opcional={opcional}
            grupo={grupo}
            className={className}
          >
            {render({ field, fieldState, id, invalid, describedBy, labelId })}
          </Field>
        );
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Atalhos por tipo de campo                                           */
/* ------------------------------------------------------------------ */

type Base<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = Omit<
  FormFieldProps<TFieldValues, TName>,
  'render' | 'grupo'
>;

export function FormInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  label,
  hint,
  opcional,
  className,
  id,
  ...inputProps
}: Base<TFieldValues, TName> & Omit<InputProps, 'name' | 'id'>) {
  return (
    <FormField
      name={name}
      control={control}
      label={label}
      hint={hint}
      opcional={opcional}
      className={className}
      id={id}
      render={({ field, id: fid, invalid, describedBy }) => (
        <Input
          {...inputProps}
          id={fid}
          name={field.name}
          ref={field.ref}
          value={(field.value as string | number | undefined) ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={inputProps.disabled ?? field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    />
  );
}

export function FormTextarea<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  label,
  hint,
  opcional,
  className,
  id,
  ...textareaProps
}: Base<TFieldValues, TName> & Omit<TextareaProps, 'name' | 'id'>) {
  return (
    <FormField
      name={name}
      control={control}
      label={label}
      hint={hint}
      opcional={opcional}
      className={className}
      id={id}
      render={({ field, id: fid, invalid, describedBy }) => (
        <Textarea
          {...textareaProps}
          id={fid}
          name={field.name}
          ref={field.ref}
          value={(field.value as string | undefined) ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={textareaProps.disabled ?? field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    />
  );
}

export function FormMoneyInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  label,
  hint,
  opcional,
  className,
  id,
  ...moneyProps
}: Base<TFieldValues, TName> & Omit<MoneyInputProps, 'name' | 'id' | 'value' | 'onChange'>) {
  return (
    <FormField
      name={name}
      control={control}
      label={label}
      hint={hint}
      opcional={opcional}
      className={className}
      id={id}
      render={({ field, id: fid, invalid, describedBy }) => (
        <MoneyInput
          {...moneyProps}
          id={fid}
          name={field.name}
          ref={field.ref}
          value={field.value as number | null | undefined}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={moneyProps.disabled ?? field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    />
  );
}

export function FormDateInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  label,
  hint,
  opcional,
  className,
  id,
  ...dateProps
}: Base<TFieldValues, TName> & Omit<DateInputProps, 'name' | 'id' | 'value' | 'onChange'>) {
  return (
    <FormField
      name={name}
      control={control}
      label={label}
      hint={hint}
      opcional={opcional}
      className={className}
      id={id}
      render={({ field, id: fid, invalid, describedBy }) => (
        <DateInput
          {...dateProps}
          id={fid}
          name={field.name}
          ref={field.ref}
          value={field.value as string | null | undefined}
          onChange={(v) => field.onChange(v ?? '')}
          onBlur={field.onBlur}
          disabled={dateProps.disabled ?? field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    />
  );
}

export function FormMaskedInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  label,
  hint,
  opcional,
  className,
  id,
  ...maskedProps
}: Base<TFieldValues, TName> & Omit<MaskedInputProps, 'name' | 'id' | 'value' | 'onChange'>) {
  return (
    <FormField
      name={name}
      control={control}
      label={label}
      hint={hint}
      opcional={opcional}
      className={className}
      id={id}
      render={({ field, id: fid, invalid, describedBy }) => (
        <MaskedInput
          {...maskedProps}
          id={fid}
          name={field.name}
          ref={field.ref}
          value={field.value as string | null | undefined}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={maskedProps.disabled ?? field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    />
  );
}

export function FormSelect<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  V extends string = string,
>({
  name,
  control,
  label,
  hint,
  opcional,
  className,
  id,
  ...selectProps
}: Base<TFieldValues, TName> &
  Omit<SimpleSelectProps<V>, 'name' | 'id' | 'value' | 'onValueChange'>) {
  return (
    <FormField
      name={name}
      control={control}
      label={label}
      hint={hint}
      opcional={opcional}
      className={className}
      id={id}
      render={({ field, id: fid, invalid, describedBy }) => (
        <SimpleSelect<V>
          {...selectProps}
          id={fid}
          name={field.name}
          value={field.value as V | '' | null | undefined}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
          disabled={selectProps.disabled ?? field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    />
  );
}

export function FormCombobox<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  label,
  hint,
  opcional,
  className,
  id,
  ...comboProps
}: Base<TFieldValues, TName> & Omit<ComboboxProps, 'id' | 'value' | 'onChange'>) {
  return (
    <FormField
      name={name}
      control={control}
      label={label}
      hint={hint}
      opcional={opcional}
      className={className}
      id={id}
      render={({ field, id: fid, invalid, describedBy }) => (
        <Combobox
          {...comboProps}
          id={fid}
          value={field.value as string | null | undefined}
          onChange={(v) => field.onChange(v ?? null)}
          onBlur={field.onBlur}
          disabled={comboProps.disabled ?? field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    />
  );
}

export function FormRadioCards<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  V extends string = string,
>({
  name,
  control,
  label,
  hint,
  opcional,
  className,
  id,
  ...radioProps
}: Base<TFieldValues, TName> &
  Omit<RadioCardsProps<V>, 'name' | 'id' | 'value' | 'onValueChange'>) {
  return (
    <FormField
      name={name}
      control={control}
      label={label}
      hint={hint}
      opcional={opcional}
      className={className}
      id={id}
      grupo
      render={({ field, id: fid, invalid, describedBy, labelId }) => (
        <RadioCards<V>
          {...radioProps}
          id={fid}
          name={field.name}
          value={field.value as V | '' | null | undefined}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
          disabled={radioProps.disabled ?? field.disabled}
          aria-labelledby={label ? labelId : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    />
  );
}

export function FormCheckbox<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  label,
  hint,
  className,
  id,
  ...checkboxProps
}: Omit<Base<TFieldValues, TName>, 'opcional'> &
  Omit<CheckboxProps, 'name' | 'id' | 'checked' | 'onCheckedChange' | 'label'> & {
    label?: ReactNode;
  }) {
  return (
    <FormField
      name={name}
      control={control}
      hint={hint}
      className={className}
      id={id}
      render={({ field, id: fid, invalid, describedBy }) => (
        <Checkbox
          {...checkboxProps}
          id={fid}
          name={field.name}
          ref={field.ref}
          label={label}
          checked={Boolean(field.value)}
          onCheckedChange={(v) => field.onChange(v === true)}
          onBlur={field.onBlur}
          disabled={checkboxProps.disabled ?? field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    />
  );
}

export function FormSwitch<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  label,
  hint,
  className,
  id,
  ...switchProps
}: Omit<Base<TFieldValues, TName>, 'opcional'> &
  Omit<SwitchProps, 'name' | 'id' | 'checked' | 'onCheckedChange' | 'label'> & {
    label?: ReactNode;
  }) {
  return (
    <FormField
      name={name}
      control={control}
      hint={hint}
      className={className}
      id={id}
      render={({ field, id: fid, invalid, describedBy }) => (
        <Switch
          {...switchProps}
          id={fid}
          name={field.name}
          ref={field.ref}
          label={label}
          checked={Boolean(field.value)}
          onCheckedChange={field.onChange}
          onBlur={field.onBlur}
          disabled={switchProps.disabled ?? field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    />
  );
}

/** Erro geral do formulário (root.serverError), preenchido por aplicarErrosDoServidor. */
export function FormRootError({ errors, className }: { errors: FieldErrors; className?: string }) {
  const mensagem = errors.root?.serverError?.message ?? errors.root?.message;
  if (!mensagem) return null;
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border border-perigo-200 bg-perigo-50 px-3 py-2 text-sm text-perigo-700',
        className,
      )}
    >
      {mensagem}
    </div>
  );
}
