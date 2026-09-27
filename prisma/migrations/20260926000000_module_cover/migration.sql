-- La imagen de la tarjeta del curso (26/9): el componente apunta a un MediaAsset IMAGE.
ALTER TABLE "Module" ADD COLUMN "coverMediaId" TEXT;

ALTER TABLE "Module"
  ADD CONSTRAINT "Module_coverMediaId_fkey"
  FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
