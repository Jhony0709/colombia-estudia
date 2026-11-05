/** @jest-environment node */
/**
 * El bot de WhatsApp (5/11): el menú cabe en los límites de WhatsApp y cada opción tiene su
 * respuesta. SSOT: features/messaging/bot.ts.
 */

import { answerFor, asksForMenu, CHOICES, menu } from '@/features/messaging/bot';

describe('menu', () => {
  it('cuatro opciones dentro de los límites de una lista de WhatsApp', () => {
    const list = menu('ALBA Futuro Educativo');
    expect(list.options.map((o) => o.id)).toEqual([
      'programas',
      'inscribirme',
      'soporte',
      'asesor',
    ]);
    for (const option of list.options) {
      expect(option.title.length).toBeLessThanOrEqual(24);
      expect((option.description ?? '').length).toBeLessThanOrEqual(72);
    }
    expect(list.button.length).toBeLessThanOrEqual(20);
    expect(list.body).toContain('ALBA Futuro Educativo');
  });
});

describe('answerFor', () => {
  it('cada opción responde con su enlace', () => {
    expect(answerFor(CHOICES.programs, 'https://alba.test')).toContain(
      'https://alba.test/#programas'
    );
    expect(answerFor(CHOICES.enroll, 'https://alba.test')).toContain('https://alba.test/registro');
    expect(answerFor(CHOICES.support, 'https://alba.test')).toContain(
      'https://alba.test/auth/recuperar'
    );
    expect(answerFor(CHOICES.advisor, 'https://alba.test')).toMatch(/asesor/);
  });

  it('lo que no es una opción no tiene respuesta: vuelve el menú', () => {
    expect(answerFor(null, 'https://alba.test')).toBeNull();
    expect(answerFor('otra', 'https://alba.test')).toBeNull();
  });
});

describe('asksForMenu', () => {
  it.each(['menú', 'Menu', 'hola!', ' inicio ', 'opciones'])('«%s» pide el menú', (text) => {
    expect(asksForMenu(text)).toBe(true);
  });

  it('una pregunta cualquiera no', () => {
    expect(asksForMenu('hola, quiero saber el precio')).toBe(false);
  });
});
