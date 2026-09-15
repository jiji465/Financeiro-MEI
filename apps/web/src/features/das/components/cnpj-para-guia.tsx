// O PGMEI é um site da Receita Federal e pede o CNPJ na primeira tela. Não dá pra preencher esse
// campo por link: é um formulário de terceiro, sem endereço documentado que aceite o CNPJ como
// parâmetro — inventar um significaria um link que quebra sem avisar. O que dá pra fazer, e
// resolve o incômodo real, é deixar o CNPJ a um clique de distância pra colar lá.
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useMei } from '@/features/referencias';
import { maskCNPJ } from '@/lib/format/documento';

export function CnpjParaGuia() {
  const mei = useMei();
  const [copiado, setCopiado] = useState(false);
  const cnpj = mei.data?.tenant.cnpj ?? null;

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  if (!cnpj) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cnpj);
      setCopiado(true);
    } catch {
      // Sem permissão de área de transferência (navegador antigo ou contexto não seguro): o CNPJ
      // segue visível na tela, então dá pra copiar na mão.
      setCopiado(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600">
      <span>
        CNPJ para a guia: <strong className="font-medium text-texto">{maskCNPJ(cnpj)}</strong>
      </span>
      <Button variant="ghost" size="sm" onClick={copiar} aria-label="Copiar CNPJ">
        {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copiado ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  );
}
