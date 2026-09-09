# Handoff — WP2 (Lançamentos + Recorrências + Importação CSV)

Entrega: API `lancamentos` (rotas, service, repository, anexos, recorrências, `test/isolation`),
`importacoes` (preview/confirmar/desfazer, dedupe por hash); web `features/lancamentos` (lista com
filtros na URL, drawer de criação/edição, anexo, marcar pago) e `features/relatorios/importar`
(assistente de importação em 4 passos).

## Correções feitas no que já estava em disco (P1-B/agente anterior desta feature)

1. **`apps/api/src/modules/lancamentos/repository.ts`**: `excluir` de uma recorrência ou de uma
   importação chamava `hardDelete`, confiando no `ON DELETE SET NULL` do FK composto
   `(tenant_id, recorrencia_id)` / `(tenant_id, importacao_id)`. No Postgres, `SET NULL` num FK
   **multi-coluna** zera **todas** as colunas do FK — inclusive `tenant_id`, que é `NOT NULL` — e a
   exclusão falhava com `23502` (`not_null_violation`) → 422 "Campo obrigatório ausente". Corrigido
   adicionando `desvincularRecorrencia`/`desvincularImportacao` (UPDATE explícito zerando só a
   coluna própria, incluindo linhas soft-deletadas) chamados antes do `hardDelete` em
   `recorrencias.service.ts` (`excluir`) e `importacoes/service.ts` (`desfazer`). Isso é uma
   armadilha genérica de FK composto com `ON DELETE SET NULL`; vale conferir se outros módulos
   (títulos, notas fiscais) têm o mesmo padrão antes de excluir registros referenciados por FK
   composto.
2. **`apps/api/src/modules/importacoes/routes.ts`**: erro de validação do mapeamento (multipart)
   duplicava o prefixo do campo (`mapeamento.mapeamento.valor` em vez de `mapeamento.valor`), porque
   o path do zod issue já inclui `mapeamento` (é o próprio campo do objeto validado). Corrigido para
   não prependar de novo.
3. **`apps/api/src/modules/lancamentos/lancamentos.test.ts`**: `payload: unknown` não batia com o
   tipo `InjectPayload | undefined` do fastify/light-my-request em `tsc -b` (só aparecia no
   typecheck, os testes passavam via esbuild). Trocado para `Record<string, unknown>`.
4. **`apps/api/src/modules/importacoes/importacoes.test.ts`**: BOM literal embutido no template
   string disparava `no-irregular-whitespace` do ESLint. Trocado pelo `BOM` exportado de
   `@meifin/shared/csv.ts`.

Com essas correções, `pnpm --filter @meifin/api exec vitest run` (suíte inteira) fica verde:
239 testes.

## Decisões de escopo do frontend

- Não foi criada uma página dedicada de gestão de recorrências (listar/pausar/editar todas). O
  plano (seção 7) só lista `/lancamentos` nas rotas do WP2; a recorrência é criada via switch
  "Repetir todo mês" no formulário de lançamento. A API já suporta CRUD completo de
  `/recorrencias` (`apps/api/src/modules/lancamentos/recorrencias.routes.ts`) caso um WP futuro (ou
  a Fase 3) queira expor essa tela.
- O assistente de importação (`features/relatorios/importar`) lê o cabeçalho do CSV **no
  navegador** (`parseCsvBrasileiro` do `@meifin/shared`, reexportado no `csv.ts`) para sugerir o
  mapeamento de colunas por heurística de nome, sem round-trip à API antes do usuário confirmar o
  mapeamento. Só a pré-visualização (`POST /csv/preview`) e a confirmação chamam a API.
- Linhas sem categoria correspondente (nem casada por nome nem categoria padrão configurada) não
  entram no `POST /csv/confirmar` — a UI mostra quantas ficaram de fora e orienta a escolher uma
  categoria padrão ou cadastrar a categoria antes de importar.

## Para outros WPs / Fase 3

- `apps/web/src/features/lancamentos/invalidate.ts` invalida
  `['lancamentos'],['recorrencias'],['contas'],['dashboard'],['relatorios'],['obrigacoes'],['contatos'],['referencias']`
  após qualquer mutação de dinheiro (criar/editar/excluir lançamento, pagar, anexo,
  recorrência) — reaproveitado por `features/relatorios/importar/hooks.ts` na confirmação/desfazer
  de importação.
- `features/relatorios/importar/**` é dono do WP2 (não do WP5), conforme a seção 9 do plano; a rota
  `/relatorios/importar` é registrada a partir de `features/lancamentos/index.ts` (não de
  `features/relatorios/index.ts`, que é do WP5) — ver comentário no topo do arquivo.
- Durante o smoke test manual notei que `apps/api` sobe com `tsx watch`, que reinicia (e, com
  `PGLITE_DATA_DIR=memory://`, zera o banco) sempre que `packages/shared/dist/**` muda — algo comum
  quando vários agentes rodam `pnpm --filter @meifin/shared build` em paralelo no mesmo repositório.
  Não é um bug do WP2, mas vale um aviso na Fase 3/README: rodar o smoke test com
  `PGLITE_DATA_DIR` apontando para uma pasta persistente (fora do OneDrive) evita perder a sessão de
  teste nesses reinícios.

## Verificação executada

- `pnpm --filter @meifin/shared build`
- `pnpm --filter @meifin/api exec vitest run` (239/239) e, focado,
  `vitest run src/modules/lancamentos src/modules/importacoes test/isolation.test.ts test/static-guard.test.ts`
  (112/112)
- `pnpm --filter @meifin/web exec vitest run src/features/lancamentos src/features/relatorios/importar`
  (7/7)
- `pnpm --filter @meifin/web exec tsc -b` e `pnpm --filter @meifin/api exec tsc -b` (limpos nos
  caminhos do WP2; `apps/api/src/modules/obrigacoes/obrigacoes.test.ts` tem um erro de tipo
  pré-existente de outro WP, não tocado aqui)
- `pnpm lint` (0 erros; avisos remanescentes são de arquivos de outros WPs, exceto um
  `react-hooks/incompatible-library` que troquei `form.watch` por `useWatch` para eliminar)
- `prettier --write` nos caminhos do WP2 + `pnpm format:check` (limpo nos meus caminhos)
- Fluxo manual no navegador (login, nova receita, nova despesa pendente, marcar como pago, editar
  com restrição de campos por origem, upload/remoção de anexo, filtros por período/tipo/status/
  categoria/contato/origem, assistente de importação CSV completo com dedupe, 375px de largura)
