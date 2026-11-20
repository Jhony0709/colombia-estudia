-- Datos que el bot pide por el chat (14/11): inscripción o certificado, pregunta por pregunta;
-- y los recordatorios mientras la conversación espera asesor.

-- CreateEnum
CREATE TYPE "ConversationIntake" AS ENUM ('ENROLL', 'CERTIFICATE');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "intakeKind" "ConversationIntake",
ADD COLUMN "intakeStep" INTEGER,
ADD COLUMN "intake" JSONB,
ADD COLUMN "waitingReminders" INTEGER NOT NULL DEFAULT 0;
