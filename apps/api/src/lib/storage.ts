// Armazenamento de anexos. Dois adaptadores por STORAGE_DRIVER:
//  - 'local' (padrão em dev): disco em <pasta pai do PGlite>/uploads/<tenantId>/... (fora do
//    OneDrive e do git).
//  - 's3': qualquer serviço compatível com S3 (ex.: Supabase Storage). Necessário em produção
//    quando o disco do servidor é efêmero (ex.: plano gratuito do Render apaga o disco a cada
//    deploy/reinício).
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';

import type { Env } from '../config/env.js';
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

function validarTenantId(tenantId: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('tenantId invalido para storage');
}

/** Chave/caminho relativo unico para um novo arquivo: <tenantId>/<uuid><extensao>. */
function novaChave(tenantId: string, arquivo: ArquivoEntrada): string {
  validarTenantId(tenantId);
  return `${tenantId}/${randomUUID()}${extensaoPara(arquivo.nome, arquivo.mime)}`;
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
    const relativo = novaChave(tenantId, arquivo);
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

export interface OpcoesS3 {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/** Armazena anexos em qualquer serviço compatível com S3 (ex.: Supabase Storage). */
export class S3Storage implements FileStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(opcoes: OpcoesS3) {
    this.bucket = opcoes.bucket;
    this.client = new S3Client({
      endpoint: opcoes.endpoint,
      region: opcoes.region,
      forcePathStyle: opcoes.forcePathStyle,
      credentials: {
        accessKeyId: opcoes.accessKeyId,
        secretAccessKey: opcoes.secretAccessKey,
      },
    });
  }

  async salvar(tenantId: string, arquivo: ArquivoEntrada): Promise<ArquivoSalvo> {
    const chave = novaChave(tenantId, arquivo);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: chave,
        Body: arquivo.conteudo,
        ContentType: arquivo.mime,
      }),
    );
    return {
      path: chave,
      nome: nomeSeguro(arquivo.nome),
      mime: arquivo.mime,
      tamanho: arquivo.conteudo.length,
    };
  }

  async ler(path: string): Promise<Buffer> {
    try {
      const resposta = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: path }),
      );
      const bytes = await resposta.Body?.transformToByteArray();
      if (!bytes) throw new NotFoundError('Arquivo não encontrado');
      return Buffer.from(bytes);
    } catch (erro) {
      if (ehErroNaoEncontrado(erro)) throw new NotFoundError('Arquivo não encontrado');
      throw erro;
    }
  }

  async remover(path: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: path }));
  }

  async existe(path: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: path }));
      return true;
    } catch (erro) {
      if (ehErroNaoEncontrado(erro)) return false;
      throw erro;
    }
  }
}

function ehErroNaoEncontrado(erro: unknown): boolean {
  const nome = (erro as { name?: string } | undefined)?.name;
  const status = (erro as { $metadata?: { httpStatusCode?: number } } | undefined)?.$metadata
    ?.httpStatusCode;
  return nome === 'NoSuchKey' || nome === 'NotFound' || status === 404;
}

/** Pasta de uploads: irmã da pasta do PGlite (…\meifin\uploads). memory:// (testes) → pasta temporária. */
export function uploadsDirPara(dataDir: string | undefined): string {
  if (!dataDir || dataDir === MEMORY_DATA_DIR) {
    return join(tmpdir(), 'meifin-uploads');
  }
  return join(dirname(resolve(dataDir)), 'uploads');
}

export function criarStorage(env: Pick<Env, 'STORAGE_DRIVER'> & Partial<Env>): FileStorage {
  if (env.STORAGE_DRIVER === 's3') {
    // Validado em superRefine de env.ts: presentes quando STORAGE_DRIVER=s3.
    return new S3Storage({
      endpoint: env.S3_ENDPOINT!,
      region: env.S3_REGION ?? 'auto',
      bucket: env.S3_BUCKET!,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      forcePathStyle: env.S3_FORCE_PATH_STYLE ?? true,
    });
  }
  return new LocalDiskStorage(uploadsDirPara(env.PGLITE_DATA_DIR ?? defaultPgliteDir()));
}
