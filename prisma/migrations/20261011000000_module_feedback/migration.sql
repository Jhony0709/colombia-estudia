-- La opinión del estudiante al terminar un componente (11/10): recomendada, con nombre, una por
-- matrícula y componente. Cuatro notas de 1 a 5 (la de atención, opcional) y un comentario.

-- CreateTable
CREATE TABLE "ModuleFeedback" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "usefulness" INTEGER NOT NULL,
    "understanding" INTEGER NOT NULL,
    "clarity" INTEGER NOT NULL,
    "support" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleFeedback_enrollmentId_moduleId_key" ON "ModuleFeedback"("enrollmentId", "moduleId");
CREATE INDEX "ModuleFeedback_institutionId_moduleId_createdAt_idx" ON "ModuleFeedback"("institutionId", "moduleId", "createdAt");

-- AddForeignKey
ALTER TABLE "ModuleFeedback" ADD CONSTRAINT "ModuleFeedback_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModuleFeedback" ADD CONSTRAINT "ModuleFeedback_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModuleFeedback" ADD CONSTRAINT "ModuleFeedback_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Las notas, siempre de 1 a 5; el comentario, con tope.
ALTER TABLE "ModuleFeedback" ADD CONSTRAINT "ModuleFeedback_scores_check" CHECK (
  "usefulness" BETWEEN 1 AND 5
  AND "understanding" BETWEEN 1 AND 5
  AND "clarity" BETWEEN 1 AND 5
  AND ("support" IS NULL OR "support" BETWEEN 1 AND 5)
);
ALTER TABLE "ModuleFeedback" ADD CONSTRAINT "ModuleFeedback_comment_check" CHECK (char_length("comment") <= 1000);

-- RLS como el resto del negocio (002-rls.sql): nadie fuera del service_role.
ALTER TABLE "ModuleFeedback" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon" ON "ModuleFeedback" FOR ALL TO anon USING (false);
CREATE POLICY "deny_authenticated" ON "ModuleFeedback" FOR ALL TO authenticated USING (false);
