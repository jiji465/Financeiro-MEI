// Par de botões "Exportar CSV" / "Exportar PDF" reutilizado nas páginas de relatório.
import { FileDown } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface ExportarBotoesProps {
  onCsv: () => void;
  onPdf: () => void;
  baixandoCsv?: boolean;
  baixandoPdf?: boolean;
  disabled?: boolean;
}

export function ExportarBotoes({
  onCsv,
  onPdf,
  baixandoCsv,
  baixandoPdf,
  disabled,
}: ExportarBotoesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        icon={<FileDown aria-hidden="true" />}
        loading={baixandoCsv}
        disabled={disabled}
        onClick={onCsv}
      >
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        icon={<FileDown aria-hidden="true" />}
        loading={baixandoPdf}
        disabled={disabled}
        onClick={onPdf}
      >
        PDF
      </Button>
    </div>
  );
}
