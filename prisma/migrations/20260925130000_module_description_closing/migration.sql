-- 25/9, fase de negocio 4: el componente cuenta de qué va y cómo se cierra.
-- Hasta hoy `Module` era posición y nombre; los clientes le dan descripción y un texto de
-- cierre por componente («al enviar la evaluación sale ese texto y pasa al siguiente»).

-- AlterTable
ALTER TABLE "Module" ADD COLUMN "description" TEXT;
ALTER TABLE "Module" ADD COLUMN "closingText" TEXT;
