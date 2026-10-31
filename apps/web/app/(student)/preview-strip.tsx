import { getRequestContext } from '@/lib/authz/request-context';
import { getPreviewOf } from '@/features/cohorts/server/preview.service';
import { PreviewBanner } from './preview-banner';

/** La franja de la vista de estudiante para la matrícula en pantalla (31/10); nada si es real. */
export async function PreviewStrip({ enrollmentId }: { enrollmentId: string | null }) {
  if (!enrollmentId) return null;
  const ctx = await getRequestContext();
  if (!ctx.person) return null;
  const preview = await getPreviewOf({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    enrollmentId,
  });
  return preview ? <PreviewBanner {...preview} /> : null;
}
