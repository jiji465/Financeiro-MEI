// Bootstrap do primeiro administrador (seção 11 do plano). Cadastro público não existe mais, então
// esta é a única forma de criar/promover uma conta de admin: rodar manualmente contra o banco.
//   pnpm db:promote-admin -- --email=voce@exemplo.com --senha=... --nome="Seu Nome" --atividade=servicos
// Se o e-mail já existir, só liga o flag admin (não exige --senha/--nome/--atividade nesse caso).
import type { Atividade } from '@meifin/shared';
import { ATIVIDADES } from '@meifin/shared';

import { createDb } from '../index.js';
import * as authRepo from '../../modules/auth/repository.js';
import { criarAuthService } from '../../modules/auth/service.js';

function argumento(nome: string): string | undefined {
  const prefixo = `--${nome}=`;
  const achado = process.argv.find((a) => a.startsWith(prefixo));
  return achado?.slice(prefixo.length);
}

async function main() {
  const { loadEnv } = await import('../../config/env.js');
  const env = loadEnv();
  const email = argumento('email')?.trim().toLowerCase();
  if (!email) {
    console.error(
      'Uso: pnpm db:promote-admin -- --email=voce@exemplo.com [--senha=... --nome="Seu Nome" --atividade=servicos]',
    );
    process.exit(1);
  }

  const database = await createDb(env);
  try {
    await database.migrate();
    const existente = await authRepo.buscarUserPorEmail(database.db, email);

    if (existente) {
      if (existente.admin) {
        console.log(`${email} já é administrador. Nada a fazer.`);
        return;
      }
      await authRepo.atualizarUser(database.db, existente.id, { admin: true });
      console.log(`${email} promovido a administrador.`);
      return;
    }

    const senha = argumento('senha');
    const nome = argumento('nome');
    const atividade = argumento('atividade') as Atividade | undefined;
    if (!senha || !nome || !atividade) {
      console.error(
        `Usuário ${email} não existe ainda. Para criar, informe também --senha, --nome e --atividade` +
          ` (uma de: ${ATIVIDADES.join(', ')}).`,
      );
      process.exit(1);
    }
    if (!ATIVIDADES.includes(atividade)) {
      console.error(`Atividade inválida: "${atividade}". Use uma de: ${ATIVIDADES.join(', ')}.`);
      process.exit(1);
    }

    const authService = criarAuthService({
      database,
      env,
      mailer: { enviar: async () => {} },
      sign: () => '',
    });
    const resultado = await authService.signup(
      {
        nome,
        email,
        senha,
        atividade,
        caminhoneiroTributos: atividade === 'caminhoneiro' ? 'ambos' : undefined,
      },
      {},
      { admin: true },
    );
    console.log(`Conta criada e promovida a administrador: ${resultado.user.email}`);
  } finally {
    await database.close();
  }
}

main().catch((erro) => {
  console.error('Falha ao promover administrador:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
