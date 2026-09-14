// Passos fixos do tour de boas-vindas. Roteiro baseado no teste com uma persona de cliente novo:
// dashboard vazio sem norte, "Limite anual" sem explicação, alerta de "DAS em atraso" antes de saber
// o que é DAS, e o item de menu "Contas" ambíguo antes de clicar. Cada `alvo` é um seletor CSS de um
// elemento que já existe na tela (nenhuma tela precisou ganhar um atributo novo pra isso).
export interface PassoTour {
  id: string;
  /** Seletor CSS do elemento a destacar; sem `alvo` o balão aparece centralizado. */
  alvo?: string;
  titulo: string;
  texto: string;
}

export const PASSOS_TOUR: PassoTour[] = [
  {
    id: 'boas-vindas',
    titulo: 'Bem-vindo ao MEI Financeiro!',
    texto:
      'Vamos te mostrar rapidinho onde estão as coisas mais importantes. Isso leva menos de um minuto — e você pode pular quando quiser.',
  },
  {
    id: 'atalhos',
    alvo: 'nav[aria-label="Atalhos"]',
    titulo: 'Comece por aqui',
    texto:
      'Estes atalhos criam um lançamento, uma conta ou o DAS do mês em um clique. É o jeito mais rápido de começar a usar o sistema.',
  },
  {
    id: 'limite',
    alvo: '[data-testid="limite-card"]',
    titulo: 'Limite anual',
    texto:
      'O MEI só pode faturar até um teto por ano. Este card mostra quanto você já usou desse limite — ultrapassar pode tirar você do MEI.',
  },
  {
    id: 'alertas',
    alvo: 'section[aria-label="Alertas"]',
    titulo: 'Alertas e o DAS',
    texto:
      'Aqui aparecem avisos como "DAS em atraso". O DAS é a guia mensal que junta o INSS e, conforme sua atividade, o ICMS ou o ISS. Pagar em dia evita multa e juros.',
  },
  {
    id: 'menu',
    alvo: 'aside[aria-label="Menu principal"]',
    titulo: 'Menu principal',
    texto:
      'Por aqui você chega em lançamentos, contas, DAS e mais. Vamos ver dois itens que costumam gerar dúvida.',
  },
  {
    id: 'das',
    alvo: 'a[href="/das"]',
    titulo: 'Menu "DAS"',
    texto: 'Aqui você acompanha e paga o DAS de cada mês e envia a declaração anual (DASN-SIMEI).',
  },
  {
    id: 'contas',
    alvo: 'a[href="/contas/pagar"]',
    titulo: 'Menu "Contas"',
    texto:
      'São contas a pagar e a receber — compromissos com data de vencimento, diferente de um lançamento avulso.',
  },
  {
    id: 'fim',
    alvo: 'button[aria-label="Menu do usuário"]',
    titulo: 'Pronto!',
    texto:
      'Você já sabe o essencial. Para rever este tutorial depois, vá em Configurações → Preferências e clique em "Ver tutorial novamente".',
  },
];
