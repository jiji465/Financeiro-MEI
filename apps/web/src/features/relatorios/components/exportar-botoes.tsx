// Trio de botões "Exportar CSV" / "Exportar Excel" / "Exportar PDF" reutilizado nas páginas de
// relatório. onXlsx/baixandoXlsx são opcionais para não quebrar quem ainda não os passa.
import { FileDown, FileSpreadsheet } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface ExportarBotoesProps {
  onCsv: () => void;
  onPdf: () => void;
  onXlsx?: () => void;
  baixandoCsv?: boolean;
  baixandoPdf?: boolean;
  baixandoXlsx?: boolean;
  disabled?: boolean;
}

export function ExportarBotoes({
  onCsv,
  onPdf,
  onXlsx,
  baixandoCsv,
  baixandoPdf,
  baixandoXlsx,
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
      {onXlsx ? (
        <Button
          variant="outline"
          size="sm"
          icon={<FileSpreadsheet aria-hidden="true" />}
          loading={baixandoXlsx}
          disabled={disabled}
          onClick={onXlsx}
        >
          Excel
        </Button>
      ) : null}
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
