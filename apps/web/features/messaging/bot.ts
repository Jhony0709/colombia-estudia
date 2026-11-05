/**
 * Lo que dice el bot de WhatsApp (5/11): el saludo con el menú y la respuesta a cada opción.
 * Puro, sin red ni base: el servicio decide cuándo, esto decide qué. Las opciones irán cambiando
 * (Jhonny, 5/11); los textos viven aquí.
 */

export const CHOICES = {
  programs: 'programas',
  enroll: 'inscribirme',
  support: 'soporte',
  advisor: 'asesor',
} as const;

export type Choice = (typeof CHOICES)[keyof typeof CHOICES];

/** El saludo: lista interactiva (título ≤ 24 caracteres, descripción ≤ 72). */
export function menu(institutionName: string) {
  return {
    body: `¡Hola! Soy el asistente de ${institutionName}. ¿En qué te ayudamos?`,
    button: 'Ver opciones',
    options: [
      {
        id: CHOICES.programs,
        title: 'Programas y precios',
        description: 'Qué ofrecemos y cuánto cuesta',
      },
      {
        id: CHOICES.enroll,
        title: 'Cómo inscribirme',
        description: 'Crea tu cuenta y empieza con la introducción gratis',
      },
      {
        id: CHOICES.support,
        title: 'Soporte de la plataforma',
        description: 'No puedo entrar, contraseña o exámenes',
      },
      {
        id: CHOICES.advisor,
        title: 'Hablar con un asesor',
        description: 'Te atiende una persona del equipo',
      },
    ],
  };
}

const AGAIN = 'Escribe *menú* para ver las opciones otra vez.';

/** La respuesta a una opción del menú; `null` si no es una opción que el bot contesta solo. */
export function answerFor(choiceId: string | null, siteUrl: string): string | null {
  switch (choiceId) {
    case CHOICES.programs:
      return `Aquí ves nuestros programas, lo que incluye cada uno y su precio: ${siteUrl}/#programas\n\nSi quieres que te orientemos, elige «Hablar con un asesor». ${AGAIN}`;
    case CHOICES.enroll:
      return `Crea tu cuenta aquí: ${siteUrl}/registro\n\nAl registrarte empiezas la introducción, que es gratis. Cuando quieras seguir con un programa de pago, lo pides desde tu panel y te contactamos. ${AGAIN}`;
    case CHOICES.support:
      return `Para entrar: ${siteUrl}/ingresar\nSi olvidaste tu contraseña: ${siteUrl}/auth/recuperar\n\nSi el problema es con un tema o un examen, usa «Reportar un problema» en esa misma pantalla. Si sigue sin funcionar, elige «Hablar con un asesor». ${AGAIN}`;
    case CHOICES.advisor:
      return 'Listo. Le avisamos al equipo y un asesor te escribe por aquí en unos minutos. Puedes ir contándonos qué necesitas.';
    default:
      return null;
  }
}

/** Escribió «menú» (o «menu», «hola», «inicio»): vuelve el saludo. */
export function asksForMenu(text: string): boolean {
  return /^\s*(men[uú]|hola|inicio|opciones)\s*[.!?]*\s*$/i.test(text);
}
