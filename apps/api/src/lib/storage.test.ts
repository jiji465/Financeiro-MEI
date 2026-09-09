// Testes do adaptador S3 (mockando @aws-sdk/client-s3, sem rede) e da escolha de driver em
// criarStorage(). LocalDiskStorage já é exercitado indiretamente pelos testes de anexo dos
// módulos de lançamentos/notas fiscais.
import { describe, expect, it, vi } from 'vitest';

const enviosRegistrados: Array<{ nome: string; input: Record<string, unknown> }> = [];
let proximaResposta: (() => unknown) | null = null;
let proximoErro: unknown = null;

class ComandoFalso {
  constructor(
    readonly nome: string,
    readonly input: Record<string, unknown>,
  ) {}
}

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    async send(comando: ComandoFalso) {
      enviosRegistrados.push({ nome: comando.nome, input: comando.input });
      if (proximoErro) {
        const erro = proximoErro;
        proximoErro = null;
        throw erro;
      }
      return proximaResposta ? proximaResposta() : {};
    }
  },
  PutObjectCommand: class extends ComandoFalso {
    constructor(input: Record<string, unknown>) {
      super('PutObjectCommand', input);
    }
  },
  GetObjectCommand: class extends ComandoFalso {
    constructor(input: Record<string, unknown>) {
      super('GetObjectCommand', input);
    }
  },
  DeleteObjectCommand: class extends ComandoFalso {
    constructor(input: Record<string, unknown>) {
      super('DeleteObjectCommand', input);
    }
  },
  HeadObjectCommand: class extends ComandoFalso {
    constructor(input: Record<string, unknown>) {
      super('HeadObjectCommand', input);
    }
  },
}));

const { S3Storage, LocalDiskStorage, criarStorage } = await import('./storage.js');
const { NotFoundError } = await import('./errors.js');

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

function novoS3() {
  enviosRegistrados.length = 0;
  proximaResposta = null;
  proximoErro = null;
  return new S3Storage({
    endpoint: 'https://exemplo.supabase.co/storage/v1/s3',
    region: 'auto',
    bucket: 'anexos',
    accessKeyId: 'chave',
    secretAccessKey: 'segredo',
    forcePathStyle: true,
  });
}

describe('S3Storage', () => {
  it('salva um arquivo com chave única sob o tenant e devolve os metadados', async () => {
    const storage = novoS3();
    const salvo = await storage.salvar(TENANT_ID, {
      nome: 'nota fiscal.pdf',
      mime: 'application/pdf',
      conteudo: Buffer.from('conteudo'),
    });

    expect(salvo.path.startsWith(`${TENANT_ID}/`)).toBe(true);
    expect(salvo.path.endsWith('.pdf')).toBe(true);
    expect(salvo.nome).toBe('nota fiscal.pdf');
    expect(salvo.mime).toBe('application/pdf');
    expect(salvo.tamanho).toBe(Buffer.byteLength('conteudo'));

    expect(enviosRegistrados).toHaveLength(1);
    expect(enviosRegistrados[0]?.nome).toBe('PutObjectCommand');
    expect(enviosRegistrados[0]?.input).toMatchObject({
      Bucket: 'anexos',
      Key: salvo.path,
      ContentType: 'application/pdf',
    });
  });

  it('lê um arquivo existente convertendo o corpo para Buffer', async () => {
    const storage = novoS3();
    proximaResposta = () => ({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });

    const conteudo = await storage.ler(`${TENANT_ID}/algum.pdf`);

    expect(Buffer.isBuffer(conteudo)).toBe(true);
    expect([...conteudo]).toEqual([1, 2, 3]);
    expect(enviosRegistrados[0]?.nome).toBe('GetObjectCommand');
  });

  it('converte erro "não encontrado" do S3 em NotFoundError ao ler', async () => {
    const storage = novoS3();
    proximoErro = Object.assign(new Error('not found'), { name: 'NoSuchKey' });

    await expect(storage.ler(`${TENANT_ID}/inexistente.pdf`)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('remove um arquivo via DeleteObjectCommand', async () => {
    const storage = novoS3();
    await storage.remover(`${TENANT_ID}/algum.pdf`);

    expect(enviosRegistrados[0]?.nome).toBe('DeleteObjectCommand');
    expect(enviosRegistrados[0]?.input).toMatchObject({
      Bucket: 'anexos',
      Key: `${TENANT_ID}/algum.pdf`,
    });
  });

  it('existe() retorna true quando o HEAD tem sucesso e false em 404', async () => {
    const storage = novoS3();
    proximaResposta = () => ({});
    await expect(storage.existe(`${TENANT_ID}/algum.pdf`)).resolves.toBe(true);

    proximoErro = { $metadata: { httpStatusCode: 404 } };
    await expect(storage.existe(`${TENANT_ID}/inexistente.pdf`)).resolves.toBe(false);
  });

  it('propaga erros que não são "não encontrado"', async () => {
    const storage = novoS3();
    proximoErro = new Error('falha de rede');

    await expect(storage.existe(`${TENANT_ID}/algum.pdf`)).rejects.toThrow('falha de rede');
  });
});

describe('criarStorage', () => {
  it('usa LocalDiskStorage por padrão (STORAGE_DRIVER local)', () => {
    const storage = criarStorage({ STORAGE_DRIVER: 'local', PGLITE_DATA_DIR: 'memory://' });
    expect(storage).toBeInstanceOf(LocalDiskStorage);
  });

  it('usa S3Storage quando STORAGE_DRIVER=s3', () => {
    const storage = criarStorage({
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'https://exemplo.supabase.co/storage/v1/s3',
      S3_REGION: 'auto',
      S3_BUCKET: 'anexos',
      S3_ACCESS_KEY_ID: 'chave',
      S3_SECRET_ACCESS_KEY: 'segredo',
      S3_FORCE_PATH_STYLE: true,
    });
    expect(storage).toBeInstanceOf(S3Storage);
  });
});
