import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FormInput, FormMoneyInput, FormRootError } from './form-field';

const schema = z.object({
  email: z.email('E-mail inválido'),
  valor: z.number().int().positive('Informe um valor maior que zero').nullable(),
});
type Form = z.input<typeof schema>;

function Formulario({ onSubmit }: { onSubmit: (v: Form) => void }) {
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', valor: null },
  });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FormRootError errors={form.formState.errors} />
      <FormInput control={form.control} name="email" label="E-mail" hint="Usado para entrar" />
      <FormMoneyInput control={form.control} name="valor" label="Valor" />
      <button type="submit">Salvar</button>
      <button
        type="button"
        onClick={() => form.setError('root.serverError', { message: 'Servidor recusou' })}
      >
        Erro servidor
      </button>
    </form>
  );
}

describe('FormField (react-hook-form)', () => {
  it('liga label, hint e erro via id/aria', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Formulario onSubmit={onSubmit} />);

    const email = screen.getByLabelText('E-mail');
    expect(email).not.toHaveAttribute('aria-invalid');
    const hint = screen.getByText('Usado para entrar');
    expect(email).toHaveAttribute('aria-describedby', hint.id);

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).not.toHaveBeenCalled();
    const erro = await screen.findByText('E-mail inválido');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', erro.id);
    expect(screen.queryByText('Usado para entrar')).not.toBeInTheDocument();
  });

  it('envia valores válidos (MoneyInput em centavos)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Formulario onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('E-mail'), 'a@b.com');
    await user.type(screen.getByLabelText('Valor'), '1250');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ email: 'a@b.com', valor: 1250 });
  });

  it('exibe erro geral do servidor', async () => {
    const user = userEvent.setup();
    render(<Formulario onSubmit={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Erro servidor' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Servidor recusou');
  });
});
