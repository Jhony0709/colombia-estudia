-- Etapas por cuota (20/11): los componentes que una cuota habilita al quedar pagada.

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN "unlockModuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
