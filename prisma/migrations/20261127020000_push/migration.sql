-- Push a la app (27/11): los teléfonos con sesión y la entrega de cada aviso a cada uno.

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID');
CREATE TYPE "PushStatus" AS ENUM ('PENDING', 'SENT', 'DONE', 'DEAD');

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushDelivery" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "PushStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticketId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");
CREATE INDEX "PushDevice_institutionId_personId_idx" ON "PushDevice"("institutionId", "personId");
CREATE UNIQUE INDEX "PushDelivery_notificationId_deviceId_key" ON "PushDelivery"("notificationId", "deviceId");
CREATE INDEX "PushDelivery_status_runAfter_idx" ON "PushDelivery"("status", "runAfter");

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PushDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS como el resto (20261101000000_rls_missing_tables): nadie fuera del dueño ni del service_role.
ALTER TABLE "PushDevice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon" ON "PushDevice" FOR ALL TO anon USING (false);
CREATE POLICY "deny_authenticated" ON "PushDevice" FOR ALL TO authenticated USING (false);
ALTER TABLE "PushDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon" ON "PushDelivery" FOR ALL TO anon USING (false);
CREATE POLICY "deny_authenticated" ON "PushDelivery" FOR ALL TO authenticated USING (false);
