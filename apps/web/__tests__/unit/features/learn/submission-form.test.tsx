/** @jest-environment jsdom */
/**
 * La entrega con archivo (28/11): una foto se reduce antes de subirla, y un archivo que no
 * cabe se dice con su tamaño y el correo de soporte, también al enviar (antes decía «responde
 * todas las preguntas», reporte de un estudiante de BACH-2026-2).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.setTimeout(15_000);

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
  useFormatter: () => ({ number: (n: number) => n.toFixed(1) }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/lib/a11y/announce', () => ({ useAnnounce: () => ({ announce: jest.fn() }) }));
const mockDownscale = jest.fn();
jest.mock('@/lib/media/use-image-upload', () => ({
  downscale: (...args: unknown[]) => mockDownscale(...args),
}));
const mockPhotosToPdf = jest.fn();
jest.mock('@/lib/media/photos-to-pdf', () => ({
  photosToPdf: (...args: unknown[]) => mockPhotosToPdf(...args),
}));

import { SubmissionForm } from '@/app/(student)/aprender/tema/[assignmentId]/submission-form';

const MB = 1024 * 1024;
const fetchMock = jest.fn();

function fileOf(name: string, type: string, bytes: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

const show = () =>
  render(
    <SubmissionForm
      assignmentId="a-1"
      submission={null}
      accepts="TEXT_OR_FILE"
      prompts={['¿Cuánto es 2 + 2?']}
      dateLabel={null}
      supportEmail="soporte@alba.test"
    />
  );

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
  global.fetch = fetchMock as unknown as typeof fetch;
  mockDownscale.mockReset().mockImplementation(async (file: File) => file);
  mockPhotosToPdf.mockReset();
});

it('un PDF de más de 50 MB no se adjunta, y al enviar se dice eso y no que falten respuestas', async () => {
  show();
  await userEvent.upload(
    screen.getByLabelText(/fileLabel/),
    fileOf('hoja.pdf', 'application/pdf', 60 * MB)
  );
  const size = 'errors.size {"size":"60.0","email":"soporte@alba.test"}';
  expect(await screen.findByText(size)).toBeTruthy();
  expect(mockDownscale).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'send' }));
  expect(screen.getByText(size)).toBeTruthy();
  expect(screen.queryByText('errors.answerAll')).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('con las preguntas respondidas se envía aunque el archivo no cupiera', async () => {
  show();
  await userEvent.upload(
    screen.getByLabelText(/fileLabel/),
    fileOf('hoja.pdf', 'application/pdf', 60 * MB)
  );
  await userEvent.type(screen.getByLabelText(/2 \+ 2/), '4');
  await userEvent.click(screen.getByRole('button', { name: 'send' }));
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/learn/lessons/a-1/submission',
    expect.objectContaining({ body: JSON.stringify({ answers: ['4'], fileAssetId: null }) })
  );
});

it('una foto pesada se reduce a JPEG y se sube esa', async () => {
  mockDownscale.mockResolvedValue(new Blob(['y'.repeat(10)], { type: 'image/jpeg' }));
  show();
  await userEvent.upload(
    screen.getByLabelText(/fileLabel/),
    fileOf('hoja.png', 'image/png', 30 * MB)
  );
  expect(mockDownscale).toHaveBeenCalledWith(expect.any(File), 'image/jpeg');
  expect(await screen.findByText(/hoja\.jpg/)).toBeTruthy();
  expect(screen.queryByText(/errors\.size/)).toBeNull();

  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: { mediaAssetId: 'ckmedia0000000000000000001', signedUrl: 'https://s/u' },
    }),
  });
  await userEvent.click(screen.getByRole('button', { name: 'send' }));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    kind: 'SUBMISSION',
    mimeType: 'image/jpeg',
    sizeBytes: 10,
  });
});

it('varias fotos se juntan en un PDF y se sube ese', async () => {
  mockPhotosToPdf.mockResolvedValue(fileOf('hojas.pdf', 'application/pdf', 3 * MB));
  show();
  const pages = [1, 2, 3].map((n) => fileOf(`hoja${n}.jpg`, 'image/jpeg', 4 * MB));
  await userEvent.upload(screen.getByLabelText(/fileLabel/), pages);
  expect(await screen.findByText(/combined \{"count":3\}/)).toBeTruthy();
  expect(mockDownscale).toHaveBeenCalledTimes(3);
  expect(mockPhotosToPdf).toHaveBeenCalledWith(pages);

  await userEvent.click(screen.getByRole('button', { name: 'send' }));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    kind: 'SUBMISSION',
    mimeType: 'application/pdf',
    sizeBytes: 3 * MB,
  });
});

it('un PDF no se mezcla con fotos, ni pasan más de 10', async () => {
  show();
  const input = screen.getByLabelText(/fileLabel/);
  await userEvent.upload(input, [
    fileOf('a.pdf', 'application/pdf', MB),
    fileOf('b.jpg', 'image/jpeg', MB),
  ]);
  expect(await screen.findByText('errors.mixed')).toBeTruthy();

  const eleven = Array.from({ length: 11 }, (_, n) => fileOf(`${n}.jpg`, 'image/jpeg', MB));
  await userEvent.upload(input, eleven);
  expect(await screen.findByText('errors.tooMany {"max":10}')).toBeTruthy();
  expect(mockPhotosToPdf).not.toHaveBeenCalled();
});

it('si no se pueden juntar, lo dice', async () => {
  mockPhotosToPdf.mockRejectedValue(new Error('bad jpeg'));
  show();
  await userEvent.upload(screen.getByLabelText(/fileLabel/), [
    fileOf('a.jpg', 'image/jpeg', MB),
    fileOf('b.jpg', 'image/jpeg', MB),
  ]);
  expect(await screen.findByText('errors.combine')).toBeTruthy();
});
