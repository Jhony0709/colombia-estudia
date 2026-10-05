-- Habilitación manual de componentes por matrícula (3/10, cliente): el siguiente componente
-- está bloqueado hasta que operación lo habilita, con ventana de fechas opcional.

-- CreateTable
CREATE TABLE "EnrollmentModule" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockedById" TEXT,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),

    CONSTRAINT "EnrollmentModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentModule_enrollmentId_moduleId_key" ON "EnrollmentModule"("enrollmentId", "moduleId");
CREATE INDEX "EnrollmentModule_institutionId_enrollmentId_idx" ON "EnrollmentModule"("institutionId", "enrollmentId");

-- AddForeignKey
ALTER TABLE "EnrollmentModule" ADD CONSTRAINT "EnrollmentModule_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentModule" ADD CONSTRAINT "EnrollmentModule_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentModule" ADD CONSTRAINT "EnrollmentModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentModule" ADD CONSTRAINT "EnrollmentModule_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La ventana, si va, tiene que tener sentido.
ALTER TABLE "EnrollmentModule" ADD CONSTRAINT "EnrollmentModule_window_check"
  CHECK ("availableFrom" IS NULL OR "availableUntil" IS NULL OR "availableFrom" <= "availableUntil");
