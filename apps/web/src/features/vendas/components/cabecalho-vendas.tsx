import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { BrandMark } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

/** Cabeçalho da página de vendas: totalmente transparente sobre o hero (sem linha divisória) e,
 * depois que a página rola, ganha fundo translúcido — senão o conteúdo das seções passa por baixo
 * dele e o texto fica ilegível. Mesmo comportamento da referência (mercury.com). */
export function CabecalhoVendas() {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 24);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center justify-between px-4 transition-colors duration-200 md:px-8',
        rolou && 'bg-fundo/85 backdrop-blur',
      )}
    >
      <BrandMark />
      <div className="flex items-center gap-1 sm:gap-2">
        <Button asChild variant="ghost">
          <Link to="/entrar">Já tenho conta</Link>
        </Button>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link to="/cadastro">Solicitar acesso</Link>
        </Button>
      </div>
    </header>
  );
}
