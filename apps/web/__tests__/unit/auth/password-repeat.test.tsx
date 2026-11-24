/** @jest-environment jsdom */
/**
 * «Repite la contraseña» (23/11) al restablecer y al registrarse: si no coinciden, no se envía.
 * SSOT: app/(public)/auth/restablecer/page.tsx, app/(public)/registro/registration-content.tsx.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestablecerPage from '@/app/(public)/auth/restablecer/page';

jest.setTimeout(15_000);

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
  global.fetch = fetchMock as unknown as typeof fetch;
});

it('restablecer: contraseñas distintas no llegan al servidor', async () => {
  render(<RestablecerPage />);
  await userEvent.type(screen.getByLabelText(/newPassword/), 'contraseña1234');
  await userEvent.type(screen.getByLabelText(/repeatPassword/), 'contraseña1235');
  await userEvent.click(screen.getByRole('button', { name: 'submit' }));
  expect(screen.getByText('passwordMismatch')).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('restablecer: iguales, se envía solo `password`', async () => {
  render(<RestablecerPage />);
  await userEvent.type(screen.getByLabelText(/newPassword/), 'contraseña1234');
  await userEvent.type(screen.getByLabelText(/repeatPassword/), 'contraseña1234');
  await userEvent.click(screen.getByRole('button', { name: 'submit' }));
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/auth/reset',
    expect.objectContaining({ body: JSON.stringify({ password: 'contraseña1234' }) })
  );
});
