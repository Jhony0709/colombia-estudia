/**
 * Varias fotos, una hoja cada una, en un solo PDF (28/11): la entrega guarda un archivo. La
 * librería se carga al juntar, no con la página.
 */

/** Ancho de una hoja A4 en puntos; el alto sale de la foto. */
const A4_WIDTH = 595;

export async function photosToPdf(photos: File[], name = 'hojas.pdf'): Promise<File> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const photo of photos) {
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const image =
      photo.type === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const height = (image.height / image.width) * A4_WIDTH;
    pdf.addPage([A4_WIDTH, height]).drawImage(image, { x: 0, y: 0, width: A4_WIDTH, height });
  }
  const out = await pdf.save();
  return new File([out.slice().buffer], name, { type: 'application/pdf' });
}
