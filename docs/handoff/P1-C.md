# Handoff — P1-C (Web core)

Entregue: design system (`components/ui`), layout responsivo (`components/layout`), gráficos
(`components/charts`), cliente da API com refresh (`lib/api`), formatação/máscaras (`lib/format`),
rótulos (`lib/labels.ts`), hooks (`lib/hooks`), providers/router (`app/`), `features/auth`,
`features/referencias` e utilitários de teste (`test/`).

## Como uma feature se integra

```ts
// src/features/<feature>/index.ts
import { ArrowLeftRight } from 'lucide-react';
import type { AppModule } from '@/app/registry';

export const lancamentosModule: AppModule = {
  id: 'lancamentos',
  routes: [
    {
      path: '/lancamentos',
      lazy: async () => ({ Component: (await import('./pages/lista-page')).ListaPage }),
    },
  ],
  nav: [
    {
      id: 'lancamentos',
      label: 'Lançamentos',
      to: '/lancamentos',
      icon: ArrowLeftRight,
      ordem: 10,
      mobile: true,
    },
  ],
};
```

- Rotas são montadas dentro de `RequireAuth + AppShell` (caminhos absolutos, filhos de `/`).
- `nav.mobile: true` coloca o item na barra inferior (máx. 4; o resto vai para "Mais").
- `nav.grupo?: string` é respeitado pela sidebar se a feature informar (campo opcional, não tipado no registry).
- A feature `dashboard` deve registrar `{ index: true, ... }` (ou `path: '/'`); o placeholder de
  `app/inicio-placeholder.tsx` sai sozinho quando isso acontecer.

## Formulários

```tsx
const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { descricao: '', valor: null, data: hojeSP() },
});
<form
  onSubmit={form.handleSubmit((v) =>
    mutation.mutate(v, { onError: (e) => aplicarErrosDoServidor(e, form.setError) }),
  )}
  noValidate
>
  <FormRootError errors={form.formState.errors} />
  <FormInput control={form.control} name="descricao" label="Descrição" />
  <FormMoneyInput control={form.control} name="valor" label="Valor" />
  <FormDateInput control={form.control} name="data" label="Data" />
  <FormCombobox
    control={form.control}
    name="categoriaId"
    label="Categoria"
    options={categoriasParaOpcoes(categorias)}
  />
  <Button type="submit" loading={mutation.isPending}>
    Salvar
  </Button>
</form>;
```

Mutations que tratam o erro inline devem usar `meta: { silent: true }`; caso contrário o
`QueryClient` mostra um toast com `getErrorMessage(err)`. `meta: { sucesso: 'Salvo!' }` mostra toast de sucesso.

## Pedidos / observações para outros WPs

1. **P1-A (shared)** — `features/referencias/api.ts` define tipos locais mínimos (`CategoriaRef`,
   `ContatoRef`, `DasParametros`) porque `schemas/{categorias,contatos,obrigacoes}.ts` ainda eram
   placeholders. Quando publicados, trocar por `z.infer` dos schemas do shared e remover os locais.
   O mesmo vale para `isValidCPF/isValidCNPJ` em `lib/format/documento.ts` (podem virar reexport de
   `@meifin/shared/domain` quando `documentos.ts` existir — manter a API atual).
2. **P1-B (API)** — o web espera: `POST /auth/refresh` com cookie httpOnly em `path=/api/v1/auth`
   e resposta `{ accessToken }`; `GET /auth/me` → `{ data: { user, tenant } }`;
   erros `{ error: { code, message, details?: [{ campo, mensagem }] } }` com `campo` sem prefixo `body.`
   (o web remove `body.`/`query.`/`params.` se vier).
   O cliente **não** tenta refresh nas rotas públicas de auth (login/signup/refresh/logout/forgot/reset),
   mas tenta em `/auth/me` e `/auth/me/senha`.
3. **WP2 (lançamentos)** — o FAB/Topbar navegam para `/lancamentos?novo=receita|despesa`; use
   `useSearchParamsState('novo')` para abrir o drawer. Após mutações de dinheiro, invalidar também
   `referenciasKeys.contatos()`/`categorias()` se criar contatos/categorias inline (Combobox `onCreate`).
4. **WP4 (configurações)** — o menu do usuário mostra "Configurações" automaticamente quando existir
   um `NavItem` com `to: '/configuracoes'`. `useChangePassword()` já existe em `features/auth/hooks.ts`.
5. **Phase 3** — considerar mover `grupo` para o tipo `NavItem` em `app/registry.ts` (hoje é lido de
   forma tolerante em `components/layout/nav.ts`).

## Verificação executada

`pnpm --filter @meifin/shared build`, `pnpm --filter @meifin/web test`, `pnpm --filter @meifin/web typecheck`,
`pnpm --filter @meifin/web build`, `pnpm lint`, `pnpm format:check`. Fluxo real no navegador descrito
no relatório do agente (login/cadastro em desktop e 375px).
