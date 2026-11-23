/** @jest-environment jsdom */
/**
 * El botón «Pedir certificado de estudios» de `/aprender/certificados` (23/11).
 * SSOT: app/(student)/aprender/certificados/study-certificate-request.tsx.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudyCertificateRequest } from '@/app/(student)/aprender/certificados/study-certificate-request';

jest.setTimeout(15_000);

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/a11y/announce', () => ({ useAnnounce: () => ({ announce: jest.fn() }) }));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
  global.fetch = fetchMock as unknown as typeof fetch;
});

it('pide lugar de expedición y motivo, envía y confirma', async () => {
  render(<StudyCertificateRequest />);
  await userEvent.click(screen.getByRole('button', { name: 'cta' }));
  const send = screen.getByRole('button', { name: 'send' });
  expect(send).toHaveProperty('disabled', true);

  await userEvent.type(screen.getByLabelText(/documentPlace/), 'Medellín');
  await userEvent.type(screen.getByLabelText(/reason/), 'Para el trabajo');
  await userEvent.click(send);

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/learn/certificates/request',
    expect.objectContaining({
      body: JSON.stringify({ documentPlace: 'Medellín', reason: 'Para el trabajo' }),
    })
  );
  expect(await screen.findByRole('status')).toHaveProperty('textContent', 'sent');
});
