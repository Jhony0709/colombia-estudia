/**
 * Recordatorio de cuota vencida al pagador (job diario). Con el marco de marca cuando se sabe
 * el origen público de la app; sin él, HTML mínimo (el texto es lo que cuenta). El programa por
 * su nombre, no por el código de la cohorte (8/10).
 */

import { escapeHtml, renderBrandedEmail } from './layout';

export function renderOverdueEmail(data: {
  givenName: string;
  institutionName: string;
  position: number;
  programName: string;
  /** `YYYY-MM-DD`. */
  dueOn: string;
  origin: string | null;
}): { subject: string; html: string; text: string } {
  const subject = `${data.institutionName}: tienes una cuota vencida`;
  const line = `La cuota ${data.position} de ${data.programName} venció el ${data.dueOn}. Entra a tu cuenta para pagarla o escríbenos para acordar un plan.`;
  const calm = 'Tu acceso a las clases no cambia por esto.';
  const text = `Hola ${data.givenName}. ${line} ${calm}`;
  const name = escapeHtml(data.givenName);

  if (!data.origin) {
    return {
      subject,
      text,
      html: `<p>Hola ${name}.</p><p>${escapeHtml(line)}</p><p>${calm}</p>`,
    };
  }
  return {
    subject,
    text,
    html: renderBrandedEmail({
      origin: data.origin,
      preheader: line,
      heading: `Hola, ${name}`,
      paragraphs: [escapeHtml(line), calm],
      cta: {
        href: new URL('/aprender/mi-cuenta', data.origin).toString(),
        label: 'Ir a mi cuenta',
      },
      footnote: `Si ya pagaste, no tienes que hacer nada: el pago puede tardar en reflejarse.`,
    }),
  };
}
