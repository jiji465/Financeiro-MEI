// /contatos/novo e /contatos/:id/editar — mesmo formulário; no editar carrega o contato antes.
import { TIPOS_CONTATO, type TipoContato } from '@meifin/shared';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { TIPO_CONTATO_LABELS } from '@/lib/labels';

import { ContatoForm } from '../components/contato-form';
import { CONTATO_FORM_VAZIO, contatoParaForm } from '../components/contato-form-schema';
import { useAtualizarContato, useContato, useCriarContato } from '../hooks';

function tipoDaUrl(valor: string | null): TipoContato | null {
  return TIPOS_CONTATO.includes(valor as TipoContato) ? (valor as TipoContato) : null;
}

export function NovoContatoPage() {
  const navigate = useNavigate();
  const criar = useCriarContato();
  // ?tipo=cliente|fornecedor: os atalhos "Novo cliente"/"Novo fornecedor" já abrem o formulário
  // com o tipo marcado, em vez de mandar o usuário escolher de novo o que ele acabou de escolher.
  const [params] = useSearchParams();
  const tipo = tipoDaUrl(params.get('tipo'));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titulo={tipo ? `Novo ${TIPO_CONTATO_LABELS[tipo].toLowerCase()}` : 'Novo contato'}
        descricao="Cadastre um cliente ou fornecedor para vincular aos seus lançamentos."
        voltar="/contatos"
      />
      <ContatoForm
        defaultValues={tipo ? { ...CONTATO_FORM_VAZIO, tipo } : undefined}
        submitLabel="Cadastrar contato"
        onSubmit={async (body) => {
          const { data } = await criar.mutateAsync(body);
          navigate(`/contatos/${data.id}`, { replace: true });
        }}
        submitting={criar.isPending}
      />
    </div>
  );
}

function EditarContatoForm({ id }: { id: string }) {
  const navigate = useNavigate();
  const atualizar = useAtualizarContato(id);
  const contato = useContato(id);
  return (
    <QueryState query={contato} skeleton={<PageSkeleton />}>
      {(dados) => (
        <ContatoForm
          key={dados.id}
          defaultValues={contatoParaForm(dados)}
          submitLabel="Salvar alterações"
          cancelarPara={`/contatos/${id}`}
          onSubmit={async (body) => {
            await atualizar.mutateAsync(body);
            navigate(`/contatos/${id}`);
          }}
          submitting={atualizar.isPending}
        />
      )}
    </QueryState>
  );
}

export function EditarContatoPage() {
  const { id = '' } = useParams<{ id: string }>();
  const contato = useContato(id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titulo={contato.data ? `Editar ${contato.data.nome}` : 'Editar contato'}
        voltar={`/contatos/${id}`}
      />
      <EditarContatoForm id={id} />
    </div>
  );
}
