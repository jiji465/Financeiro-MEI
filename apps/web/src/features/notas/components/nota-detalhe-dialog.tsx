// Detalhe de uma nota: dados, arquivo (enviar/baixar/remover), vínculo com a receita e ação de
// cancelar (abre o CancelarNotaDialog do chamador).
import type { NotaFiscalDto } from '@meifin/shared';
import { Ban, Download, ExternalLink, Link2Off, Paperclip, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { QueryState } from '@/components/ui/query-state';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { SkeletonText } from '@/components/ui/skeleton';
import { baixarBlob } from '@/lib/api/download';
import { formatData } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';

import { notasApi } from '../api';
import { useEnviarArquivoNota, useNota, useRemoverArquivoNota, useVincularNota } from '../hooks';
import { StatusNotaBadge, TipoNotaBadge } from './status-nota-badge';

const TAMANHO_MAX_MB = 10;

function formatTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface NotaDetalheDialogProps {
  notaId: string | null;
  onClose: () => void;
  onCancelar: (nota: NotaFiscalDto) => void;
}

export function NotaDetalheDialog({ notaId, onClose, onCancelar }: NotaDetalheDialogProps) {
  const nota = useNota(notaId);
  return (
    <ResponsiveDialog
      open={Boolean(notaId)}
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
      titulo={nota.data ? `Nota ${nota.data.numero}/${nota.data.serie ?? '1'}` : 'Detalhes da nota'}
      descricao={nota.data ? `Emitida em ${formatData(nota.data.dataEmissao)}` : undefined}
      tamanho="lg"
    >
      <QueryState query={nota} skeleton={<SkeletonText linhas={6} />}>
        {(dados) => <Detalhe nota={dados} onCancelar={() => onCancelar(dados)} />}
      </QueryState>
    </ResponsiveDialog>
  );
}

function Detalhe({ nota, onCancelar }: { nota: NotaFiscalDto; onCancelar: () => void }) {
  const confirm = useConfirm();
  const enviar = useEnviarArquivoNota();
  const remover = useRemoverArquivoNota();
  const vincular = useVincularNota();
  const inputRef = useRef<HTMLInputElement>(null);
  const [baixando, setBaixando] = useState(false);

  const baixarArquivo = async () => {
    if (!nota.arquivo) return;
    setBaixando(true);
    try {
      const { blob, nomeArquivo } = await notasApi.baixarArquivo(nota.id);
      baixarBlob(blob, nomeArquivo ?? nota.arquivo.nome);
    } finally {
      setBaixando(false);
    }
  };

  const escolherArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (arquivo.size > TAMANHO_MAX_MB * 1024 * 1024) return;
    enviar.mutate({ id: nota.id, arquivo });
  };

  const confirmarRemocaoArquivo = async () => {
    const ok = await confirm({
      titulo: 'Remover arquivo?',
      descricao: 'O PDF/XML anexado a esta nota será excluído.',
      confirmarTexto: 'Remover',
      tom: 'destructive',
    });
    if (ok) remover.mutate(nota.id);
  };

  const confirmarDesvinculo = async () => {
    const ok = await confirm({
      titulo: 'Desvincular a receita?',
      descricao: 'A nota deixa de estar associada ao lançamento; o lançamento em si é mantido.',
      confirmarTexto: 'Desvincular',
      tom: 'destructive',
    });
    if (ok) vincular.mutate({ id: nota.id, lancamentoId: null });
  };

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-zinc-500">Tipo</dt>
          <dd>
            <TipoNotaBadge tipo={nota.tipo} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Status</dt>
          <dd>
            <StatusNotaBadge status={nota.status} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Valor</dt>
          <dd className="font-semibold tabular-nums">{formatBRL(nota.valor)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Emissão</dt>
          <dd className="tabular-nums">{formatData(nota.dataEmissao)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-zinc-500">Cliente</dt>
          <dd>{nota.contato?.nome ?? '—'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-zinc-500">Receita vinculada</dt>
          <dd className="flex items-center gap-2">
            {nota.lancamentoId ? (
              <>
                <span>Sim</span>
                {nota.status === 'emitida' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Link2Off aria-hidden="true" />}
                    onClick={() => void confirmarDesvinculo()}
                    loading={vincular.isPending}
                  >
                    Desvincular
                  </Button>
                ) : null}
              </>
            ) : (
              <span className="text-zinc-500">Nenhuma</span>
            )}
          </dd>
        </div>
        {nota.descricao ? (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs text-zinc-500">Descrição</dt>
            <dd className="whitespace-pre-wrap">{nota.descricao}</dd>
          </div>
        ) : null}
        {nota.linkExterno ? (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs text-zinc-500">Link externo</dt>
            <dd>
              <a
                href={nota.linkExterno}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary-700 hover:underline"
              >
                {nota.linkExterno}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </dd>
          </div>
        ) : null}
        {nota.status === 'cancelada' ? (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs text-zinc-500">Cancelamento</dt>
            <dd>
              {formatData(nota.dataCancelamento)}
              {nota.motivoCancelamento ? ` · ${nota.motivoCancelamento}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="rounded-lg border border-borda p-3">
        <p className="mb-2 text-xs font-medium text-zinc-500">Arquivo (PDF/XML/imagem)</p>
        {nota.arquivo ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-2 text-sm">
              <Paperclip className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
              <span className="truncate">{nota.arquivo.nome}</span>
              <span className="shrink-0 text-xs text-zinc-500">
                ({formatTamanho(nota.arquivo.tamanho)})
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Download aria-hidden="true" />}
                onClick={() => void baixarArquivo()}
                loading={baixando}
              >
                Baixar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-perigo-700"
                icon={<Trash2 aria-hidden="true" />}
                onClick={() => void confirmarRemocaoArquivo()}
                loading={remover.isPending}
              >
                Remover
              </Button>
            </span>
          </div>
        ) : (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xml"
              className="sr-only"
              onChange={escolherArquivo}
              aria-label="Enviar arquivo da nota"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              icon={<Upload aria-hidden="true" />}
              onClick={() => inputRef.current?.click()}
              loading={enviar.isPending}
            >
              Enviar arquivo
            </Button>
            <p className="mt-1 text-xs text-zinc-500">
              PDF, JPG, PNG ou XML, até {TAMANHO_MAX_MB} MB.
            </p>
          </div>
        )}
      </div>

      {nota.status === 'emitida' ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            className="text-perigo-700"
            icon={<Ban aria-hidden="true" />}
            onClick={onCancelar}
          >
            Cancelar nota
          </Button>
        </div>
      ) : null}
    </div>
  );
}
