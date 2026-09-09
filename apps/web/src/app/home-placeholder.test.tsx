import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomePlaceholder } from '@/app/home-placeholder';

function renderComQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('HomePlaceholder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra o nome do sistema e o estado da API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status: 'ok', db: 'pglite', versao: '0.1.0' })),
    );

    renderComQuery(<HomePlaceholder />);

    expect(screen.getByRole('heading', { name: 'MEI Financeiro' })).toBeInTheDocument();
    expect(await screen.findByText('pglite')).toBeInTheDocument();
    expect(screen.getByText(/versão 0\.1\.0/)).toBeInTheDocument();
  });

  it('mostra erro quando a API não responde', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    renderComQuery(<HomePlaceholder />);

    expect(await screen.findByRole('alert')).toHaveTextContent('API indisponível');
  });
});
