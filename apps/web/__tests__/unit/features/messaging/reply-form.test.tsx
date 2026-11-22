/** @jest-environment jsdom */
/**
 * Responder en `/mensajes` a la manera del canal (22/11): formato, cita y botones.
 * SSOT: app/(staff)/mensajes/conversation-actions.tsx, reply-target.tsx, message-text.tsx.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CHANNEL_FEATURES } from '@/features/messaging/channels';
import { ReplyForm } from '@/app/(staff)/mensajes/conversation-actions';
import { QuoteButton, ReplyTargetProvider } from '@/app/(staff)/mensajes/reply-target';
import { MessageText } from '@/app/(staff)/mensajes/message-text';

jest.setTimeout(15_000);

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${Object.values(values).join(' ')}` : key,
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/lib/a11y/announce', () => ({ useAnnounce: () => ({ announce: jest.fn() }) }));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock
    .mockReset()
    .mockResolvedValue({ ok: true, json: async () => ({ data: { sent: true } }) });
  global.fetch = fetchMock as unknown as typeof fetch;
});

function setup() {
  return render(
    <ReplyTargetProvider>
      <QuoteButton id="cmmsg0000000000000000001" body="¿Cuándo empiezo?" author="Laura" />
      <ReplyForm conversationId="conv-1" features={CHANNEL_FEATURES.WHATSAPP} />
    </ReplyTargetProvider>
  );
}

it('la negrita envuelve la selección con *', async () => {
  setup();
  const area = screen.getByLabelText('replyLabel') as HTMLTextAreaElement;
  await userEvent.type(area, 'hola mundo');
  area.setSelectionRange(5, 10);
  await userEvent.click(screen.getByRole('button', { name: 'format.bold' }));
  expect(area.value).toBe('hola *mundo*');
  expect(screen.getByText('preview')).toBeInTheDocument();
});

it('envía la cita y los botones con el texto', async () => {
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'quote' }));
  expect(screen.getByText('replyingTo Laura')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('replyLabel'), '¿El martes?');
  await userEvent.click(screen.getByRole('button', { name: 'addButtons' }));
  await userEvent.type(screen.getByLabelText('buttonLabel 1'), 'Sí');
  await userEvent.click(screen.getByRole('button', { name: 'anotherButton' }));
  await userEvent.type(screen.getByLabelText('buttonLabel 2'), 'No');
  await userEvent.click(screen.getByRole('button', { name: 'send' }));

  expect(fetchMock).toHaveBeenCalledWith('/api/conversations/conv-1/messages', expect.anything());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    body: '¿El martes?',
    replyToId: 'cmmsg0000000000000000001',
    buttons: ['Sí', 'No'],
  });
  expect(screen.queryByText('replyingTo Laura')).not.toBeInTheDocument();
});

it('el hilo pinta el formato de WhatsApp, y el texto plano tal cual', () => {
  const { container, rerender } = render(
    <MessageText text={'*Hola* _Ana_\n- uno'} format="whatsapp" />
  );
  expect(container.querySelector('strong')?.textContent).toBe('Hola');
  expect(container.querySelector('em')?.textContent).toBe('Ana');
  rerender(<MessageText text="*Hola*" format={null} />);
  expect(container.querySelector('strong')).toBeNull();
});
