import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MoneyInput } from './money-input';

function Controlado({
  inicial = null,
  onChange,
  allowNegative,
}: {
  inicial?: number | null;
  onChange?: (v: number | null) => void;
  allowNegative?: boolean;
}) {
  const [valor, setValor] = useState<number | null>(inicial);
  return (
    <>
      <MoneyInput
        aria-label="Valor"
        value={valor}
        allowNegative={allowNegative}
        onChange={(v) => {
          setValor(v);
          onChange?.(v);
        }}
      />
      <output data-testid="valor">{valor === null ? 'null' : String(valor)}</output>
    </>
  );
}

describe('MoneyInput', () => {
  it('digita como calculadora: dígitos entram pela direita', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlado onChange={onChange} />);
    const input = screen.getByLabelText('Valor');

    await user.type(input, '1');
    expect(input).toHaveValue('0,01');
    expect(onChange).toHaveBeenLastCalledWith(1);

    await user.type(input, '23456');
    expect(input).toHaveValue('1.234,56');
    expect(screen.getByTestId('valor')).toHaveTextContent('123456');
  });

  it('backspace remove o último dígito e esvaziar devolve null', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlado inicial={123456} onChange={onChange} />);
    const input = screen.getByLabelText('Valor');
    expect(input).toHaveValue('1.234,56');

    await user.type(input, '{backspace}');
    expect(input).toHaveValue('123,45');
    expect(onChange).toHaveBeenLastCalledWith(12345);

    await user.clear(input);
    expect(input).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId('valor')).toHaveTextContent('null');
  });

  it('cola valores formatados em reais', async () => {
    const user = userEvent.setup();
    render(<Controlado />);
    const input = screen.getByLabelText('Valor');

    await user.click(input);
    await user.paste('R$ 1.234,56');
    expect(screen.getByTestId('valor')).toHaveTextContent('123456');
    expect(input).toHaveValue('1.234,56');

    await user.paste('1234');
    expect(screen.getByTestId('valor')).toHaveTextContent('123400');
  });

  it('ignora separadores digitados e mantém inputMode numérico', async () => {
    const user = userEvent.setup();
    render(<Controlado />);
    const input = screen.getByLabelText('Valor');
    expect(input).toHaveAttribute('inputmode', 'numeric');

    await user.type(input, '1,5.0');
    expect(screen.getByTestId('valor')).toHaveTextContent('150');
    expect(input).toHaveValue('1,50');
  });

  it('não aceita negativo por padrão; com allowNegative o "-" alterna o sinal', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Controlado inicial={1000} />);
    await user.type(screen.getByLabelText('Valor'), '-');
    expect(screen.getByTestId('valor')).toHaveTextContent('1000');
    unmount();

    render(<Controlado inicial={1000} allowNegative />);
    const input = screen.getByLabelText('Valor');
    await user.type(input, '-');
    expect(screen.getByTestId('valor')).toHaveTextContent('-1000');
    expect(input).toHaveValue('-10,00');
  });

  it('mostra o prefixo R$ e aceita aria-invalid', () => {
    render(<MoneyInput aria-label="Valor" value={null} onChange={() => {}} aria-invalid />);
    expect(screen.getByText('R$')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor')).toHaveAttribute('aria-invalid', 'true');
  });
});
