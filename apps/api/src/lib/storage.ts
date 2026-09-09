// Armazenamento de anexos. v1: disco local em <pasta pai do PGlite>/uploads/<tenantId>/...
// (fora do OneDrive e do git). Phase 3 acrescenta adaptador S3 (Supabase Storage) por STORAGE_DRIVER.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';

import { defaultPgliteDir } from '../config/env.js';
import { MEMORY_DATA_DIR } from '../db/index.js';
import { NotFoundError } from './errors.js';

export interface ArquivoEntrada {
  nome: string;
  mime: string;
  conteudo: Buffer;
}

export interface ArquivoSalvo {
  /** Caminho relativo ao storage (o que vai para o banco). */
  path: string;
  nome: string;
  mime: string;
  tamanho: number;
}

export interface FileStorage {
  salvar(tenantId: string, arquivo: ArquivoEntrada): Promise<ArquivoSalvo>;
  ler(path: string): Promise<Buffer>;
  remover(path: string): Promise<void>;
  existe(path: string): Promise<boolean>;
}

const EXTENSAO_POR_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/xml': '.xml',
  'text/xml': '.xml',
};

function extensaoPara(nome: string, mime: string): string {
  const doNome = extname(nome).toLowerCase();
  if (/^\.[a-z0-9]{1,5}$/.test(doNome)) return doNome;
  return EXTENSAO_POR_MIME[mime] ?? '';
}

function nomeSeguro(nome: string): string {
  // eslint-disable-next-line no-control-regex
  const limpo = nome.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return limpo.length > 0 ? limpo.slice(0, 180) : 'arquivo';
}

export class LocalDiskStorage implements FileStorage {
  readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = resolve(baseDir);
  }

  private caminhoAbsoluto(path: string): string {
    const absoluto = resolve(this.baseDir, path);
    if (absoluto !== this.baseDir && !absoluto.startsWith(this.baseDir + sep)) {
      throw new NotFoundError('Arquivo não encontrado');
    }
    return absoluto;
  }

  async salvar(tenantId: string, arquivo: ArquivoEntrada): Promise<ArquivoSalvo> {
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('tenantId inválido para storage');
    const relativo = join(tenantId, `${randomUUID()}${extensaoPara(arquivo.nome, arquivo.mime)}`);
    const absoluto = this.caminhoAbsoluto(relativo);
    await mkdir(dirname(absoluto), { recursive: true });
    await writeFile(absoluto, arquivo.conteudo);
    return {
      path: relativo.split(sep).join('/'),
      nome: nomeSeguro(arquivo.nome),
      mime: arquivo.mime,
      tamanho: arquivo.conteudo.length,
    };
  }

  async ler(path: string): Promise<Buffer> {
    try {
      return await readFile(this.caminhoAbsoluto(path));
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundError('Arquivo não encontrado');
      }
      throw erro;
    }
  }

  async remover(path: string): Promise<void> {
    await rm(this.caminhoAbsoluto(path), { force: true });
  }

  async existe(path: string): Promise<boolean> {
    try {
      await stat(this.caminhoAbsoluto(path));
      return true;
    } catch {
      return false;
    }
  }
}

/** Pasta de uploads: irmã da pasta do PGlite (…\meifin\uploads). memory:// (testes) → pasta temporária. */
export function uploadsDirPara(dataDir: string | undefined): string {
  if (!dataDir || dataDir === MEMORY_DATA_DIR) {
    return join(tmpdir(), 'meifin-uploads');
  }
  return join(dirname(resolve(dataDir)), 'uploads');
}

export function criarStorage(dataDir: string | undefined): FileStorage {
  return new LocalDiskStorage(uploadsDirPara(dataDir ?? defaultPgliteDir()));
}
