/**
 * `/aprender/ruta` (20/11): el destino «Mi ruta» de la barra. Lleva a la página del curso de
 * la matrícula activa más reciente; sin matrícula, al inicio.
 * SSOT: reference/01-routing/routes.md
 */

import { redirect } from 'next/navigation';
import { getRequestContext } from '@/lib/authz/request-context';
import { listMyEnrollments } from '@/features/learn/server/cohort.service';

export default async function MyRoutePage() {
  const ctx = await getRequestContext();
  if (!ctx.person) redirect('/aprender');
  const [first] = await listMyEnrollments({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });
  redirect(first ? `/aprender/curso/${first.enrollmentId}` : '/aprender');
}
