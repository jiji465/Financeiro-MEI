# Handoff — P1-A Shared (`@meifin/shared`)

Pedidos fora do escopo do WP (caminhos que P1-A não pode editar) e observações para os demais agentes.

## Pedidos para o orquestrador / Phase 3

1. **Comando de verificação com `--`** — `pnpm --filter @meifin/shared test -- --coverage` faz o pnpm 10
   repassar o `--` literalmente (`vitest run "--" "--coverage"`), e o Vitest **não liga a cobertura**
   (os testes rodam, mas sem relatório nem thresholds). Use `pnpm --filter @meifin/shared test --coverage`
   (sem `--`) ou ajuste o script raiz `test:coverage`. Os thresholds de `domain/**` (95% linhas / 90%
   branches) estão configurados em `packages/shared/vitest.config.ts` e passam.
2. **`pnpm format:check` falha em 49 arquivos de `apps/web`, `apps/api` e `scripts/`** (trabalho em andamento
   de P1-B/P1-C). Nenhum arquivo de `packages/shared` está na lista; não rodei `prettier --write` fora dos
   meus caminhos para não tocar arquivos de outros agentes.
3. `schemas/auth.ts` (congelado) não precisou de alteração. `configuracoes.ts` reutiliza `cnpjInput` de lá.

## Observações para P1-B (API) e Phase 2

- `centavosPositivos` (bootstrap) virou alias de `centavosPositivo`; `paginado` é alias de
  `paginatedResponse`; `paginacaoQuery` de `paginationQuery`. Os nomes antigos continuam exportados.
- `isoDate`/`competencia` usam `abort: true` no regex para não duplicar mensagens.
- Os DTOs de `obrigacoes.ts` (`parametrosMeiDto`, `detalhamentoDasDto`, `situacaoLimiteDto`, `alertaDto`) e
  `relatorios.ts` (`dreDto`) são checados com `satisfies z.ZodType<...>` contra os tipos puros de
  `domain/*`, então a API pode devolver diretamente o resultado de `situacaoLimite()`, `calcularDas()`,
  `gerarAlertas()` e `montarDre()`.
- `ParametrosMei` (domain/das.ts) espelha a tabela `parametros_mei` em camelCase; `selecionarParametros()`
  implementa o lookup "ano exato, senão maior ano ≤ pedido + desatualizado".
- Regime de apuração para o limite: `acumularReceitas(receitas, regime, ano)` já implementa
  competência (por `data`) × caixa (`coalesce(dataPagamento, data)` e status pago); a API pode replicar em SQL
  e passar só o `acumulado` para `situacaoLimite()`.
- `multipart`: `previewImportacaoCampos` faz o parse do campo `mapeamento` (JSON em string); existe também
  `previewImportacaoBody` (JSON puro com `conteudo`) caso o WP2 prefira não usar multipart no preview.
- `CATEGORIAS_PADRAO` + `categoriasPadraoPara(atividade)` alimentam o seed de categorias; a categoria de
  sistema chama-se `CATEGORIA_DAS_NOME` ("Impostos e DAS").
