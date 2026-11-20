/** @jest-environment node */
/**
 * Los datos que el bot pide por el chat (14/11): autorización primero, una pregunta a la vez,
 * resumen para confirmar o corregir y nada de número de documento (política de WhatsApp).
 * SSOT: features/messaging/intake.ts.
 */

import { DEFAULT_FACTS } from '@/features/messaging/facts';
import {
  cancelsIntake,
  FIELDS,
  intakeAnswer,
  intakeStart,
  intakeSummary,
  isIntakeChoice,
  type IntakeData,
} from '@/features/messaging/intake';

const CTX = {
  waId: '573001112233',
  now: new Date('2026-11-14T15:00:00.000Z'),
  policyUrl: 'https://alba.test/politica-de-datos',
};
const say = (text: string, choiceId: string | null = null) => ({ text, choiceId });
const CONFIRM = FIELDS.ENROLL.length + 1;

describe('intakeStart', () => {
  it('pide la autorización con la política antes de cualquier dato', () => {
    const start = intakeStart('ENROLL', DEFAULT_FACTS, CTX.policyUrl);
    expect(start.text).toContain(CTX.policyUrl);
    expect(start.buttons?.map((b) => b.id)).toEqual(['intake_yes', 'intake_no']);
    expect(intakeStart('CERTIFICATE', DEFAULT_FACTS, CTX.policyUrl).text).toContain('$11.000');
  });

  it('no pide número de documento por el chat', () => {
    const keys = [...FIELDS.ENROLL, ...FIELDS.CERTIFICATE].map((f) => f.key);
    expect(keys).not.toContain('document');
  });
});

describe('intakeAnswer', () => {
  it('autoriza, responde todo, revisa y envía', () => {
    let step = 0;
    let data: IntakeData = {};
    const run = (input: ReturnType<typeof say>) => {
      const r = intakeAnswer('ENROLL', step, data, input, CTX);
      if (r.status === 'next') {
        step = r.step;
        data = r.data;
      }
      return r;
    };
    expect(run(say('', 'intake_yes')).status).toBe('next');
    expect(data._consentAt).toBe(CTX.now.toISOString());
    run(say('Laura Gómez'));
    run(say('este'));
    run(say('laura@correo.co'));
    const summary = run(say('no'));
    expect(step).toBe(CONFIRM);
    expect(summary.status === 'next' && summary.reply.text).toContain('Revisa tus datos');
    const done = intakeAnswer('ENROLL', step, data, say('', 'intake_yes'), CTX);
    expect(done.status).toBe('done');
    expect(done.status === 'done' && done.data).toMatchObject({
      fullName: 'Laura Gómez',
      phone: '+573001112233',
      email: 'laura@correo.co',
      guardian: 'No aplica',
    });
  });

  it('sin autorización no guarda nada y sale', () => {
    expect(intakeAnswer('ENROLL', 0, {}, say('', 'intake_no'), CTX).status).toBe('cancel');
    expect(intakeAnswer('ENROLL', 0, {}, say('quizá'), CTX).status).toBe('retry');
  });

  it('«Corregir» en el resumen deja elegir el dato y vuelve al resumen', () => {
    const data = { fullName: 'Laura', phone: '+57300', email: 'l@x.co', guardian: 'No aplica' };
    const fix = intakeAnswer('ENROLL', CONFIRM, data, say('', 'intake_fix'), CTX);
    expect(fix.status === 'next' && fix.reply.list?.options.map((o) => o.id)).toContain(
      'intake_field_email'
    );
    if (fix.status !== 'next') return;
    const pick = intakeAnswer('ENROLL', fix.step, data, say('', 'intake_field_email'), CTX);
    expect(pick.status === 'next' && pick.reply.text).toContain('correo');
    if (pick.status !== 'next') return;
    const back = intakeAnswer('ENROLL', pick.step, pick.data, say('otra@correo.co'), CTX);
    expect(back.status === 'next' && back.step).toBe(CONFIRM);
    expect(back.status === 'next' && back.data.email).toBe('otra@correo.co');
    expect(back.status === 'next' && back.data._back).toBeUndefined();
  });

  it('«corregir» en medio de las preguntas vuelve a la anterior', () => {
    const r = intakeAnswer('ENROLL', 3, { fullName: 'Laura' }, say('corregir'), CTX);
    expect(r.status === 'next' && r.step).toBe(2);
  });

  it.each([
    [2, 'mi cel'],
    [3, 'laura arroba correo'],
    [1, '[image]'],
    [1, '   '],
  ])('la pregunta %i no acepta «%s»', (step, text) => {
    expect(intakeAnswer('ENROLL', step, { _consentAt: 'x' }, say(text), CTX).status).toBe('retry');
  });
});

describe('intakeSummary', () => {
  it('etiqueta y valor en orden, sin los vacíos ni los datos del bot', () => {
    expect(
      intakeSummary('CERTIFICATE', { reason: 'Trabajo', fullName: 'Laura', _consentAt: 'x' })
    ).toEqual([
      { label: 'Nombre completo', value: 'Laura' },
      { label: 'Motivo', value: 'Trabajo' },
    ]);
  });
});

describe('cancelsIntake e isIntakeChoice', () => {
  it.each(['cancelar', 'Salir', ' cancelar. '])('«%s» sale', (t) =>
    expect(cancelsIntake(t)).toBe(true)
  );
  it('una respuesta normal no', () => expect(cancelsIntake('Laura Cancelaria')).toBe(false));
  it('solo los botones del formulario son suyos', () => {
    expect(isIntakeChoice('intake_yes')).toBe(true);
    expect(isIntakeChoice('programas')).toBe(false);
    expect(isIntakeChoice(null)).toBe(false);
  });
});
