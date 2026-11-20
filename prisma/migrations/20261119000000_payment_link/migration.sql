-- Links de pago de Bold (19/11): uno por intento de pagar una cuota en línea.

-- CreateEnum
CREATE TYPE "PaymentLinkStatus" AS ENUM ('ACTIVE', 'PAID', 'EXPIRED');

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "amount" DECIMAL(12,0) NOT NULL,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLink_reference_key" ON "PaymentLink"("reference");
CREATE UNIQUE INDEX "PaymentLink_providerId_key" ON "PaymentLink"("providerId");
CREATE INDEX "PaymentLink_institutionId_status_createdAt_idx" ON "PaymentLink"("institutionId", "status", "createdAt");
CREATE INDEX "PaymentLink_installmentId_status_idx" ON "PaymentLink"("installmentId", "status");

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS como el resto (002-rls.sql): nadie fuera del dueño ni del service_role.
ALTER TABLE "PaymentLink" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon" ON "PaymentLink" FOR ALL TO anon USING (false);
CREATE POLICY "deny_authenticated" ON "PaymentLink" FOR ALL TO authenticated USING (false);
