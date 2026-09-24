/**
 * La biblioteca del estudiante: lo descargable de su cohorte, por módulo.
 * SSOT: routes.md:37, endpoints.md:47, plan/08 §5 (grabaciones).
 *
 * Qué entra: los documentos (PDF) y audios citados por las versiones de tema **asignadas**
 * a la cohorte —la versión congelada en la asignación, no la última—, con URL firmada de
 * diez minutos; y las grabaciones de las sesiones en vivo (Vimeo, se enlazan por id). Las
 * imágenes no: son parte del tema, no un recurso aparte.
 *
 * Solo temas habilitados por la secuencia: la biblioteca no es una puerta lateral al
 * contenido que la progresión todavía no abrió.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { createReadUrl } from '@/lib/media/storage';
import { getCohortOutline, listMyEnrollments } from './cohort.service';

export interface LibraryItem {
  id: string;
  kind: 'DOCUMENT' | 'AUDIO' | 'RECORDING';
  title: string;
  lessonTitle: string | null;
  /** Descarga firmada (documentos y audios) o enlace de Vimeo (grabaciones). */
  href: string;
  sizeBytes: number | null;
  durationSeconds: number | null;
}

export interface LibraryModule {
  id: string;
  name: string;
  items: LibraryItem[];
}

/**
 * La biblioteca de todas las cohortes activas del estudiante (21/9). Con más de un programa,
 * cada módulo lleva delante el nombre de su programa para que «Módulo 1» de uno no se
 * confunda con «Módulo 1» del otro.
 */
export async function getLibraryForStudent({
  institutionId,
  personId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  now?: Date;
}): Promise<{ modules: LibraryModule[]; recordings: LibraryItem[] }> {
  const mine = await listMyEnrollments({ institutionId, personId, now });
  const active = mine.filter((row) => row.gate === null);

  const parts = await Promise.all(
    active.map((row) =>
      getLibraryForEnrollment({ institutionId, personId, enrollmentId: row.enrollmentId, now })
    )
  );

  const several = active.length > 1;
  return {
    modules: parts.flatMap((part, index) =>
      part.modules.map((m) =>
        several ? { ...m, name: `${active[index]!.cohort.programName} · ${m.name}` } : m
      )
    ),
    recordings: parts.flatMap((part) => part.recordings),
  };
}

async function getLibraryForEnrollment({
  institutionId,
  personId,
  enrollmentId,
  now,
}: {
  institutionId: string;
  personId: string;
  enrollmentId: string;
  now: Date;
}): Promise<{ modules: LibraryModule[]; recordings: LibraryItem[] }> {
  const outline = await getCohortOutline({ institutionId, personId, enrollmentId, now });
  if (outline.gate || !outline.cohort) return { modules: [], recordings: [] };

  const enabledLessonIds = new Set(
    outline.modules.flatMap((m) =>
      m.items.filter((i) => i.kind === 'LESSON' && i.enabled).map((i) => i.assignmentId)
    )
  );

  const db = createTenantClient(institutionId);
  const [assignments, sessions] = await Promise.all([
    db.lessonAssignment.findMany({
      where: { id: { in: [...enabledLessonIds] } },
      select: {
        id: true,
        lesson: { select: { title: true, moduleId: true } },
        lessonVersion: {
          select: {
            assets: {
              select: {
                mediaAsset: {
                  select: {
                    id: true,
                    kind: true,
                    status: true,
                    provider: true,
                    providerRef: true,
                    altText: true,
                    sizeBytes: true,
                    durationSeconds: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.liveSession.findMany({
      where: { cohortId: outline.cohort.id, archivedAt: null, recordingId: { not: null } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, title: true, recordingId: true },
    }),
  ]);

  // `recordingId` no es una relación en el schema (es un id suelto), así que se resuelve aparte.
  const recordingIds = sessions.map((s) => s.recordingId).filter((x): x is string => x !== null);
  const recordingAssets = recordingIds.length
    ? await db.mediaAsset.findMany({
        where: { id: { in: recordingIds }, kind: 'VIDEO', status: 'READY' },
        select: { id: true, providerRef: true, durationSeconds: true },
      })
    : [];
  const recordingById = new Map(recordingAssets.map((r) => [r.id, r]));

  const byModule = new Map<string, LibraryItem[]>();
  for (const a of assignments) {
    for (const { mediaAsset: m } of a.lessonVersion.assets) {
      if (m.status !== 'READY' || m.provider !== 'STORAGE') continue;
      if (m.kind !== 'DOCUMENT' && m.kind !== 'AUDIO') continue;
      const fileName = m.providerRef.split('/').pop() ?? 'archivo';
      const list = byModule.get(a.lesson.moduleId) ?? [];
      list.push({
        id: m.id,
        kind: m.kind,
        title: m.altText?.trim() || fileName,
        lessonTitle: a.lesson.title,
        href: await createReadUrl(m.providerRef, { fileName }),
        sizeBytes: m.sizeBytes,
        durationSeconds: m.durationSeconds,
      });
      byModule.set(a.lesson.moduleId, list);
    }
  }

  const modules: LibraryModule[] = outline.modules
    .map((m) => ({ id: m.id, name: m.name, items: byModule.get(m.id) ?? [] }))
    .filter((m) => m.items.length > 0);

  const recordings: LibraryItem[] = sessions.flatMap((s) => {
    const r = s.recordingId ? recordingById.get(s.recordingId) : undefined;
    if (!r) return [];
    return [
      {
        id: s.id,
        kind: 'RECORDING' as const,
        title: s.title,
        lessonTitle: null,
        href: `https://vimeo.com/${r.providerRef}`,
        sizeBytes: null,
        durationSeconds: r.durationSeconds,
      },
    ];
  });

  return { modules, recordings };
}
