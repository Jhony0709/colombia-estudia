/** @jest-environment node */
/**
 * Pedir el certificado de estudios desde la plataforma (23/11): auditoría y aviso a operación.
 * SSOT: features/certificates/server/study-certificate.service.ts.
 */

const mockAudit = jest.fn();
const mockFindPerson = jest.fn();
const mockNotifyMany = jest.fn(async (_i: string, ids: string[]) => ({ created: ids.length }));

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: () => ({
    person: { findFirst: mockFindPerson },
    auditLog: { create: mockAudit },
  }),
}));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  staffPersonIds: jest.fn(async () => ['ops-1', 'admin-1']),
  notifyMany: (...args: [string, string[]]) => mockNotifyMany(...args),
}));

import { requestStudyCertificate } from '@/features/certificates/server/study-certificate.service';

const NOW = new Date('2026-11-23T15:00:00Z');

beforeEach(() => {
  mockAudit.mockReset();
  mockNotifyMany.mockClear();
  mockFindPerson
    .mockReset()
    .mockResolvedValue({ code: 'PER-0042', givenName: 'Laura', familyName: 'Gómez' });
});

it('audita en la ficha y avisa a operación con enlace a la persona, uno por día', async () => {
  const out = await requestStudyCertificate({
    institutionId: 'inst-1',
    personId: 'p-1',
    documentPlace: 'Medellín',
    reason: 'Para el trabajo',
    now: NOW,
  });
  expect(out).toEqual({ notified: 2 });
  expect(mockAudit.mock.calls[0][0].data).toMatchObject({
    entity: 'person',
    entityId: 'p-1',
    action: 'study_certificate.requested',
    after: { documentPlace: 'Medellín', reason: 'Para el trabajo' },
  });
  const [, ids, input] = mockNotifyMany.mock.calls[0] as unknown as [
    string,
    string[],
    { href: string; body: string; dedupeKey: string },
  ];
  expect(ids).toEqual(['ops-1', 'admin-1']);
  expect(input.href).toBe('/personas/PER-0042');
  expect(input.body).toContain('Laura Gómez: Para el trabajo');
  expect(input.dedupeKey).toBe('study_certificate:p-1:2026-11-23');
});

it('sin persona no audita ni avisa', async () => {
  mockFindPerson.mockResolvedValue(null);
  await expect(
    requestStudyCertificate({
      institutionId: 'inst-1',
      personId: 'p-x',
      documentPlace: 'Cali',
      reason: 'Trabajo',
    })
  ).rejects.toThrow('Not found');
  expect(mockAudit).not.toHaveBeenCalled();
  expect(mockNotifyMany).not.toHaveBeenCalled();
});
