# Notas para a Phase 3 (integração)

## Risco verificado: FK composta com ON DELETE SET NULL
O WP2 encontrou e corrigiu um bug real: no Postgres, `SET NULL` em uma foreign key
composta `(tenant_id, x_id)` zera **todas** as colunas da FK ao apagar a linha
referenciada — inclusive `tenant_id`, que é `NOT NULL` em `lancamentos`. Isso quebrava
`hardDelete` de recorrências e importações (violação `23502`).

Correção aplicada em `apps/api/src/modules/lancamentos/repository.ts`
(`desvincularRecorrencia`/`desvincularImportacao`, UPDATE explícito só na coluna alvo
antes do `hardDelete`).

**Verificado nesta sessão (2026-09-09):** os únicos outros usos de `hardDelete` no
código são `recorrencias` (já corrigido) e `apps/api/src/modules/obrigacoes/repository.ts`
(`dasPagamentos`) — nada referencia `das_pagamentos` via FK, então esse caso é seguro.
Se algum WP futuro adicionar um novo `hardDelete` sobre uma tabela referenciada por FK
composta com `onDelete: 'set null'`, aplicar o mesmo padrão de desvincular explicitamente
antes de apagar.

## Risco a revisar: DataTable com rowActions no mobileCard
WP4 encontrou (e contornou localmente, sem tocar no componente) uma colisão visual: quando
`rowActions` tem mais de um botão, no `mobileCard` do `DataTable` (`apps/web/src/components/ui`)
os botões ficam lado a lado sem quebra automática (`shrink-0` sem wrap), podendo sobrepor
conteúdo em telas estreitas. O workaround local foi `flex-col items-stretch gap-1 md:flex-row
md:items-center md:justify-end` no callback `rowActions` da própria feature.
Features que usam `DataTable` com `mobileCard` + múltiplos `rowActions` (contas, notas,
lançamentos, contatos) podem ter o mesmo problema. Recomenda-se corrigir uma vez dentro do
próprio `DataTable` na Phase 3, e então remover os workarounds locais se sobrarem.
