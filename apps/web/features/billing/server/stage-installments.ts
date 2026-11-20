/**
 * Etapas por cuota (20/11): qué cuota abre cada componente de una matrícula.
 * SSOT: reference/04-business-logic/acceso-y-cartera.md §3.
 *
 * Sin imports a propósito: lo leen la ruta del estudiante y la ficha de la matrícula.
 */

export interface StageInstallment {
  position: number;
  amount: number;
}

interface InstallmentRow {
  position: number;
  amount: { toNumber(): number };
  status: string;
  unlockModuleIds?: string[];
}

/** Qué cuota abre cada componente. Vacío para un menor; las cuotas anuladas no cuentan. */
export function stageInstallments(
  isMinor: boolean,
  installments: InstallmentRow[] | undefined
): Map<string, StageInstallment> {
  const stages = new Map<string, StageInstallment>();
  if (isMinor) return stages;
  for (const installment of installments ?? []) {
    if (installment.status === 'VOID') continue;
    for (const moduleId of installment.unlockModuleIds ?? []) {
      const current = stages.get(moduleId);
      if (!current || installment.position < current.position) {
        stages.set(moduleId, {
          position: installment.position,
          amount: installment.amount.toNumber(),
        });
      }
    }
  }
  return stages;
}
