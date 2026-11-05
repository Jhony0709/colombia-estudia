/** @jest-environment node */
/**
 * Los WhatsApp de quienes atienden (5/11): se guardan como `wa_id`. SSOT:
 * features/admin/server/whatsapp-settings.service.ts.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn() }));

import { normalizeAgentPhone } from '@/features/admin/server/whatsapp-settings.service';

describe('normalizeAgentPhone', () => {
  it('con indicativo, solo dígitos', () => {
    expect(normalizeAgentPhone('+57 310 250 2207')).toBe('573102502207');
    expect(normalizeAgentPhone('+573138350120')).toBe('573138350120');
  });

  it('quita el 0 nacional que se escribe tras el +33', () => {
    expect(normalizeAgentPhone('+330652614789')).toBe('33652614789');
    expect(normalizeAgentPhone('+33 6 52 61 47 89')).toBe('33652614789');
  });

  it('sin indicativo, o demasiado corto, no vale', () => {
    expect(normalizeAgentPhone('3102502207')).toBeNull();
    expect(normalizeAgentPhone('+57 310')).toBeNull();
  });
});
