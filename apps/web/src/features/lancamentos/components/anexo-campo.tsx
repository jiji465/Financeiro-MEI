// Anexo do lançamento (comprovante): mostra o arquivo atual (baixar/remover) ou um botão para
// enviar um novo (PDF/JPG/PNG/XML ≤ 10 MB — mesmas regras do @meifin/shared ANEXO).
import { ANEXO, type AnexoDto } from '@meifin/shared';
import { FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { baixarDaApi } from '@/lib/api/download';
import { getErrorMessage } from '@/lib/api/errors';

import { useEnviarAnexo, useRemoverAnexo } from '../hooks';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.xml,application/pdf,image/jpeg,image/png,application/xml,text/xml';

export interface AnexoCampoProps {
  lancamentoId: string;
  anexo: AnexoDto | null;
}

export function AnexoCampo({ lancamentoId, anexo }: AnexoCampoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const enviar = useEnviarAnexo(lancamentoId);
  const remover = useRemoverAnexo(lancamentoId);

  const escolherArquivo = () => inputRef.current?.click();

  const onSelecionar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (arquivo.size > ANEXO.tamanhoMaxBytes) {
      enviar.reset();
      window.alert('Arquivo deve ter no máximo 10 MB.');
      return;
    }
    enviar.mutate(arquivo);
  };

  const confirmarRemocao = async () => {
    const ok = await confirm({
      titulo: 'Remover anexo?',
      descricao: 'O comprovante atual será excluído. Você pode enviar outro depois.',
      confirmarTexto: 'Remover',
      tom: 'destructive',
    });
    if (ok) remover.mutate();
  };

  return (
    <div className="rounded-lg border border-borda p-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onSelecionar}
        aria-label="Selecionar comprovante"
      />
      {anexo ? (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
            <FileText aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="truncate text-sm font-medium text-primary-700 hover:underline"
              onClick={() => void baixarDaApi(`/lancamentos/${lancamentoId}/anexo`, anexo.nome)}
            >
              {anexo.nome}
            </button>
            <p className="text-xs text-zinc-500">{formatBytes(anexo.tamanho)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remover anexo"
            loading={remover.isPending}
            onClick={() => void confirmarRemocao()}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <Paperclip aria-hidden="true" className="size-4" />
            Nenhum comprovante anexado
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Upload aria-hidden="true" />}
            loading={enviar.isPending}
            onClick={escolherArquivo}
          >
            Enviar
          </Button>
        </div>
      )}
      {enviar.isError ? (
        <p className="mt-2 text-xs font-medium text-perigo-700">{getErrorMessage(enviar.error)}</p>
      ) : null}
    </div>
  );
}
