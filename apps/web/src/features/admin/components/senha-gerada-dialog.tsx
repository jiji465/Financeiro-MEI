// Mostra uma senha gerada pelo admin (redefinição) uma única vez, com botão de copiar — mesmo
// padrão de "criar conta": sem infraestrutura de e-mail real, é o admin quem repassa por fora.
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';

export interface SenhaGeradaDialogProps {
  dados: { nome: string; senha: string } | null;
  onClose: () => void;
}

export function SenhaGeradaDialog({ dados, onClose }: SenhaGeradaDialogProps) {
  const [copiado, setCopiado] = useState(false);

  return (
    <ResponsiveDialog
      open={dados !== null}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setCopiado(false);
          onClose();
        }
      }}
      titulo="Nova senha gerada"
      descricao={
        dados
          ? `Copie a senha e repasse para ${dados.nome} — ela não aparece de novo. As sessões abertas dela foram encerradas.`
          : ''
      }
    >
      {dados ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-borda bg-zinc-50 px-3 py-2">
            <code className="text-sm">{dados.senha}</code>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Copiar senha"
              onClick={() => {
                void navigator.clipboard.writeText(dados.senha);
                setCopiado(true);
              }}
            >
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <Button className="w-full" onClick={onClose}>
            Concluir
          </Button>
        </div>
      ) : null}
    </ResponsiveDialog>
  );
}
