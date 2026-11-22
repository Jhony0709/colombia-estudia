-- Bandeja (22/11): el mensaje que se cita al responder y los botones de respuesta rápida; el bot
-- también crea la cuenta desde el chat.

-- AlterEnum
ALTER TYPE "ConversationIntake" ADD VALUE 'ACCOUNT';

-- AlterTable
ALTER TABLE "ConversationMessage" ADD COLUMN "replyToId" TEXT,
ADD COLUMN "buttons" JSONB;

-- CreateIndex
CREATE INDEX "ConversationMessage_replyToId_idx" ON "ConversationMessage"("replyToId");

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
