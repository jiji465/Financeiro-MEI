import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { criarConfiguracoes, criarLimite } from '@/features/das/test/fixtures';
import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { explicacaoNivel, LimiteCard } from './limite-card';

function mockRotas(limite: ReturnType<typeof criarLimite>) {
  return mockFetch([
    { method: 'GET', path: '/api/v1/obrigacoes/limite', body: { data: limite } },
    { method: 'GET', path: '/api/v1/configuracoes', body: { data: criarConfiguracoes() } },
  ]);
}

describe('LimiteCard', () => {
  it('mostra o percentual, o valor faturado e o restante', async () => {
    mockRotas(
      criarLimite({ acumulado: 4_000_000, percentual: 49.4, restante: 4_100_000, nivel: 'ok' }),
    );
    renderWithProviders(<LimiteCard ano={2026} />);

    expect(await screen.findByText('49,4%')).toBeInTheDocument();
    expect(screen.getByText('R$ 40.000,00')).toBeInTheDocument();
    expect(screen.getByText(/Restam R\$ 41\.000,00/)).toBeInTheDocument();
  });

  it('avisa sobre o excesso "até 20%" (continua MEI até 31/12)', async () => {
    mockRotas(
      criarLimite({
        acumulado: 8_500_000,
        percentual: 104.9,
        restante: 0,
        valorExcedido: 400_000,
        nivel: 'estourado',
        excesso: 'ate_20',
      }),
    );
    renderWithProviders(<LimiteCard ano={2026} />);

    expect(await screen.findByText(/passou do limite em até 20%/)).toBeInTheDocument();
    expect(screen.getByText(/Continua como MEI até 31\/12\/2026/)).toBeInTheDocument();
  });

  it('no modo compacto não mostra a média mensal nem o rodapé de regime', async () => {
    mockRotas(criarLimite());
    renderWithProviders(<LimiteCard ano={2026} compacto />);

    await screen.findByText('0%');
    expect(screen.queryByText('Média mensal')).not.toBeInTheDocument();
    expect(screen.queryByText(/dados até/)).not.toBeInTheDocument();
  });
});

describe('explicacaoNivel', () => {
  it('descreve o excesso acima de 20% como desenquadramento retroativo', () => {
    const texto = explicacaoNivel(
      criarLimite({ excesso: 'acima_20', ano: 2026, nivel: 'estourado' }),
    );
    expect(texto).toContain('desde 1º de janeiro de 2026');
  });
});
