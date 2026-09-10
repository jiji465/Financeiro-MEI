// Bootstrap do primeiro administrador (seção 11/13 do plano). Cadastro público não existe mais,
// então esta é a única forma de criar/promover uma conta de admin fora do painel (que só um admin
// já existente pode usar): rodar manualmente contra o banco.
//   pnpm db:promote-admin -- --email=voce@exemplo.com --senha=... --nome="Seu Nome"
// Se o e-mail já existir, só liga o flag admin (não exige --senha/--nome nesse caso). Um admin
// criado do zero por aqui é sempre um "administrador puro" — não é titular de nenhum MEI de
// verdade (seção 13: tenant interno, oculto de toda listagem/estatística do painel).
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
      'Uso: pnpm db:promote-admin -- --email=voce@exemplo.com [--senha=... --nome="Seu Nome"]',
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
    if (!senha || !nome) {
      console.error(
        `Usuário ${email} não existe ainda. Para criar, informe também --senha e --nome.`,
      );
      process.exit(1);
    }

    const authService = criarAuthService({
      database,
      env,
      mailer: { enviar: async () => {} },
      sign: () => '',
    });
    const resultado = await authService.criarAdminInterno({ nome, email, senha });
    console.log(`Conta criada e promovida a administrador: ${resultado.user.email}`);
  } finally {
    await database.close();
  }
}

main().catch((erro) => {
  console.error('Falha ao promover administrador:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
