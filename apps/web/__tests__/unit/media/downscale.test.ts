/** @jest-environment jsdom */
/**
 * `downscale` (lib/media/use-image-upload.ts): la entrega la pide en JPEG (28/11), con lo
 * transparente en blanco; la portada sigue en WebP.
 */

import { downscale } from '@/lib/media/use-image-upload';

const ctx = { fillStyle: '', fillRect: jest.fn(), drawImage: jest.fn() };
const toBlob = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  global.createImageBitmap = jest.fn(async () => ({
    width: 4000,
    height: 3000,
    close: jest.fn(),
  })) as unknown as typeof createImageBitmap;
  const real = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas'
      ? ({
          width: 0,
          height: 0,
          getContext: () => ctx,
          toBlob,
        } as unknown as HTMLCanvasElement)
      : real(tag)
  );
  toBlob.mockImplementation((done: (b: Blob) => void, type: string) =>
    done(new Blob(['small'], { type }))
  );
});

const photo = (type: string) => {
  const file = new File(['x'], 'hoja', { type });
  Object.defineProperty(file, 'size', { value: 8 * 1024 * 1024 });
  return file;
};

it('reduce a 2000 px y pasa a JPEG con fondo blanco', async () => {
  const blob = await downscale(photo('image/png'), 'image/jpeg');
  expect(blob.type).toBe('image/jpeg');
  expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 2000, 1500);
  expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2000, 1500);
  expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
});

it('en WebP no pinta fondo', async () => {
  const blob = await downscale(photo('image/jpeg'));
  expect(blob.type).toBe('image/webp');
  expect(ctx.fillRect).not.toHaveBeenCalled();
});

it('sin poder decodificar, devuelve el original', async () => {
  (global.createImageBitmap as jest.Mock).mockRejectedValue(new Error('decode'));
  const file = photo('image/jpeg');
  expect(await downscale(file, 'image/jpeg')).toBe(file);
});
