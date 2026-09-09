# Handoff — WP4 (Obrigações do MEI: DAS, DASN, limite, calendário, alertas + Configurações)

Estado ao retomar: API `modules/obrigacoes` (das, dasn, limite, calendário, alertas) e
`test/isolation/obrigacoes.ts` já estavam completos e testados (589 + 119 linhas, 105 testes
verdes) — só auditados, sem alterações. Web: `features/das` e `features/configuracoes` tinham
`api.ts`/`hooks.ts`/`keys.ts` prontos e os componentes principais (`LimiteCard`, `AlertasList`,
`DasTabela`, `DasStatusBadge`, `PagamentoDasDialog`) escritos, mas **nenhuma página existia** e os
dois `index.ts` eram stubs (`routes: [], nav: []`) — a feature não aparecia em lugar nenhum do
app. Completei: `pages/das-page.tsx` (abas DAS mensal/DASN via `?aba=`, seletor de ano,
explicações), `components/dasn-painel.tsx` + `components/dasn-dialog.tsx` (declarar/reabrir a
DASN-SIMEI), `pages/configuracoes-page.tsx` (abas Dados do MEI/Categorias/Preferências/Conta via
`?aba=`) e `components/{mei-form,preferencias-form,categoria-dialog,categorias-lista,
alterar-senha-form}.tsx`; liguei os dois `index.ts` (rotas lazy + nav); e escrevi
`utils.ts` (`aplicarErrosAninhados`, para erros `mei.*`/`preferencias.*` da API) e testes
(`limite-card.test.tsx`, `das-page.test.tsx`, `configuracoes-page.test.tsx` — 12 casos).

## Bugs corrigidos (código já em disco, não escrito por mim)

1. **`das-tabela.tsx`**: `competencia.total` não existe no DTO (é `competencia.valor` — o `total`
   fica dentro de `detalhamento`). Corrigido.
2. **`pagamento-das-dialog.tsx`**: schema/tipo do formulário não batiam com `z.input`/`z.output`
   (campo `valorPago` declarado `number` mas o `MoneyInput` manda `number | null`; `observacao`
   declarado obrigatório mas o schema o torna opcional). Troquei para o padrão do resto do app
   (`useForm<z.input<schema>, unknown, z.output<schema>>`) com `.transform` para validar
   "obrigatório mas aceita `null` como valor inicial do form".
3. **Mobile: ações da tabela de DAS colidiam no cartão mobile.** `DataTable` (P1-C) renderiza
   `rowActions` tanto na última coluna da tabela desktop quanto ao lado do cartão mobile (`<div
className="shrink-0">`, sem quebra de linha automática) — meu `acoes()` tinha dois botões lado
   a lado (`flex-wrap items-center justify-end`) que, no cartão mobile (largura ~140px), ficavam
   sobre o FAB e o conteúdo do cartão. Troquei para `flex-col items-stretch gap-1 md:flex-row
md:items-center md:justify-end` (empilha <768px, linha ≥768px). Confirmado por medição de
   `getBoundingClientRect()` (sem sobreposição) — screenshots do navegador neste ambiente tiveram
   um bug de composição (tiles duplicados) que não refletia o DOM real.
   **Atenção para outras features que usam `DataTable` com `mobileCard` + `rowActions` com mais de
   um botão** (contas, notas, lançamentos): o mesmo padrão pode ocorrer lá. Vale considerar
   resolver isso uma vez dentro do próprio `DataTable` (P1-C/Phase 3) em vez de em cada feature.

## Pedidos / observações para o orquestrador e Phase 3

1. **Ambiente de dev muito instável durante smoke tests concorrentes**: com vários agentes rodando
   `pnpm --filter @meifin/shared build` ao mesmo tempo, o `tsx watch` da minha API (e
   provavelmente das outras) reinicia a cada poucos minutos (o watcher observa
   `packages/shared/dist/**`), derrubando o banco em memória (`PGLITE_DATA_DIR=memory://`) no meio
   de qualquer teste manual. Isso derrubou duas contas de teste que eu tinha acabado de criar via
   UI. Não é um bug do meu código — só registro para quem for revisar smoke tests em Phase 3 rodar
   isoladamente (sem outros `pnpm dev`/`build` de shared concorrentes) ou usar
   `PGLITE_DATA_DIR` em arquivo (não `memory://`) para sobreviver a restarts.
2. **`LimiteCard`/`AlertasList` exportados de `@meifin/shared`... digo, de `@/features/das`** (via
   `export { LimiteCard, ... } from './components/limite-card'` em `features/das/index.ts`) —
   confirmado funcionando: o dashboard do WP5 já os importa e renderiza (`Limite anual 2026` e a
   lista de alertas críticos aparecem na Home). `LimiteCardProps = { ano?: number; compacto?:
boolean; className?: string }`; `AlertasListProps = { maxItens?; compacto?; tipos?: readonly
string[]; titulo?; className? }`.
3. **`categoriaDasId` em Preferências**: expus um `Select` com as categorias de despesa para
   trocar a categoria usada nos pagamentos de DAS (o backend já suportava, só não tinha UI).
4. Não criei seletor de ano-base independente na aba DASN além do já feito (`?anoBase=`,
   padrão ano atual − 1); não constrói `calendário` como widget visual — interpretei "calendário
   anual" do plano como a própria tabela de 12 competências (já é o que `GET /calendario`
   alimentaria em outro lugar, ex. dashboard "próximos vencimentos", que o WP5 já implementou).

## Verificação executada

- `pnpm --filter @meifin/shared build`
- `pnpm --filter @meifin/api exec vitest run src/modules/obrigacoes test/isolation.test.ts
test/static-guard.test.ts` — 113 testes verdes (105 do módulo + isolamento/guarda cobrindo mais
  recursos de outros WPs entrando em paralelo).
- `pnpm --filter @meifin/web exec vitest run src/features/das src/features/configuracoes` — 12
  testes verdes (15 contando um 4º arquivo de `features/dashboard` capturado pelo filtro por
  conter "das" em "dashboard").
- `tsc -b` limpo em `apps/web` e `apps/api`; `eslint`/`prettier` limpos nos meus caminhos.
- Smoke manual: cadastro como serviços (abertura 03/2026) → DAS mostra R$ 86,05/mês, atraso e
  "próximo dia útil" corretos (ex. 20/06/2026 cai no sábado → vence 22/06); marcar DAS de março
  como pago gera a despesa "DAS MEI 03/2026" em "Impostos e DAS" (visto em `/lancamentos`);
  `LimiteCard` mostra "10 meses × R$ 6.750,00 = R$ 67.500,00" (proporcional correto); mudar
  atividade para comércio e serviços em Configurações → todo o DAS (inclusive competências já
  atrasadas, recalculadas com os dados atuais do tenant) passa a R$ 87,05 — confirmado tanto via
  API direta quanto na UI (dashboard e `/das`). Mobile 375px conferido via DOM (ver bug #3 acima).
