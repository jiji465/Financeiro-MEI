import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { MaskedInput, type Mascara } from './masked-input';

function Controlado({ mask, inicial = '' }: { mask: Mascara; inicial?: string }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <MaskedInput aria-label="Campo" mask={mask} value={valor} onChange={setValor} />
      <output data-testid="cru">{valor}</output>
    </>
  );
}

describe('MaskedInput', () => {
  it('CPF: exibe com máscara e armazena só dígitos', async () => {
    const user = userEvent.setup();
    render(<Controlado mask="cpf" />);
    const input = screen.getByLabelText('Campo');
    await user.type(input, '52998224725999');
    expect(input).toHaveValue('529.982.247-25');
    expect(screen.getByTestId('cru')).toHaveTextContent('52998224725');
    expect(input).toHaveAttribute('inputmode', 'numeric');
  });

  it('CNPJ: aceita alfanumérico e normaliza para maiúsculas', async () => {
    const user = userEvent.setup();
    render(<Controlado mask="cnpj" />);
    const input = screen.getByLabelText('Campo');
    await user.type(input, '12abc34501de35');
    expect(input).toHaveValue('12.ABC.345/01DE-35');
    expect(screen.getByTestId('cru')).toHaveTextContent('12ABC34501DE35');
  });

  it('CPF ou CNPJ: troca a máscara conforme o tamanho', async () => {
    const user = userEvent.setup();
    render(<Controlado mask="cpfCnpj" />);
    const input = screen.getByLabelText('Campo');
    await user.type(input, '52998224725');
    expect(input).toHaveValue('529.982.247-25');
    await user.type(input, '999');
    expect(input).toHaveValue('52.998.224/7259-99');
    expect(screen.getByTestId('cru')).toHaveTextContent('52998224725999');
  });

  it('telefone: fixo e celular', async () => {
    const user = userEvent.setup();
    render(<Controlado mask="telefone" />);
    const input = screen.getByLabelText('Campo');
    await user.type(input, '1133334444');
    expect(input).toHaveValue('(11) 3333-4444');
    await user.type(input, '5');
    expect(input).toHaveValue('(11) 33334-4445');
    expect(screen.getByTestId('cru')).toHaveTextContent('11333344445');
  });

  it('CEP: limita a 8 dígitos e aceita colar com pontuação', async () => {
    const user = userEvent.setup();
    render(<Controlado mask="cep" />);
    const input = screen.getByLabelText('Campo');
    await user.click(input);
    await user.paste('01.310-100');
    expect(input).toHaveValue('01310-100');
    expect(screen.getByTestId('cru')).toHaveTextContent('01310100');
  });

  it('apagar remove dígitos do valor cru', async () => {
    const user = userEvent.setup();
    render(<Controlado mask="cep" inicial="01310100" />);
    const input = screen.getByLabelText('Campo');
    await user.type(input, '{backspace}{backspace}');
    expect(input).toHaveValue('01310-1');
    expect(screen.getByTestId('cru')).toHaveTextContent('013101');
  });
});
