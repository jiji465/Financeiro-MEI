# MEI Financeiro

Sistema financeiro completo para Microempreendedores Individuais (MEI): lançamentos, categorias,
clientes e fornecedores, contas a pagar/receber, notas fiscais, DAS e obrigações, limite anual,
dashboard, relatórios (CSV/PDF), importação de extratos e configurações. Aplicação web
multiusuário (cada MEI é um _tenant_ isolado).

> **Estado atual:** Phase 0 (bootstrap). A estrutura, as ferramentas e os contratos estão
> prontos; as funcionalidades chegam nas próximas fases.

## Requisitos

- **Node.js 22.12 ou superior** (22.x) — https://nodejs.org
- **pnpm 10** — `corepack enable` ou `npm i -g pnpm@10`
- **Git 2.x**

Não é necessário instalar Docker nem PostgreSQL: em desenvolvimento o banco é o
[PGlite](https://pglite.dev) (Postgres em WebAssembly, arquivo local). Em produção usa-se um
Postgres gerenciado gratuito (Supabase ou Neon) sem mudar código.

## Primeiros passos (PowerShell)

```powershell
cd "C:\Users\user 01\OneDrive\Desktop\Sistema financeiro"
Copy-Item .env.example .env        # ajuste se quiser; os padrões funcionam em dev
pnpm install
pnpm env:check                     # confere Node, pasta do banco e avisos
pnpm dev                           # sobe shared (watch), API (3333) e web (5173)
```

Abra http://127.0.0.1:5173. A API responde em http://127.0.0.1:3333/api/v1/health e a
documentação OpenAPI em http://127.0.0.1:3333/docs.

Para validar tudo de uma vez (mesmo comando da CI):

```powershell
pnpm check                         # typecheck + lint + format + testes + smoke
```

## Scripts (raiz)

| Script                          | O que faz                                                             |
| ------------------------------- | --------------------------------------------------------------------- |
| `pnpm dev`                      | Compila o shared e sobe shared (watch), API e web em paralelo         |
| `pnpm build`                    | Build de todos os pacotes (`packages/shared`, `apps/api`, `apps/web`) |
| `pnpm typecheck`                | `tsc -b` em todo o monorepo                                           |
| `pnpm lint`                     | ESLint 9 (flat config)                                                |
| `pnpm format` / `format:check`  | Prettier (grava / só verifica)                                        |
| `pnpm test` / `test:watch`      | Vitest em todos os projetos                                           |
| `pnpm test:coverage`            | Vitest com cobertura (v8)                                             |
| `pnpm smoke`                    | Sobe a API em processo (PGlite em memória) e exercita rotas reais     |
| `pnpm check`                    | typecheck + lint + format:check + test + smoke                        |
| `pnpm db:generate`              | Gera migração SQL a partir do schema Drizzle                          |
| `pnpm db:migrate`               | Aplica migrações no banco configurado                                 |
| `pnpm db:push`                  | Sincroniza o schema direto (só em desenvolvimento)                    |
| `pnpm db:seed` / `db:seed:demo` | Seeds de parâmetros / dados de demonstração                           |
| `pnpm db:reset`                 | Apaga o PGlite local e recria o banco                                 |
| `pnpm db:backup`                | Exporta o PGlite local para `%LOCALAPPDATA%\meifin\backups`           |
| `pnpm env:check`                | Mostra a configuração efetiva e avisos de ambiente                    |
| `pnpm clean`                    | Remove `dist`, `coverage`, `.data` e `*.tsbuildinfo`                  |

## Onde ficam os dados

- **Banco (dev):** `%LOCALAPPDATA%\meifin\pglite` (ex.: `C:\Users\<você>\AppData\Local\meifin\pglite`).
  Propositalmente **fora do OneDrive**. Para mudar, defina `PGLITE_DATA_DIR` no `.env`.
- **Backups:** `%LOCALAPPDATA%\meifin\backups`.
- **Testes:** PGlite em memória (`memory://`), nada é gravado em disco.
- **Anexos/uploads (dev):** `.data/` dentro do repositório (ignorado pelo git).

## Aviso sobre OneDrive

Esta pasta está dentro do OneDrive. A sincronização pode travar arquivos de `node_modules` e de
builds, deixando `pnpm install` lento ou com erros. Mitigações já aplicadas: dados do banco fora
do OneDrive, `node_modules` _hoisted_ e `.gitignore` completo. Recomendações:

- mover o repositório para uma pasta fora da sincronização (ex.: `C:\dev\meifin`), **ou**
- pausar o OneDrive durante `pnpm install`.

`pnpm env:check` avisa quando detecta OneDrive ou espaços no caminho.

## Estrutura

```
├─ packages/shared   @meifin/shared — constantes (enums), schemas zod, dinheiro/datas, regras de domínio
├─ apps/api          @meifin/api    — Fastify 5 + Drizzle (pg-core) + PGlite/pg, OpenAPI em /docs
├─ apps/web          @meifin/web    — React 19 + Vite 7 + React Router 7 + TanStack Query + Tailwind 4
├─ scripts/          smoke.ts, check-env.ts, clean.ts
└─ docs/handoff/     pedidos fora de escopo entre pacotes de trabalho
```

Convenções principais: dinheiro sempre em **centavos inteiros**; datas de negócio como string
`AAAA-MM-DD` com "hoje" em `America/Sao_Paulo`; toda tabela de negócio tem `tenant_id` e o acesso
entre tenants devolve 404; textos, commits e documentação em pt-BR.

## Variáveis de ambiente

Veja `.env.example`. As mais importantes:

| Variável                                   | Padrão                         | Observação                                       |
| ------------------------------------------ | ------------------------------ | ------------------------------------------------ |
| `DATABASE_URL`                             | vazio → PGlite                 | Cole a URL do Supabase/Neon em produção          |
| `PGLITE_DATA_DIR`                          | `%LOCALAPPDATA%\meifin\pglite` | Testes usam `memory://`                          |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | valores `dev-…`                | ≥ 32 caracteres; produção rejeita prefixo `dev-` |
| `SERVE_WEB` / `WEB_DIST_DIR`               | `false` / `apps/web/dist`      | API serve o frontend compilado                   |
| `SWAGGER`                                  | `true` fora de produção        | Documentação em `/docs`                          |

## Deploy (resumo)

1. Crie um projeto gratuito no [Supabase](https://supabase.com) ou [Neon](https://neon.tech) e copie a
   _connection string_ (Postgres).
2. No servidor (Railway, Render ou similar) defina `NODE_ENV=production`, `DATABASE_URL=<URL copiada>`,
   `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` (aleatórios, ≥ 32 caracteres), `SERVE_WEB=true`,
   `HOST=0.0.0.0` e `APP_URL=https://<seu-dominio>`.
3. Build: `pnpm install && pnpm build`. Start: `pnpm --filter @meifin/api start:prod`.
   As migrações são aplicadas automaticamente no boot.

Para testar localmente contra o Supabase/Neon basta colar a `DATABASE_URL` no `.env` e rodar
`pnpm dev` — a API troca de PGlite para Postgres sozinha.
