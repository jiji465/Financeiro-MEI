# Handoff — P1-B (API core)

Entrega: schema Drizzle completo + migração `0000_init`, plugins, `lib/*`, seeds, módulos `auth`,
`configuracoes`, `categorias`, `modules/lancamentos/core.ts` (congelado) e a base de testes
(isolamento, guarda estática, paridade de driver, migrações).

## Para o integrador (Phase 3)

1. **Enums do banco em `apps/api/src/db/schema/enums.ts`** — `db/schema/index.ts` ganhou uma linha
   `export * from './enums.js'` (única edição no índice; evita import circular entre grupos de tabelas).
   Adicionar valor a um enum = editar `@meifin/shared/constants` + migração nova.
2. **`parametros_mei` tem duas colunas extras** além da seção 3 do plano: `confirmado boolean`
   (2025 = `false`, "a confirmar") e `observacoes text`. O alerta `parametros:<ano>:desatualizados`
   (WP4) pode usar `confirmado = false` além do "ano mais próximo".
3. **Swagger/CSP**: `helmet` continua com `contentSecurityPolicy: false` (Swagger UI e SPA em
   `SERVE_WEB` carregam scripts inline). Em produção a API só devolve JSON; se quiser CSP, ligar só
   quando `SWAGGER=false && SERVE_WEB=false`.
4. **Rate limit**: global 300 req/min por IP; `login` e `forgot-password` 10 por 15 min
   (`RATE_LIMIT_AUTH` em `plugins/security.ts`). Nos testes é desligado por
   `BuildAppOptions.rateLimit=false` (`test/rate-limit.test.ts` liga de novo). Em produção atrás de
   proxy (Render) o `trustProxy` já é `true` — conferir se o `X-Forwarded-For` chega correto.
5. **Storage** local em `<pasta do PGlite>/../uploads/<tenantId>/<uuid>.<ext>` (`lib/storage.ts`).
   O adaptador S3 (Supabase) entra em `criarStorage()` selecionado por `STORAGE_DRIVER` (variável a
   criar em `env.ts` na Phase 3; não adicionei variáveis de ambiente).
6. **Seeds no boot**: `main.ts` chama `runSeeds(db)` depois de `migrate()` (só parâmetros MEI,
   idempotente). `pnpm db:seed:demo` imprime "implementado na Phase 3" — `db/seed/demo.ts` é do WP5.
7. **`pnpm format`** foi rodado só nos caminhos do P1-B (`prettier --write apps/api scripts/smoke.ts`)
   para não reescrever arquivos que P1-A/P1-C estavam editando ao mesmo tempo.

## Para o P1-A (shared)

- `atualizarConfiguracoesBody.preferencias = preferencias.partial()`: como cada campo tem
  `.default()`, o zod 4 preenche as chaves omitidas com o default — o "partial" chega completo na
  API e sobrescreve o que o usuário já tinha. A API faz merge com o que está salvo, mas isso não
  ajuda porque o body já vem preenchido. Sugestão: `preferenciasDto.partial()` (sem defaults) no
  body, mantendo `preferencias` (com defaults) só para leitura/normalização.
- `validarCNPJ` do `domain/documentos` é usado no signup e no PATCH de configurações (CNPJ com
  dígitos errados → 400 `VALIDATION_ERROR` campo `cnpj` / `mei.cnpj`).
- O template `CATEGORIAS_PADRAO` e `CATEGORIA_DAS_NOME` já são a fonte do seed
  (`db/seed/categorias-padrao.ts` só materializa as linhas). "Outras receitas" vem com
  `grupoDasn: null` para todas as atividades — o alerta `dasn:categoria_sem_grupo` vai disparar
  para todo MEI que usar essa categoria; considerar `comercio`/`servicos` quando a atividade é única.
- Schemas locais foram **removidos**: `categorias` e `configuracoes` da API usam
  `@meifin/shared/schemas/{categorias,configuracoes}` diretamente.

## Para o P1-C / WP4 (web)

- Respostas: `GET /categorias` → `{ data: CategoriaDto[] }` (sem `meta`); `DELETE /categorias/:id`
  → `{ data: { id, excluida, desativada, lancamentosVinculados } }`; `GET/PATCH /configuracoes` →
  `{ data: ConfiguracoesDto }` com `mei.endereco` sempre objeto (campos `null`) e `preferencias`
  sempre completa.
- Auth: refresh token só em cookie `refresh_token` (httpOnly, `path=/api/v1/auth`,
  `sameSite=lax`, `secure` em produção). `POST /auth/refresh` rotaciona (cookie novo a cada
  chamada); reapresentar um cookie já rotacionado derruba **todas** as sessões do usuário (401
  "Sessão reutilizada"). `PATCH /auth/me/senha` devolve `{ accessToken }` + cookie novo e revoga
  as outras sessões. `POST /auth/logout` → 204 e limpa o cookie.
- Erros de conflito no signup: `409 CONFLICT` com `details: [{ campo: 'email' | 'cnpj', … }]`
  (não existe código `EMAIL_EM_USO`/`CNPJ_EM_USO` no enum de erros do shared; a mensagem e o campo
  em `details` identificam o caso).

## Para o WP2 (lançamentos) e demais WPs

- Criar/excluir lançamentos **só** via `criarLancamentoInterno(tx, tenantId, input)` /
  `excluirLancamentoInterno(tx, tenantId, id)` em `modules/lancamentos/core.ts` (congelado).
- Categoria "Impostos e DAS": `getCategoriaSistema(exec, tenantId, 'das')` em
  `modules/categorias/core.ts` (recria e religa `configuracoes.categoria_das_id` se sumir).
- Isolamento: cada WP cria `apps/api/test/isolation/<modulo>.ts` exportando
  `recursos: RecursoIsolamento[]` (tipos em `test/isolation/_registry.ts`). O runner
  `test/isolation.test.ts` falha se alguma rota com `:param` de `app.printRoutes()` não estiver em
  `rotasCobertas` de algum recurso.
- Guarda estática: `db|tx|exec.select|insert|update|delete|execute(` só em `*repository.ts`,
  `core.ts`, `lib/tenant-db.ts` e `src/db/**`. Services usam `forTenant()` e repositories.
- Registrar rotas de coleção como `''` (não `'/'`) dentro do prefixo do módulo, para o OpenAPI não
  gerar `/api/v1/x/` com barra final.
