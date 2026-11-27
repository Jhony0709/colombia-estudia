-- Archivos del chat (27/11): audios, fotos y documentos que llegan por WhatsApp.

-- AlterTable
ALTER TABLE "ConversationMessage" ADD COLUMN "mediaType" TEXT,
ADD COLUMN "mediaMime" TEXT,
ADD COLUMN "mediaPath" TEXT,
ADD COLUMN "mediaName" TEXT;
