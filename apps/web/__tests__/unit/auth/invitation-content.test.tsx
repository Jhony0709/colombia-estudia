/** @jest-environment jsdom */
/**
 * Aceptar invitación (23/11): si Supabase rechaza la contraseña, se vuelve a pedir.
 * SSOT: app/(public)/invitacion/[token]/invitation-content.tsx.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvitationContent from '@/app/(public)/invitacion/[token]/invitation-content';

jest.setTimeout(15_000);

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const WEAK = 'Esa contraseña es demasiado débil o apareció en filtraciones de datos; elige otra';
const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({
    ok: false,
    json: async () => ({ error: { code: 'VALIDATION_ERROR', message: WEAK } }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

function setup() {
  render(
    <InvitationContent
      token="tok"
      givenName="Laura"
      isMinor={false}
      institutionName="ALBA"
      dataPolicyUrl={null}
    />
  );
}

async function toConsent() {
  await userEvent.click(screen.getByRole('button', { name: 'continue' }));
  await userEvent.type(screen.getByLabelText(/password/), 'contraseña1234');
  await userEvent.click(screen.getByRole('button', { name: 'continue' }));
  expect(screen.getByRole('heading', { name: 'dataPolicy' })).toBeTruthy();
}

it('contraseña rechazada: vuelve al paso de contraseña con el error y el campo vacío', async () => {
  setup();
  await toConsent();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'createAccount' }));

  expect(await screen.findByRole('heading', { name: 'createPassword' })).toBeTruthy();
  expect(screen.getByText(WEAK)).toBeTruthy();
  expect((screen.getByLabelText(/password/) as HTMLInputElement).value).toBe('');
});

it('desde la política se puede volver a cambiar la contraseña', async () => {
  setup();
  await toConsent();
  await userEvent.click(screen.getByRole('button', { name: 'back' }));
  expect(screen.getByRole('heading', { name: 'createPassword' })).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});
