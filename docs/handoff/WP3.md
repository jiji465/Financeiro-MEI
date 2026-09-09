# Handoff — WP3 (Contas a pagar/receber + Notas fiscais)

Entrega: API `titulos`/`parcelas` (baixa, estorno, cancelamento, resumo) e `notas-fiscais`
(CRUD, `gerarReceita`, cancelar, arquivo, vincular, resumo) — já estavam completas em disco ao
retomar a sessão, auditadas e sem alterações necessárias. Web: `features/contas` (páginas
`/contas/pagar` e `/contas/receber`, que faltavam — só os diálogos e hooks existiam) e
`features/notas` (feature inteira, construída do zero: `api.ts`, `keys.ts`, `hooks.ts`,
`invalidate.ts`, diálogos de registrar/cancelar/detalhe com upload de arquivo, página de lista).

## Pedidos para o orquestrador / Phase 3

1. **`pnpm typecheck` (web) falha em `apps/web/src/features/configuracoes/**`** — dois erros
   pré-existentes, fora do meu escopo (WP4): `categorias-lista.tsx` importa `toast` sem usar e
   chama `useToast` (não definido/importado); `mei-form.tsx` passa `'mei.'` onde
   `aplicarErrosDoServidor`/similar espera `{ campos?: readonly string[] }`. Não toquei nesses
   arquivos. `apps/web/src/features/{contas,notas}/**` typecheca limpo isoladamente.
2. **`features/contas/index.ts` e `features/contas/{api,hooks,keys,invalidate,utils}.ts` já
   existiam completos** (de uma sessão anterior) — só faltava `pages/lista-page.tsx` (as duas
   rotas `/contas/pagar` e `/contas/receber`) e a ligação em `index.ts` (routes/nav). Os três
   diálogos (`nova-conta-dialog`, `baixa-dialog`, `titulo-detalhe-dialog`) já estavam prontos e
   foram só consumidos pela página nova.
3. **`nota-detalhe-dialog.tsx`**: o botão "Baixar" do arquivo usa `api.blob()` (Bearer) +
   `baixarBlob()`, não um `<a href>` direto para `/api/v1/notas-fiscais/:id/arquivo` — a API exige
   `Authorization: Bearer`, que um link de navegador não envia. Qualquer outra feature que baixe
   arquivos autenticados deve seguir o mesmo padrão (`lib/api/download.ts`).
4. **Vínculo nota↔lançamento na UI**: implementei apenas "desvincular" (chama
   `POST /:id/vincular` com `lancamentoId: null`) a partir do detalhe da nota. Não construí um
   seletor para _vincular_ a uma receita já existente (exigiria buscar lançamentos, e
   `features/lancamentos` ainda não tem `api.ts`/hooks nesta sessão) — o endpoint
   `useVincularNota` já está pronto no hook para quando isso for adicionado.
5. **Resumo de notas por mês**: uso `GET /notas-fiscais/resumo?ano=<ano atual em America/Sao_Paulo>`
   sem seletor de ano na UI (mostra sempre o ano corrente). Se quiserem navegação por ano, é só
   adicionar um `SimpleSelect`/`?ano=` na página — o hook `useResumoNotas(ano)` já aceita o
   parâmetro.

## Verificação executada

- `pnpm --filter @meifin/shared build`
- `pnpm --filter @meifin/api exec vitest run src/modules/titulos src/modules/notas-fiscais
test/isolation.test.ts test/static-guard.test.ts` — 20 + 78 testes verdes.
- `pnpm --filter @meifin/web exec vitest run src/features/contas src/features/notas` — 8 testes
  verdes (4 + 4).
- `npx tsc -b --force` em `apps/web` — limpo em `features/{contas,notas}` (erros restantes são de
  `features/configuracoes`, ver item 1).
- `npx eslint` nos caminhos próprios — limpo.
- `npx prettier --write` só nos caminhos próprios.
- Smoke manual no navegador: cadastro, conta a pagar parcelada, baixa de parcela, registro de
  nota com `gerarReceita` (ver relatório do agente).
