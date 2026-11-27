-- Avisos al asesor (27/11): cuándo tenía el chat abierto, para no avisarle de lo que ya ve.

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "agentSeenAt" TIMESTAMP(3);
