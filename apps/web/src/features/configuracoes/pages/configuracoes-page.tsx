// Página "/configuracoes": dados do MEI, categorias, preferências e conta (senha, sair).
// A aba ativa fica em ?aba= para permitir links diretos (ex.: o LimiteCard linka para preferências).
import { LogOut } from 'lucide-react';

import { useConfirm } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useSearchParamsState } from '@/lib/hooks';

import { useLogout } from '@/features/auth/hooks';

import { CategoriasLista } from '../components/categorias-lista';
import { AlterarSenhaForm } from '../components/alterar-senha-form';
import { MeiForm } from '../components/mei-form';
import { PreferenciasForm } from '../components/preferencias-form';
import { useConfiguracoes } from '../hooks';

function ContaTab() {
  const logout = useLogout();
  const confirm = useConfirm();

  const sair = async () => {
    const ok = await confirm({
      titulo: 'Sair da conta?',
      descricao: 'Você precisará entrar novamente com seu e-mail e senha.',
      confirmarTexto: 'Sair',
    });
    if (ok) logout.mutate();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-500">Senha</h2>
        <AlterarSenhaForm />
      </div>
      <div className="border-t border-borda pt-6">
        <h2 className="mb-3 text-sm font-semibold text-zinc-500">Sessão</h2>
        <Button
          variant="outline"
          icon={<LogOut aria-hidden="true" />}
          loading={logout.isPending}
          onClick={() => void sair()}
        >
          Sair
        </Button>
      </div>
    </div>
  );
}

export function ConfiguracoesPage() {
  const [aba, setAba] = useSearchParamsState('aba', 'mei');
  const query = useConfiguracoes();

  return (
    <div>
      <PageHeader
        titulo="Configurações"
        descricao="Dados do MEI, categorias de lançamentos, preferências e conta."
      />

      <Tabs value={aba || 'mei'} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="mei">Dados do MEI</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="preferencias">Preferências</TabsTrigger>
          <TabsTrigger value="conta">Conta</TabsTrigger>
        </TabsList>

        <TabsContent value="mei">
          <QueryState query={query}>{(config) => <MeiForm config={config} />}</QueryState>
        </TabsContent>
        <TabsContent value="categorias">
          <CategoriasLista />
        </TabsContent>
        <TabsContent value="preferencias">
          <QueryState query={query}>{(config) => <PreferenciasForm config={config} />}</QueryState>
        </TabsContent>
        <TabsContent value="conta">
          <ContaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
