/** @jest-environment node */

import { renderOverdueEmail } from '@/lib/mail/templates/overdue';
import { light } from '@colombia-estudia/design-tokens';

const base = {
  givenName: 'Ana',
  institutionName: 'ALBA Futuro Educativo',
  position: 2,
  programName: 'Bachillerato por ciclos',
  dueOn: '2026-10-01',
  origin: 'https://albafuturoeducativo.com',
};

describe('renderOverdueEmail', () => {
  it('nombra el programa, no la cohorte', () => {
    const { html, text } = renderOverdueEmail(base);
    expect(text).toContain('La cuota 2 de Bachillerato por ciclos');
    expect(html).toContain('Bachillerato por ciclos');
  });

  it('escapa el nombre', () => {
    const { html } = renderOverdueEmail({ ...base, givenName: '<b>Ana</b>' });
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(html).not.toContain('<b>Ana</b>');
  });

  it('con origen: el marco de marca, el logo y el botón a «Mi cuenta»', () => {
    const { html } = renderOverdueEmail(base);
    expect(html).toContain('https://albafuturoeducativo.com/brand/alba-logo-horizontal.png');
    expect(html).toContain('href="https://albafuturoeducativo.com/aprender/mi-cuenta"');
    expect(html).toContain(`background:${light.accent.base}`);
  });

  it('sin origen: HTML mínimo, sin enlaces rotos', () => {
    const { html } = renderOverdueEmail({ ...base, origin: null });
    expect(html).not.toContain('<img');
    expect(html).toContain('Tu acceso a las clases no cambia por esto.');
  });
});
