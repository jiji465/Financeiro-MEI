import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { DataTable, type DataTableColumn } from './data-table';
import { EmptyState } from './empty-state';

interface Linha {
  id: string;
  descricao: string;
  valor: number;
}

const colunas: DataTableColumn<Linha>[] = [
  { id: 'descricao', header: 'Descrição', cell: (r) => r.descricao },
  { id: 'valor', header: 'Valor', cell: (r) => String(r.valor), numeric: true, hideBelow: 'md' },
];

const dados: Linha[] = [
  { id: '1', descricao: 'Venda', valor: 100 },
  { id: '2', descricao: 'Compra', valor: 50 },
];

describe('DataTable', () => {
  it('renderiza cabeçalho, linhas e coluna com hideBelow', () => {
    render(<DataTable columns={colunas} data={dados} rowKey={(r) => r.id} caption="Lançamentos" />);
    const tabela = screen.getByRole('table', { name: 'Lançamentos' });
    expect(within(tabela).getByRole('columnheader', { name: 'Descrição' })).toBeInTheDocument();
    expect(within(tabela).getAllByRole('row')).toHaveLength(3);
    expect(within(tabela).getByText('Venda')).toBeInTheDocument();
    expect(within(tabela).getByRole('columnheader', { name: 'Valor' })).toHaveClass(
      'hidden',
      'md:table-cell',
    );
  });

  it('mostra skeleton enquanto carrega', () => {
    const { container } = render(
      <DataTable
        columns={colunas}
        data={undefined}
        isLoading
        rowKey={(r) => r.id}
        skeletonRows={3}
      />,
    );
    expect(container.querySelectorAll('tbody tr[aria-hidden="true"]')).toHaveLength(3);
    expect(screen.queryByText('Nenhum registro.')).not.toBeInTheDocument();
  });

  it('mostra erro com "Tentar novamente"', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <DataTable
        columns={colunas}
        data={undefined}
        isError
        error={new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'Falhou feio' })}
        onRetry={onRetry}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou feio');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('mostra o slot vazio', () => {
    render(
      <DataTable
        columns={colunas}
        data={[]}
        rowKey={(r) => r.id}
        empty={<EmptyState titulo="Nada por aqui" descricao="Crie o primeiro lançamento." />}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Nada por aqui' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renderiza cartões mobile e ações por linha', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const acao = vi.fn();
    render(
      <DataTable
        columns={colunas}
        data={dados}
        rowKey={(r) => r.id}
        caption="Lançamentos"
        mobileCard={(r) => <p>{r.descricao} (cartão)</p>}
        rowActions={(r) => (
          <button type="button" onClick={() => acao(r.id)}>
            Editar {r.descricao}
          </button>
        )}
        onRowClick={onRowClick}
        footer="Total: 150"
      />,
    );
    // tabela (desktop) e lista (mobile) coexistem no DOM; CSS decide qual aparece
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Venda (cartão)')).toBeInTheDocument();
    expect(screen.getAllByText('Total: 150')).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: 'Editar Venda' })[0]!);
    expect(acao).toHaveBeenCalledWith('1');
    expect(onRowClick).not.toHaveBeenCalled(); // stopPropagation na célula de ações

    await user.click(within(screen.getByRole('table')).getByText('Compra'));
    expect(onRowClick).toHaveBeenCalledWith(dados[1]);
  });
});
