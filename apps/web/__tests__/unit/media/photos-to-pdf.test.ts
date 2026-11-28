/** @jest-environment node */
/**
 * `photosToPdf` (28/11): cada foto es una hoja del PDF, PNG y JPEG, al ancho de un A4.
 */

import { PDFDocument } from 'pdf-lib';
import { photosToPdf } from '@/lib/media/photos-to-pdf';

// Un píxel en cada formato.
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPEG =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

const photo = (base64: string, name: string, type: string) =>
  new File([Buffer.from(base64, 'base64')], name, { type });

it('junta las fotos en un PDF, una hoja por foto', async () => {
  const pdf = await photosToPdf([
    photo(PNG, 'a.png', 'image/png'),
    photo(JPEG, 'b.jpg', 'image/jpeg'),
  ]);
  expect(pdf.type).toBe('application/pdf');
  expect(pdf.name).toBe('hojas.pdf');
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(2);
  expect(doc.getPage(0).getWidth()).toBe(595);
});

it('falla con una foto que no se puede leer', async () => {
  await expect(photosToPdf([photo('AAAA', 'x.jpg', 'image/jpeg')])).rejects.toThrow();
});
