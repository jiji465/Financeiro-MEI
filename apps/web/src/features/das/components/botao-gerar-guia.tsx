// Botão "Gerar guia": abre o PGMEI e copia o CNPJ no mesmo clique.
//
// O PGMEI é um formulário da Receita Federal e pede o CNPJ na primeira tela. Não existe endereço
// documentado que aceite o CNPJ como parâmetro — inventar um daria um link que quebra sem avisar,
// e no meio do caminho de pagar imposto. O que resolve o incômodo de verdade é o CNPJ já estar na
// área de transferência quando a página abrir: lá é só colar.
//
// A cópia acontece no clique (gesto do usuário), que é o que o navegador exige para liberar a
// área de transferência. Se ela falhar — navegador antigo, contexto sem HTTPS, permissão negada —
// o link abre do mesmo jeito e o aviso diz o CNPJ, para copiar na mão.
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useMei } from '@/features/referencias';
import { maskCNPJ } from '@/lib/format/documento';

export const URL_PGMEI =
  'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao';

export interface BotaoGerarGuiaProps {
  /** Texto do botão; a tabela usa o padrão, o topo da página usa um rótulo mais explícito. */
  children?: React.ReactNode;
  variant?: 'ghost' | 'secondary' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export function BotaoGerarGuia({
  children = 'Gerar guia',
  variant = 'ghost',
  size = 'sm',
  className,
}: BotaoGerarGuiaProps) {
  const mei = useMei();
  const cnpj = mei.data?.tenant.cnpj ?? null;

  const aoClicar = async () => {
    if (!cnpj) return;
    try {
      await navigator.clipboard.writeText(cnpj);
      toast.success('CNPJ copiado', {
        description: `Cole ${maskCNPJ(cnpj)} no campo do PGMEI.`,
      });
    } catch {
      toast.info('Copie o CNPJ para o PGMEI', { description: maskCNPJ(cnpj) });
    }
  };

  return (
    <Button variant={variant} size={size} className={className} asChild>
      <a href={URL_PGMEI} target="_blank" rel="noopener noreferrer" onClick={() => void aoClicar()}>
        {children}
        <ExternalLink aria-hidden="true" />
      </a>
    </Button>
  );
}
