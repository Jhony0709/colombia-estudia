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
  parseBirthDate,
  remaining,
  suggestEmail,
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
    // El teléfono no se pregunta: es el de WhatsApp (22/11).
    expect(data.phone).toBe('+573001112233');
    run(say('Laura Gómez'));
    run(say('', 'intake_opt_grade_3'));
    run(say('sí'));
    const summary = run(say('laura@correo.co'));
    expect(step).toBe(CONFIRM);
    expect(summary.status === 'next' && summary.reply.text).toContain('Revisa tus datos');
    const done = intakeAnswer('ENROLL', step, data, say('', 'intake_yes'), CTX);
    expect(done.status).toBe('done');
    expect(done.status === 'done' && done.data).toMatchObject({
      fullName: 'Laura Gómez',
      phone: '+573001112233',
      grade: '8°',
      adult: 'Sí, 18 o más',
      email: 'laura@correo.co',
    });
    expect(done.status === 'done' && done.data.guardian).toBeUndefined();
  });

  it('sin autorización no guarda nada y sale', () => {
    expect(intakeAnswer('ENROLL', 0, {}, say('', 'intake_no'), CTX).status).toBe('cancel');
    expect(intakeAnswer('ENROLL', 0, {}, say('quizá'), CTX).status).toBe('retry');
  });

  it('«Corregir» en el resumen deja elegir el dato y vuelve al resumen', () => {
    const data = { fullName: 'Laura', phone: '+57300', adult: 'Sí, 18 o más', email: 'l@x.co' };
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
    // El 2 es el teléfono, que no se pregunta: vuelve al nombre.
    expect(r.status === 'next' && r.step).toBe(1);
  });

  it.each([
    [2, 'mi cel'],
    [6, 'laura arroba correo'],
    [4, 'tal vez'],
    [1, '[image]'],
    [1, '   '],
  ])('la pregunta %i no acepta «%s»', (step, text) => {
    expect(intakeAnswer('ENROLL', step, { _consentAt: 'x' }, say(text), CTX).status).toBe('retry');
  });
});

describe('inscripción: acudiente solo para menores (22/11)', () => {
  it('menor de edad: pregunta el acudiente antes del correo', () => {
    const r = intakeAnswer('ENROLL', 4, { fullName: 'Ana' }, say('', 'intake_opt_adult_1'), CTX);
    expect(r.status === 'next' && r.step).toBe(5);
    expect(r.status === 'next' && r.reply.text).toContain('acudiente');
  });

  it('al corregir «mayor de edad» a «no», pide el acudiente y vuelve al resumen', () => {
    const data = { fullName: 'Ana', phone: '+57', adult: 'Sí, 18 o más', email: 'a@x.co' };
    const fix = intakeAnswer('ENROLL', 4, { ...data, _back: 'confirm' }, say('no'), CTX);
    expect(fix.status === 'next' && fix.step).toBe(5);
    if (fix.status !== 'next') return;
    const back = intakeAnswer('ENROLL', 5, fix.data, say('Rosa 3001112233'), CTX);
    expect(back.status === 'next' && back.step).toBe(CONFIRM);
  });
});

describe('crear la cuenta (22/11)', () => {
  const ACCOUNT_CONFIRM = FIELDS.ACCOUNT.length + 1;
  const consented = () => {
    const r = intakeAnswer('ACCOUNT', 0, {}, say('', 'intake_yes'), CTX);
    if (r.status !== 'next') throw new Error('sin autorización');
    return r;
  };

  it('autoriza y pregunta primero si es mayor de edad, con botones', () => {
    const r = consented();
    expect(r.step).toBe(1);
    expect(r.reply.buttons?.map((b) => b.title)).toEqual(['Sí, 18 o más', 'No, soy menor']);
  });

  it('un menor sale del formulario sin guardar nada y va a /registro', () => {
    const r = intakeAnswer('ACCOUNT', 1, consented().data, say('', 'intake_opt_adult_1'), {
      ...CTX,
      siteUrl: 'https://alba.test',
    });
    expect(r.status).toBe('cancel');
    expect(r.status === 'cancel' && r.reply.text).toContain('https://alba.test/registro');
  });

  it('nombre y apellido, correo y fecha de nacimiento; la fecha de un menor también lo saca', () => {
    let { data, step } = consented();
    const go = (input: ReturnType<typeof say>) => {
      const r = intakeAnswer('ACCOUNT', step, data, input, CTX);
      if (r.status === 'next') ({ data, step } = r);
      return r;
    };
    go(say('', 'intake_opt_adult_0'));
    expect(go(say('Laura')).status).toBe('retry');
    go(say('Laura Gómez'));
    go(say('laura@correo.co'));
    expect(go(say('31/02/1990')).status).toBe('retry');
    expect(intakeAnswer('ACCOUNT', step, data, say('01/01/2015'), CTX).status).toBe('cancel');
    const summary = go(say('31/12/1990'));
    expect(step).toBe(ACCOUNT_CONFIRM);
    expect(summary.status === 'next' && summary.reply.text).toContain('31/12/1990');
    expect(data).toMatchObject({
      fullName: 'Laura Gómez',
      email: 'laura@correo.co',
      birthDate: '1990-12-31',
      phone: '+573001112233',
    });
  });
});

describe('parseBirthDate', () => {
  it.each([
    ['31/12/1990', '1990-12-31'],
    ['1-2-2001', '2001-02-01'],
    ['29/02/2023', null],
    ['1990-12-31', '1990-12-31'],
    // 22/11: como lo escribe la gente.
    ['31 de diciembre de 1990', '1990-12-31'],
    ['31 dic 1990', '1990-12-31'],
    ['5 de Septiembre del 2001', '2001-09-05'],
    ['31/12/90', '1990-12-31'],
    ['01-02-05', '2005-02-01'],
    ['31 de diciembrito de 1990', null],
  ])('«%s» → %s', (text, iso) => expect(parseBirthDate(text)).toBe(iso));
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

describe('formulario más amable (22/11)', () => {
  it('muestra el avance y saluda por el nombre', () => {
    const consent = intakeAnswer('ENROLL', 0, {}, say('', 'intake_yes'), CTX);
    expect(consent.status === 'next' && consent.reply.text).toMatch(/^\*1 de 4\* · /);
    if (consent.status !== 'next') return;
    const name = intakeAnswer('ENROLL', 1, consent.data, say('Laura Gómez'), CTX);
    expect(name.status === 'next' && name.reply.text).toContain('Mucho gusto, Laura 👋');
    expect(name.status === 'next' && name.reply.text).toContain('*2 de 4* · ');
  });

  it('sugiere el correo bien escrito; «sí» lo toma y «no» deja el suyo', () => {
    const data = { fullName: 'Laura', grade: '8°', adult: 'Sí, 18 o más', _consentAt: 'x' };
    const typo = intakeAnswer('ENROLL', 6, data, say('laura@gmial.com'), CTX);
    expect(typo.status === 'next' && typo.step).toBe(6);
    expect(typo.status === 'next' && typo.reply.text).toContain('laura@gmail.com');
    if (typo.status !== 'next') return;
    const yes = intakeAnswer('ENROLL', 6, typo.data, say('', 'intake_sugg_yes'), CTX);
    expect(yes.status === 'next' && yes.data.email).toBe('laura@gmail.com');
    expect(yes.status === 'next' && yes.data._emailSuggestion).toBeUndefined();
    const no = intakeAnswer('ENROLL', 6, typo.data, say('', 'intake_sugg_no'), CTX);
    expect(no.status === 'next' && no.data.email).toBe('laura@gmial.com');
  });

  it('el recordatorio: «Continuar» repite donde iba y «Cancelar» sale', () => {
    const go = intakeAnswer('ENROLL', 6, { fullName: 'Laura' }, say('', 'intake_continue'), CTX);
    expect(go.status).toBe('retry');
    expect(go.status === 'retry' && go.reply.text).toContain('correo');
    expect(intakeAnswer('ENROLL', 6, {}, say('', 'intake_cancel'), CTX).status).toBe('cancel');
  });

  it('cuántos datos faltan', () => {
    expect(remaining('ENROLL', 1, {})).toBe(4);
    expect(remaining('ENROLL', 1, { adult: 'No, soy menor' })).toBe(5);
    expect(remaining('ENROLL', 6, { adult: 'Sí, 18 o más' })).toBe(1);
  });
});

describe('suggestEmail', () => {
  it.each([
    ['laura@gmial.com', 'laura@gmail.com'],
    ['laura@hotmal.com', 'laura@hotmail.com'],
    ['laura@gmail.co', 'laura@gmail.com'],
    ['laura@outlok.com', 'laura@outlook.com'],
    ['laura@gmail.com', null],
    ['laura@empresa.com.co', null],
  ])('%s → %s', (email, expected) => expect(suggestEmail(email)).toBe(expected));
});
