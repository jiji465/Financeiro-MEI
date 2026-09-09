import { SearchX } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export function NaoEncontrada() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        icone={<SearchX aria-hidden="true" />}
        titulo="Página não encontrada"
        descricao="O endereço que você acessou não existe ou foi movido."
        acao={
          <Button asChild>
            <Link to="/">Voltar ao início</Link>
          </Button>
        }
      />
    </div>
  );
}
