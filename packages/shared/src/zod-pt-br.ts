// Mapa de erros do zod em pt-BR, aplicado globalmente ao importar o pacote.
// Base: locale "pt-BR" embutido no zod 4 (z.locales.ptBR()). P1-A (Shared) refina mensagens
// específicas via z.config({ customError }) se necessário.
import { z } from 'zod';

z.config(z.locales.ptBR());
