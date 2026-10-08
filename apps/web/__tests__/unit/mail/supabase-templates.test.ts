/** @jest-environment node */
/**
 * Las plantillas de Supabase Auth (`supabase/templates/`) son HTML estático que se pega en el
 * panel: no pueden leer los tokens. Este test es lo que impide que se queden con una paleta vieja.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { light } from '@colombia-estudia/design-tokens';

const dir = resolve(__dirname, '../../../../../supabase/templates');
const templates = ['recovery.html', 'magic_link.html'];

describe.each(templates)('supabase/templates/%s', (file) => {
  const html = readFileSync(resolve(dir, file), 'utf8');

  it('usa los colores vigentes del tema claro', () => {
    expect(html).toContain(`background:${light.accent.base}`);
    expect(html).toContain(`color:${light.text.onAccent}`);
    expect(html).toContain(`color:${light.text.muted}`);
    expect(html).toContain(`background:${light.surface.canvas}`);
    expect(html).toContain(`background:${light.brand.yellow}`);
  });

  it('enlaza con la URL de confirmación de Supabase y el logo del sitio', () => {
    expect(html).toContain('{{ .ConfirmationURL }}');
    expect(html).toContain('{{ .SiteURL }}/brand/alba-logo-horizontal.png');
  });

  it('empieza por el doctype (sin modo quirks)', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });
});
