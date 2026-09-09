// Envio de e-mail. Sem provedor real na v1: ConsoleMailer registra a mensagem (e o link de
// redefinição) no log pino; MemoryMailer guarda as mensagens para os testes.
import type { FastifyBaseLogger } from 'fastify';

export interface MensagemEmail {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}

export interface Mailer {
  enviar(mensagem: MensagemEmail): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  constructor(private readonly log: FastifyBaseLogger) {}

  async enviar(mensagem: MensagemEmail): Promise<void> {
    this.log.info(
      { para: mensagem.para, assunto: mensagem.assunto },
      `E-mail (console) para ${mensagem.para}: ${mensagem.assunto}\n${mensagem.texto}`,
    );
  }
}

export class MemoryMailer implements Mailer {
  readonly enviados: MensagemEmail[] = [];

  async enviar(mensagem: MensagemEmail): Promise<void> {
    this.enviados.push(mensagem);
  }

  ultimoPara(email: string): MensagemEmail | undefined {
    return [...this.enviados].reverse().find((m) => m.para === email);
  }

  limpar(): void {
    this.enviados.length = 0;
  }
}
