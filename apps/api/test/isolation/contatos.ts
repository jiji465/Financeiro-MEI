// Isolamento: contatos (WP1). Cria um contato como A e confere que B recebe 404 em todas as
// rotas com :id, que a listagem/opções de B não vazam o id de A e que B pode cadastrar o mesmo
// documento (a unicidade é por tenant).
import type { RecursoIsolamento } from './_registry.js';

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'contatos',
    rotasCobertas: [
      'GET /api/v1/contatos/:id',
      'PATCH /api/v1/contatos/:id',
      'DELETE /api/v1/contatos/:id',
      'GET /api/v1/contatos/:id/lancamentos',
      'GET /api/v1/contatos/:id/resumo',
    ],
    async preparar(app, a) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/contatos',
        headers: a.headers,
        payload: {
          tipo: 'cliente',
          nome: 'Cliente secreto de A',
          documento: '52998224725',
          email: 'secreto-a@exemplo.com.br',
        },
      });
      if (res.statusCode !== 201) throw new Error(`preparar contatos: ${res.body}`);
      return { contatoId: res.json<{ data: { id: string } }>().data.id, tenantIdA: a.tenantId };
    },
    casos: [
      {
        nome: 'GET /contatos/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `/api/v1/contatos/${ids.contatoId}` }),
      },
      {
        nome: 'PATCH /contatos/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `/api/v1/contatos/${ids.contatoId}`,
          payload: { nome: 'Invadido' },
        }),
      },
      {
        nome: 'DELETE /contatos/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'DELETE', url: `/api/v1/contatos/${ids.contatoId}` }),
      },
      {
        nome: 'GET /contatos/:id/lancamentos de A como B → 404',
        requisicao: (ids) => ({
          method: 'GET',
          url: `/api/v1/contatos/${ids.contatoId}/lancamentos`,
        }),
      },
      {
        nome: 'GET /contatos/:id/resumo de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `/api/v1/contatos/${ids.contatoId}/resumo` }),
      },
      {
        nome: 'GET /contatos como B não lista o contato de A (nem buscando pelo nome/documento)',
        requisicao: () => ({ method: 'GET', url: '/api/v1/contatos?busca=secreto' }),
        status: [200],
        naoDeveConter: (ids) => [ids.contatoId!, 'Cliente secreto de A'],
      },
      {
        nome: 'GET /contatos?ativo=false como B não lista o contato de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/contatos?ativo=false' }),
        status: [200],
        naoDeveConter: (ids) => [ids.contatoId!],
      },
      {
        nome: 'GET /contatos/opcoes como B não lista o contato de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/contatos/opcoes' }),
        status: [200],
        naoDeveConter: (ids) => [ids.contatoId!],
      },
      {
        nome: 'POST /contatos como B com o documento de A → 201 (unicidade é por tenant)',
        requisicao: () => ({
          method: 'POST',
          url: '/api/v1/contatos',
          payload: { tipo: 'cliente', nome: 'Homônimo de B', documento: '529.982.247-25' },
        }),
        status: [201],
        naoDeveConter: (ids) => [ids.contatoId!],
      },
    ],
  },
];
