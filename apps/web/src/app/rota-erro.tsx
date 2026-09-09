// errorElement do router: 404 de rota vira "não encontrada"; qualquer outro erro mostra ErrorState.
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { NaoEncontrada } from '@/app/nao-encontrada';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

export function RotaErro() {
  const erro = useRouteError();

  if (isRouteErrorResponse(erro) && erro.status === 404) return <NaoEncontrada />;

  const mensagem =
    erro instanceof Error
      ? erro.message
      : isRouteErrorResponse(erro)
        ? `${erro.status} ${erro.statusText}`
        : 'Algo inesperado aconteceu.';

  return (
    <main className="mx-auto max-w-lg p-6">
      <ErrorState
        titulo="Ops, algo deu errado"
        descricao={mensagem}
        onRetry={() => window.location.reload()}
      />
      <div className="mt-4 text-center">
        <Button variant="link" asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  );
}
