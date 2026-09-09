# Handoff — WP1 (Contatos: clientes e fornecedores)

Entrega: API `contatos` (CRUD com soft delete, `/opcoes`, `/:id/lancamentos`, `/:id/resumo`,
CPF/CNPJ validado e único por tenant) e web `features/contatos` (lista com abas cliente/fornecedor
e busca, formulário com máscaras + ViaCEP, ficha com resumo financeiro e histórico). Tudo já
estava completo em disco ao retomar a sessão — API, web, teste de módulo, teste de isolamento e
os dois arquivos de teste de componente já existiam e estavam corretos. Auditei os cinco arquivos
da API, os onze da web e o `test/isolation/contatos.ts` linha a linha contra a seção 3/4/6/7 do
plano; não encontrei nada quebrado ou faltando (CRUD, busca com ILIKE escapado, resumo com
receitas/despesas/parcelas/notas, histórico paginado com totais, soft delete que preserva
lançamentos vinculados, `/opcoes` enxuto para seletores, isolamento por tenant nas 5 rotas com
`:id` + nas listagens). Não precisei alterar nenhum arquivo — só verificar e rodar as suítes.

## Verificação executada

- `pnpm --filter @meifin/shared build` — limpo.
- `pnpm --filter @meifin/api exec vitest run src/modules/contatos test/isolation.test.ts
test/static-guard.test.ts` — **89 testes verdes** (3 arquivos).
- `pnpm --filter @meifin/web exec vitest run src/features/contatos` — **10 testes verdes**
  (`lista-page.test.tsx` + `form-page.test.tsx`). Numa das muitas rodadas (sistema sob carga
  pesada de vários agentes simultâneos) `form-page.test.tsx` falhou de forma não determinística
  (um `user.clear`+`type` produziu `"sMaria Editada"` em vez de `"Maria Editada"`); rodei mais 4
  vezes em seguida e passou sempre — não encontrei nada no meu código que explique a falha e
  atribuo a contenção de CPU no ambiente (vários `tsx watch`/`vite` de outros agentes reiniciando
  ao mesmo tempo). Vale re-observar se voltar a acontecer fora desse cenário.
- `pnpm --filter @meifin/api typecheck` — limpo em `modules/contatos`; falhas pré-existentes em
  `modules/lancamentos/lancamentos.test.ts`, `modules/obrigacoes/obrigacoes.test.ts` e
  `modules/relatorios/routes.ts` (fora do meu escopo — WP2/WP4/WP5).
- `pnpm --filter @meifin/web typecheck` — limpo (sem ressalvas).
- `pnpm lint` — limpo em `apps/api/src/modules/contatos` e `apps/web/src/features/contatos`; os
  únicos erros do repositório são em `modules/importacoes` e `modules/relatorios` (outros WPs).
- `npx prettier --write` nos meus caminhos — nenhum arquivo precisou de mudança (já formatados).
  `pnpm format:check` não lista nenhum arquivo de `contatos` entre os 53 pendentes (todos de
  `titulos`, `contas`, `das`, `notas`, `relatorios`, `configuracoes` — outros WPs em andamento).
- Smoke manual no navegador (`API_PORT=3341`/`WEB_PORT=5181`, `PGLITE_DATA_DIR=memory://`):
  cadastro de MEI → `/contatos` (vazio) → `/contatos/novo` com CEP `01310-100` (ViaCEP preencheu
  logradouro/bairro/cidade/UF automaticamente) → detalhe com StatCards de resumo e histórico vazio
  → editar nome → salvar → volta à ficha atualizada. Repeti em 375px: layout de cartão/rádio-cards
  em coluna única, bottom nav + FAB, tudo legível e utilizável. Console sem erros de React; os
  únicos erros de rede vistos (401/500 esporádicos) coincidem com reinícios do meu próprio
  `tsx watch`/`vite dev` causados por outros agentes editando `packages/shared` e
  `db/seed/index.ts` em paralelo — não são causados pelo módulo contatos.

## Observações para outros WPs / Phase 3

- `features/contatos/hooks.ts` já invalida `referenciasKeys.all` além de `contatosKeys.all` em
  toda mutação, então `useContatosOpcoes` (usado por lançamentos/contas/notas) fica atualizado
  automaticamente após criar/editar/excluir um contato.
- O endpoint `/opcoes` devolve só `{ id, nome, tipo, documento }`, sem paginação (limite 500) —
  suficiente para os `Combobox` de outras features; se algum MEI passar de 500 contatos ativos,
  vale revisar.
- Nenhum pedido fora de escopo: não precisei tocar em `packages/shared`, `db/schema`, `lib/`,
  registries ou features de outros times.
