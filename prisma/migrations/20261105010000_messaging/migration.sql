-- Mensajería (5/11): conversaciones por contacto y canal (WhatsApp primero), atendidas por el bot
-- y, si piden un asesor, desde la bandeja `/mensajes`.

-- CreateEnum
CREATE TYPE "MessagingChannel" AS ENUM ('WHATSAPP');
CREATE TYPE "ConversationStatus" AS ENUM ('BOT', 'WAITING', 'OPEN', 'CLOSED');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN "whatsappAgentPhones" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "whatsappPhoneNumberId" TEXT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "channel" "MessagingChannel" NOT NULL,
    "contact" TEXT NOT NULL,
    "contactName" TEXT,
    "personId" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'BOT',
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "waitingSince" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "fromBot" BOOLEAN NOT NULL DEFAULT false,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_whatsappPhoneNumberId_key" ON "Institution"("whatsappPhoneNumberId");
CREATE INDEX "Conversation_institutionId_status_lastMessageAt_idx" ON "Conversation"("institutionId", "status", "lastMessageAt");
CREATE UNIQUE INDEX "Conversation_institutionId_channel_contact_key" ON "Conversation"("institutionId", "channel", "contact");
CREATE UNIQUE INDEX "ConversationMessage_externalId_key" ON "ConversationMessage"("externalId");
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS como el resto (002-rls.sql): nadie fuera del dueño ni del service_role.
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon" ON "Conversation" FOR ALL TO anon USING (false);
CREATE POLICY "deny_authenticated" ON "Conversation" FOR ALL TO authenticated USING (false);

ALTER TABLE "ConversationMessage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon" ON "ConversationMessage" FOR ALL TO anon USING (false);
CREATE POLICY "deny_authenticated" ON "ConversationMessage" FOR ALL TO authenticated USING (false);
