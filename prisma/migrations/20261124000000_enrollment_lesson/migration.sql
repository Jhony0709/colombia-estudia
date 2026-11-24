-- Temas habilitados uno a uno (24/11, cliente): en un programa de pago el adulto no ve nada
-- hasta que operación abre el tema o el componente.

-- CreateTable
CREATE TABLE "EnrollmentLesson" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockedById" TEXT,

    CONSTRAINT "EnrollmentLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentLesson_enrollmentId_lessonId_key" ON "EnrollmentLesson"("enrollmentId", "lessonId");
CREATE INDEX "EnrollmentLesson_institutionId_enrollmentId_idx" ON "EnrollmentLesson"("institutionId", "enrollmentId");

-- AddForeignKey
ALTER TABLE "EnrollmentLesson" ADD CONSTRAINT "EnrollmentLesson_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentLesson" ADD CONSTRAINT "EnrollmentLesson_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentLesson" ADD CONSTRAINT "EnrollmentLesson_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentLesson" ADD CONSTRAINT "EnrollmentLesson_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS como el resto (20261101000000_rls_missing_tables): nadie fuera del dueño ni del service_role.
ALTER TABLE "EnrollmentLesson" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon" ON "EnrollmentLesson" FOR ALL TO anon USING (false);
CREATE POLICY "deny_authenticated" ON "EnrollmentLesson" FOR ALL TO authenticated USING (false);
