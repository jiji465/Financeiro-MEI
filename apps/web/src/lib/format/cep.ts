// CEP: máscara e consulta ao ViaCEP (https://viacep.com.br) para preencher endereço.
import { onlyDigits } from './documento';

/** "01310100" → "01310-100" (parcial enquanto digita). */
export function maskCEP(texto: string | null | undefined): string {
  const d = onlyDigits(texto).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function isValidCEP(texto: string | null | undefined): boolean {
  return onlyDigits(texto).length === 8;
}

export interface EnderecoCEP {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface ViaCepResposta {
  erro?: boolean | string;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

/**
 * Consulta o ViaCEP. Retorna null quando o CEP não existe; lança Error em falha de rede.
 * `cep` aceita com ou sem máscara.
 */
export async function buscarCEP(
  cep: string,
  opcoes: { signal?: AbortSignal } = {},
): Promise<EnderecoCEP | null> {
  const digitos = onlyDigits(cep);
  if (digitos.length !== 8) return null;
  let res: Response;
  try {
    res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      signal: opcoes.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new Error('Não foi possível consultar o CEP. Verifique sua conexão.');
  }
  if (!res.ok) throw new Error('Serviço de CEP indisponível no momento.');
  const dados = (await res.json()) as ViaCepResposta;
  if (dados.erro) return null;
  return {
    cep: digitos,
    logradouro: dados.logradouro ?? '',
    complemento: dados.complemento ?? '',
    bairro: dados.bairro ?? '',
    cidade: dados.localidade ?? '',
    uf: dados.uf ?? '',
  };
}
