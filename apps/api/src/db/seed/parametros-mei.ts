// Parâmetros legais do MEI por ano. Upsert-if-missing: nunca sobrescreve um ano já existente
// (o administrador pode ajustar valores direto na tabela). Centavos e basis points.
//
// 2026: salário mínimo R$ 1.621,00 → INSS 5% = R$ 81,05; comércio (+ICMS R$ 1,00) = R$ 82,05;
//       serviços (+ISS R$ 5,00) = R$ 86,05; ambos = R$ 87,05; caminhoneiro (12%) = R$ 194,52.
// 2025: salário mínimo R$ 1.518,00 — marcado como "confirmar" (confirmado=false).
import type { DbExecutor } from '../index.js';
import { parametrosMei, type ParametrosMeiInsert } from '../schema/parametros.js';

export const PARAMETROS_MEI_SEED: readonly ParametrosMeiInsert[] = [
  {
    ano: 2026,
    salarioMinimo: 162_100,
    aliquotaInssBp: 500,
    aliquotaInssCaminhoneiroBp: 1200,
    icms: 100,
    iss: 500,
    limiteAnual: 8_100_000,
    limiteMensalProporcional: 675_000,
    toleranciaExcessoBp: 2000,
    diaVencimentoDas: 20,
    dasnPrazoDia: 31,
    dasnPrazoMes: 5,
    alertasLimitePct: [70, 85, 100],
    confirmado: true,
    observacoes: null,
  },
  {
    ano: 2025,
    salarioMinimo: 151_800,
    aliquotaInssBp: 500,
    aliquotaInssCaminhoneiroBp: 1200,
    icms: 100,
    iss: 500,
    limiteAnual: 8_100_000,
    limiteMensalProporcional: 675_000,
    toleranciaExcessoBp: 2000,
    diaVencimentoDas: 20,
    dasnPrazoDia: 31,
    dasnPrazoMes: 5,
    alertasLimitePct: [70, 85, 100],
    confirmado: false,
    observacoes: 'Valores de 2025 a confirmar (salário mínimo R$ 1.518,00).',
  },
];

/** Insere os anos que ainda não existem. Devolve quantos foram inseridos. */
export async function seedParametrosMei(exec: DbExecutor): Promise<number> {
  const inseridos = await exec
    .insert(parametrosMei)
    .values([...PARAMETROS_MEI_SEED])
    .onConflictDoNothing({ target: parametrosMei.ano })
    .returning({ ano: parametrosMei.ano });
  return inseridos.length;
}
