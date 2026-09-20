'use client';

/**
 * El formulario de alta de un programa, en su propia ruta.
 *
 * Son cuatro campos y se crea un programa cada varios meses: el viaje a una pantalla propia
 * se paga solo con tener título, foco y una dirección que se puede enviar por chat. Añadir
 * un módulo o una asignatura, que son un campo y se repiten, siguen en línea en su lista.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CurriculumFeedback, useCurriculumSend } from '../../curriculum-send';
import { ProgramForm } from '../programs-manager';

export function NewProgram() {
  const t = useTranslations('admin.curriculum');
  const router = useRouter();
  const { busy, feedback, send } = useCurriculumSend();

  return (
    <div className="space-y-6">
      <CurriculumFeedback feedback={feedback} />
      <ProgramForm
        submitLabel={t('create')}
        busy={busy}
        onSubmit={async (values) => {
          const ok = await send('/api/admin/programs', 'POST', values, t('programCreated'));
          if (ok) router.push('/contenido/programas');
        }}
      />
    </div>
  );
}
