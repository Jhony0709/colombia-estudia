-- 25/9, fase de negocio 1: lista de precios por programa y el precio aplicado a cada plan.
-- Los clientes venden «grado 6 a 8: $120.000 c/m; 9 a 11: $90.000 c/m»; hasta hoy el único
-- monto era `PaymentPlan.totalAmount`, escrito a mano por matrícula y sin origen.

-- CreateEnum
CREATE TYPE "PricePeriod" AS ENUM ('ONE_TIME', 'MONTHLY', 'PER_MODULE');

-- CreateTable
CREATE TABLE "ProgramPrice" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "gradeFrom" INTEGER,
    "gradeTo" INTEGER,
    "amount" DECIMAL(12,0) NOT NULL,
    "period" "PricePeriod" NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ProgramPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramPrice_institutionId_programId_idx" ON "ProgramPrice"("institutionId", "programId");

-- AddForeignKey
ALTER TABLE "ProgramPrice" ADD CONSTRAINT "ProgramPrice_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgramPrice" ADD CONSTRAINT "ProgramPrice_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgramPrice" ADD CONSTRAINT "ProgramPrice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "PaymentPlan" ADD COLUMN "priceId" TEXT;
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "ProgramPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El rango de grados, si va, tiene que tener sentido.
ALTER TABLE "ProgramPrice" ADD CONSTRAINT "ProgramPrice_grade_range_check"
  CHECK ("gradeFrom" IS NULL OR "gradeTo" IS NULL OR "gradeFrom" <= "gradeTo");
