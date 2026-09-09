import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { RelatoriosHubPage } from './hub-page';

describe('RelatoriosHubPage', () => {
  it('lista um card por relatório, com link para a respectiva página', () => {
    renderWithProviders(<RelatoriosHubPage />);

    expect(screen.getByRole('link', { name: /DRE simplificada/ })).toHaveAttribute(
      'href',
      '/relatorios/dre',
    );
    expect(screen.getByRole('link', { name: /Extrato/ })).toHaveAttribute(
      'href',
      '/relatorios/extrato',
    );
    expect(screen.getByRole('link', { name: /Faturamento x limite/ })).toHaveAttribute(
      'href',
      '/relatorios/faturamento',
    );
    expect(screen.getByRole('link', { name: /DASN-SIMEI/ })).toHaveAttribute(
      'href',
      '/relatorios/dasn',
    );
    expect(screen.getByRole('link', { name: 'Importar CSV' })).toHaveAttribute(
      'href',
      '/relatorios/importar',
    );
  });

  it('tem botões de exportação rápida de lançamentos e contas', () => {
    renderWithProviders(<RelatoriosHubPage />);

    expect(screen.getByRole('button', { name: 'Exportar lançamentos (CSV)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar contas (CSV)' })).toBeInTheDocument();
  });
});
