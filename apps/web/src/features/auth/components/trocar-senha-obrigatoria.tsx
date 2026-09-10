// Tela cheia bloqueante: aparece quando a senha atual foi definida por um admin (criação de
// conta ou redefinição — seção 13 do plano) em vez da própria pessoa. Reaproveita o mesmo
// formulário/endpoint de "Alterar senha" de Configurações; ao trocar com sucesso,
// useChangePassword já zera `deveTrocarSenha` no store e libera a navegação normal.
import { ShieldAlert } from 'lucide-react';

import { BrandMark } from '@/components/layout/brand';
import { AlterarSenhaForm } from '@/features/configuracoes/components/alterar-senha-form';

export function TrocarSenhaObrigatoria() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-fundo px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <BrandMark />
        </div>
        <div className="rounded-xl border border-borda bg-superficie p-6 shadow-card">
          <div className="mb-4 flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <h1 className="text-sm font-semibold text-texto">Defina uma nova senha</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Sua senha atual foi definida por um administrador. Por segurança, escolha uma senha
                só sua antes de continuar.
              </p>
            </div>
          </div>
          <AlterarSenhaForm />
        </div>
      </div>
    </div>
  );
}
