# MEI Financeiro

Sistema financeiro completo para Microempreendedores Individuais (MEI): lançamentos, categorias,
clientes e fornecedores, contas a pagar/receber, notas fiscais, DAS e obrigações, limite anual,
dashboard, relatórios (CSV/PDF), importação de extratos e configurações. Aplicação web
multiusuário (cada MEI é um _tenant_ isolado).

> **Estado atual:** v1 completa. Autenticação e multiusuário, lançamentos (com recorrência e
> anexos), clientes e fornecedores, contas a pagar/receber, notas fiscais, DAS/DASN e limite
> anual, dashboard, relatórios com exportação CSV/PDF, importação de extrato CSV e configurações
> — tudo implementado, testado e integrado.

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
- **Anexos/uploads (dev, `STORAGE_DRIVER=local`):** `%LOCALAPPDATA%\meifin\uploads` — pasta
  irmã da do PGlite, também fora do OneDrive e do repositório. Em produção com disco efêmero
  (ex.: Render), use `STORAGE_DRIVER=s3` (veja a seção de deploy abaixo).

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
| `STORAGE_DRIVER`                           | `local`                        | `s3` para anexos em disco efêmero (ex.: Render)  |

## Deploy: Vercel (frontend) + Render (API) + Supabase/Neon (banco)

Arranjo 100% gratuito, sem cartão de crédito. Três peças:

1. **Banco — Supabase ou Neon.** Crie um projeto gratuito em
   [supabase.com](https://supabase.com) ou [neon.tech](https://neon.tech) e copie a
   _connection string_ do Postgres (em produção use a porta 6543 / "Transaction pooler" do
   Supabase, ou a URL padrão do Neon). Guarde essa URL — é o `DATABASE_URL`.
2. **API — Render Web Service.** No painel do Render, "New" → "Blueprint", aponte para este
   repositório: o `render.yaml` da raiz já configura o build e o start. No painel, preencha
   apenas as variáveis marcadas como manuais: `DATABASE_URL` (a do passo 1), `APP_URL` e
   `CORS_ORIGIN` (o domínio que a Vercel vai te dar no passo 3 — pode deixar em branco e voltar
   aqui depois). `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` são gerados automaticamente pelo
   Render. As migrações são aplicadas automaticamente no boot (`start:prod`). Anote a URL que o
   Render gerar, por exemplo `https://meifin-api.onrender.com` — é o `API_ORIGIN` do próximo
   passo.

   > O plano gratuito do Render "dorme" após alguns minutos sem uso: a primeira requisição depois
   > de um tempo pode demorar ~30s para acordar. Normal em um plano gratuito.

3. **Frontend — Vercel.** Importe o repositório na Vercel **sem alterar o Root Directory**
   (deixe a raiz do repositório — o `vercel.json` cuida de instalar o workspace inteiro e
   compilar só `apps/web`, para que o pacote compartilhado `@meifin/shared` resolva
   corretamente). O `vercel.json` também define um _rewrite_ de `/api/*` para a API do Render,
   para que o navegador só converse com um único domínio (necessário para o cookie de sessão
   funcionar sem configuração extra de CORS entre domínios). Configure a variável de ambiente
   da Vercel `API_ORIGIN` com a URL do Render do passo 2 antes do primeiro deploy (o rewrite lê
   essa variável).
4. Volte no Render e atualize `APP_URL`/`CORS_ORIGIN` com o domínio final da Vercel, se ele
   mudou depois do primeiro deploy.

Depois do primeiro deploy, teste: abra o domínio da Vercel, crie uma conta, registre um
lançamento e confira o dashboard — tudo passa pela API no Render e pelo banco no
Supabase/Neon.

**Testar localmente contra o banco de produção:** cole a `DATABASE_URL` do Supabase/Neon no
`.env` e rode `pnpm dev` — a API troca de PGlite para Postgres sozinha, sem mudar código.

**Alternativa de um serviço só** (sem Vercel): defina `SERVE_WEB=true` e a própria API do
Render também serve os arquivos estáticos do `apps/web/dist` (build único, um domínio). Útil
para testes rápidos; o arranjo Vercel + Render acima é o recomendado para uso real.

**Anexos em produção:** por padrão os anexos de lançamentos/notas ficam em disco local, que no
Render é efêmero (some a cada deploy). Para produção, configure `STORAGE_DRIVER=s3` com um
bucket do [Supabase Storage](https://supabase.com/storage) (compatível com S3) — veja
`.env.example` para as variáveis `S3_*`.
