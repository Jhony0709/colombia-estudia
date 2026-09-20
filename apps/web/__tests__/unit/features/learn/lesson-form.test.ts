/**
 * La forma de un tema decide cómo se completa, así que equivocarla deja a un estudiante sin
 * poder terminar —o se lo da por terminado sin que haya hecho nada.
 */

import { lessonFormOf } from '@/features/learn/server/lesson-form';
import type { ParsedLesson } from '@colombia-estudia/types';

const parsedCon = (
  kinds: Array<'image' | 'video' | 'audio' | 'pdf'>
): Pick<ParsedLesson, 'assets'> => ({
  assets: kinds.map((kind, index) => ({ id: `asset-${index}`, kind })),
});

describe('lessonFormOf', () => {
  it('sin recursos es MARKDOWN', () => {
    expect(lessonFormOf({ parsed: parsedCon([]), requiresSubmission: false })).toBe('MARKDOWN');
  });

  it('con un video embebido es VIDEO', () => {
    expect(lessonFormOf({ parsed: parsedCon(['video']), requiresSubmission: false })).toBe('VIDEO');
  });

  it('con imágenes pero sin video sigue siendo MARKDOWN', () => {
    expect(
      lessonFormOf({ parsed: parsedCon(['image', 'image', 'pdf']), requiresSubmission: false })
    ).toBe('MARKDOWN');
  });

  // La tabla del contrato no tiene fila de audio. MARKDOWN (scroll + tiempo) es lo más
  // cercano a "estuvo aquí el rato que dura"; darle la regla del video sería inventarse una
  // posición que nadie reporta.
  it('con audio y sin video cae en MARKDOWN', () => {
    expect(lessonFormOf({ parsed: parsedCon(['audio']), requiresSubmission: false })).toBe(
      'MARKDOWN'
    );
  });

  // Lo que completa una actividad es que un instructor apruebe la entrega. Si el video
  // ganara, ver el video la daría por hecha y nadie revisaría nada.
  it('un tema con entrega es SUBMISSION aunque embeba un video', () => {
    expect(lessonFormOf({ parsed: parsedCon(['video']), requiresSubmission: true })).toBe(
      'SUBMISSION'
    );
  });

  it('un tema con entrega y sin recursos también es SUBMISSION', () => {
    expect(lessonFormOf({ parsed: parsedCon([]), requiresSubmission: true })).toBe('SUBMISSION');
  });
});
