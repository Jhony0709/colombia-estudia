'use client';

/**
 * El espacio de trabajo de un tema: escribir, autoguardar, ver los avisos y publicar.
 * SSOT: plan/07-contenido-y-migracion.md:28-38, revisión de UX del 19/9.
 *
 * Este componente pinta también la CABECERA de la pantalla, y no `page.tsx`, porque las dos
 * acciones de la cabecera —vista previa y publicar— dependen de lo que hay escrito y sin
 * guardar, y eso vive aquí. El `h1` sigue siendo el de `PageHeader`; solo cambia quién lo
 * renderiza.
 *
 * Orden de la pantalla (19/9): cabecera con las acciones → los datos del tema, plegados → el
 * texto, con los vídeos dentro y su accesibilidad en un diálogo → los avisos, solo si los hay.
 * Antes había siete bloques y tres botones de guardar; ahora el guardado es uno (automático, y
 * antes de previsualizar o publicar) y lo que no aporta nada no se pinta.
 *
 * La vista previa y la publicación abren una hoja y un diálogo en vez de ocupar tarjetas:
 * ninguna de las dos se mira mientras se escribe, y las dos tapaban lo que sí.
 *
 * El área de texto es `BlockEditor` (`features/content/editor`): bloques, cada uno un campo
 * nativo, y lo que llega aquí es Markdown, que es lo que se guarda. Todo lo demás
 * —autoguardado, avisos, ir a la línea, publicar— no sabe qué widget hay debajo.
 *
 * La vista previa usa `renderLessonHtml`, **la misma función que usa el player**. Una vista
 * previa que renderizara por su cuenta sería la vista previa de algo que no existe.
 */

import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/atoms/alert';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { PageHeader } from '@/components/templates/page';
import { PageHelp } from '@/components/organisms/page-help';
import { Sheet } from '@/components/organisms/sheet';
import { useToast } from '@/components/organisms/toaster';
import { issueText } from '@/lib/content/issue-text';
import { LessonDetailsForm, type ModuleChoice, type SubjectChoice } from './lesson-details-form';
import { lessonHelpTopics } from './lesson-help';
import { MediaSettingsDialog, useLessonMedia } from './lesson-media';
import { LessonActivity, type ActivityAccepts } from './lesson-activity';
import { BlockEditor, type BlockEditorHandle } from '@/features/content/editor/BlockEditor';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { pendingChecks, ReadinessPanel, type ReadinessCheck } from '../../readiness-panel';
import { PublishedLine } from '../../published-line';
import { EditorLayout } from '../../editor-layout';
import type { LessonReadiness } from '@/features/content/server/readiness.service';

interface Issue {
  rule?: string;
  message: string;
  fix?: string;
  severity?: string;
  line?: number;
  position?: { start?: { line?: number } };
}

interface Validation {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}

/** Cada cinco segundos, como pide el plan (plan/07:36). */
const AUTOSAVE_MS = 5000;

/** El aviso en vivo espera a que se deje de escribir; validar en cada tecla es ruido. */
const VALIDATE_DEBOUNCE_MS = 1200;

const lineOf = (issue: Issue): number | null => issue.line ?? issue.position?.start?.line ?? null;

export interface LessonWorkspaceProps {
  lessonId: string;
  versionId: string;
  /** Lo que la cabecera necesita: el título es el `h1`, la asignatura el rótulo. */
  header: { title: string; subjectName: string; number: number; hasPublished: boolean };
  initialContent: string;
  initialEstimatedMinutes: number | null;
  initialInvalidatesProgress: boolean;
  canPublish: boolean;
  /** Dónde está el tema en la ruta, sus exámenes, su versión publicada y las cohortes abiertas. */
  readiness: LessonReadiness | null;
  /** La actividad, solo en un tema que se completa con una; `null` en los demás. */
  activity: { instructions: string | null; accepts: ActivityAccepts; prompts: string[] } | null;
  details: {
    modules: ModuleChoice[];
    subjects: SubjectChoice[];
    initial: {
      title: string;
      learningObjective: string | null;
      moduleId: string;
      subjectId: string;
      requiresSubmission: boolean;
    };
    usage: { assignments: number; assessments: number; versions: number };
  };
}

export function LessonEditor({
  lessonId,
  versionId,
  header,
  initialContent,
  initialEstimatedMinutes,
  initialInvalidatesProgress,
  canPublish,
  readiness,
  activity,
  details,
}: LessonWorkspaceProps) {
  const t = useTranslations('editor');
  const ti = useTranslations('issues');
  const tc = useTranslations('crumbs');
  const minutesId = useId();
  const blockEditor = useRef<BlockEditorHandle>(null);
  const media = useLessonMedia(lessonId, versionId);
  const [mediaSettings, setMediaSettings] = useState<string | null>(null);

  const [content, setContent] = useState(initialContent);
  const [minutes, setMinutes] = useState<string>(
    initialEstimatedMinutes === null ? '' : String(initialEstimatedMinutes)
  );
  const [reopens, setReopens] = useState(initialInvalidatesProgress);

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [validation, setValidation] = useState<Validation | null>(null);
  // Los avisos de validación como toast (24/9, Jhonny): uno por resultado, no por aviso, y
  // solo cuando el resultado cambia (la validación corre cada pocos segundos). La lista
  // completa, con «ir a la línea», vive en una hoja que abre el toast o el diálogo de publicar.
  const [issuesOpen, setIssuesOpen] = useState(false);
  const { toast } = useToast();
  const lastIssuesKey = useRef<string | null>(null);
  // Los errores de guardar, previsualizar o publicar van en toast (no se van solos).
  const notifyError = useCallback(
    (message: string) => toast({ severity: 'error', title: message, key: 'editor-error' }),
    [toast]
  );
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<{ html: string; missingAssets: string[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const save = useCallback(async () => {
    const parsedMinutes = minutes.trim() === '' ? null : Number(minutes);

    const res = await fetch(`/api/content/lessons/${versionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId,
        content,
        estimatedMinutes: Number.isFinite(parsedMinutes) ? parsedMinutes : null,
        invalidatesProgress: reopens,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      notifyError(payload?.error?.message ?? t('saveError'));
      return false;
    }

    setSavedAt(new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' }));
    setDirty(false);
    return true;
  }, [content, minutes, reopens, t, versionId, notifyError]);

  const validate = useCallback(async () => {
    const res = await fetch(`/api/content/lessons/${versionId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId }),
    });

    if (!res.ok) return;

    // `{ data: … }` es la envoltura de TODAS las respuestas (`lib/http/responses.ts`).
    // Aquí se guardaba la envoltura entera, así que `validation.errors` era `undefined`, la
    // lista caía a `[]` y el panel decía **siempre** «el contenido cumple las reglas de
    // publicación» —con errores de accesibilidad dentro—. El autor solo se enteraba al
    // pulsar Publicar y ver el rechazo del servidor. El editor de evaluaciones ya lo hacía
    // bien; este no.
    const payload = (await res.json()) as { data?: Validation } & Partial<Validation>;
    setValidation((payload.data ?? payload) as Validation);
  }, [versionId]);

  // Autoguardado. Solo corre si hay cambios: un PATCH cada cinco segundos con el mismo
  // texto es tráfico y escrituras para nada.
  useEffect(() => {
    if (!dirty) return;

    const timer = setTimeout(() => {
      void save().then((ok) => {
        if (ok) void validate();
      });
    }, AUTOSAVE_MS);

    return () => clearTimeout(timer);
  }, [dirty, save, validate]);

  // Aviso en vivo: valida lo guardado poco después de dejar de escribir.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!dirty) void validate();
    }, VALIDATE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [content, dirty, validate]);

  useEffect(() => {
    void validate();
  }, [validate]);

  /**
   * Pide la vista previa de lo guardado.
   *
   * Guarda antes si hace falta: una vista previa de un texto distinto del que está en la
   * base sería peor que no tenerla.
   */
  const onPreview = async () => {
    setPreviewing(true);
    setPreviewOpen(true);
    try {
      if (dirty && !(await save())) return;

      const res = await fetch(`/api/content/lessons/${versionId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      const payload = await res.json();

      if (!res.ok) {
        notifyError(payload?.error?.message ?? t('previewError'));
        return;
      }

      setPreview((payload.data ?? payload) as { html: string; missingAssets: string[] });
    } catch {
      notifyError(t('previewError'));
    } finally {
      setPreviewing(false);
    }
  };

  /** Lleva el cursor al bloque de una línea y le da el foco: el enlace del panel de avisos. */
  const goToLine = (line: number) => blockEditor.current?.goToLine(line);

  /**
   * Registra un vídeo de Vimeo y recarga el catálogo, para que el bloque recién insertado
   * enseñe ya su duración y su estado. Es lo que el editor llama al pegar una dirección.
   */
  const registerVideo = async (video: string) => {
    const res = await fetch('/api/media/vimeo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video }),
    });
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as {
      data?: { mediaAssetId: string };
      mediaAssetId?: string;
    } | null;
    const mediaAssetId = payload?.data?.mediaAssetId ?? payload?.mediaAssetId;
    if (!mediaAssetId) return null;
    void media.reload();
    return { mediaAssetId };
  };

  const onPublish = async () => {
    setPublishing(true);
    try {
      if (dirty && !(await save())) return;

      const res = await fetch(`/api/content/lessons/${versionId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      const payload = await res.json();

      if (!res.ok) {
        notifyError(payload?.error?.message ?? t('publishError'));
        void validate();
        return;
      }

      const number = (payload.data?.number ?? payload.number) as number;
      setPublished(number);
      toast({ severity: 'success', title: t('publishedOk', { number }) });
      setConfirming(false);
    } catch {
      notifyError(t('publishError'));
    } finally {
      setPublishing(false);
    }
  };

  // Con `useMemo` para que el efecto de los toasts no se dispare en cada render.
  const errors = useMemo(() => validation?.errors ?? [], [validation]);
  const warnings = useMemo(() => validation?.warnings ?? [], [validation]);
  const blocked = !validation || errors.length > 0 || !canPublish;
  const hasIssues = errors.length + warnings.length > 0;

  useEffect(() => {
    if (validation === null) return;
    const key = [...errors, ...warnings]
      .map((i) => `${i.rule ?? ''}:${lineOf(i) ?? ''}:${i.message ?? ''}`)
      .join('|');
    if (key === lastIssuesKey.current) return;
    const hadBefore = lastIssuesKey.current !== null && lastIssuesKey.current !== '';
    lastIssuesKey.current = key;
    if (errors.length > 0) {
      toast({
        key: 'editor-issues',
        severity: 'error',
        title: t('toast.blocked', { count: errors.length }),
        description: issueText(errors[0]!, ti).message,
        action: { label: t('toast.see'), onClick: () => setIssuesOpen(true) },
      });
    } else if (warnings.length > 0) {
      toast({
        key: 'editor-issues',
        severity: 'warning',
        title: t('toast.warnings', { count: warnings.length }),
        description: issueText(warnings[0]!, ti).message,
        action: { label: t('toast.see'), onClick: () => setIssuesOpen(true) },
      });
    } else if (hadBefore) {
      toast({ key: 'editor-issues', severity: 'success', title: t('toast.clean') });
    }
  }, [validation, errors, warnings, t, ti, toast]);

  const saveStatus = dirty
    ? t('unsaved')
    : savedAt
      ? t('savedAt', { time: savedAt })
      : t('noChanges');

  const checks = readinessChecks({
    t,
    readiness,
    content,
    minutes,
    validation,
    media: media.items,
    activity,
    publishedNumber: published ?? readiness?.published?.number ?? null,
  });
  const pendingCohorts = readiness?.cohorts.pending ?? [];

  return (
    <>
      <PageHeader
        overline={header.subjectName}
        title={header.title}
        back={
          <Breadcrumb
            label={tc('label')}
            items={[
              { label: tc('home'), href: '/ingresar' },
              { label: tc('lessons'), href: '/contenido/temas' },
              { label: header.title },
            ]}
          />
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={previewing}
              onClick={() => void onPreview()}
            >
              {t('previewShow')}
            </Button>
            {/*
              Sin permiso de publicar no hay botón: no es un estado, es que esa decisión es de
              otra persona. CON permiso el botón está siempre, también bloqueado: no abre la
              publicación, abre la explicación de qué la impide. plan/07:37 decía «si hay
              errores no hay botón» porque un botón deshabilitado invita a pelearse con él; uno
              que responde no es ese botón, y quitarlo de la cabecera cada vez que hay un aviso
              hacía que la acción principal de la pantalla apareciera y desapareciera.
            */}
            {canPublish && (
              <Button type="button" onClick={() => setConfirming(true)}>
                {t('publish')}
              </Button>
            )}
          </div>
        }
      />

      {/*
        La versión y el estado del guardado, en una línea bajo la cabecera. El guardado se
        anuncia (`role="status"`): quien no ve la pantalla también necesita saber que su
        trabajo está a salvo (plan/07:36).
      */}
      <div className="-mt-6 flex flex-wrap items-center gap-3">
        <Badge variant={header.hasPublished ? 'info' : 'neutral'}>
          {t('versionLine', { number: header.number })}
        </Badge>
        <p role="status" className="type-caption text-text-muted">
          {saveStatus}
        </p>
        <PublishedLine published={readiness?.published ?? null} />
      </div>

      {/*
        Ola 2 (23/9): la «Preparación» —dónde está el tema, qué le falta y a quién le
        llegará— es una columna fija a la derecha en escritorio y un bloque plegado arriba
        en móvil; el cuerpo queda para escribir.
      */}
      <EditorLayout
        rail={<ReadinessPanel id="preparacion" checks={checks} layout="rail" />}
        railSummary={t('readiness.summary', { pending: pendingChecks(checks) })}
      >
        <LessonDetailsForm
          lessonId={lessonId}
          modules={details.modules}
          subjects={details.subjects}
          hasPublished={header.hasPublished}
          initial={details.initial}
          usage={details.usage}
        />

        {/*
        La única tarjeta sin título propio, y a propósito
        (`reference/03-ui/layout-y-componentes.md` §1): el editor es un `role="group"` de
        campos y su nombre accesible es este párrafo (`aria-labelledby`), como el `<legend>`
        de un `fieldset`. Convertirlo en el `h2` del template haría que el grupo se llamara
        como una sección en vez de como lo que se escribe. Por eso `Card` recibe `labelledBy`.
      */}
        <Card labelledBy="editor-texto">
          <p id="editor-texto" className="type-subheading text-text">
            {t('contentLabel')}
          </p>

          <BlockEditor
            ref={blockEditor}
            labelledBy="editor-texto"
            initialMarkdown={initialContent}
            media={media.items ?? []}
            onRegisterVideo={registerVideo}
            onMediaSettings={setMediaSettings}
            onChange={(markdown) => {
              setContent(markdown);
              setDirty(true);
            }}
          />

          {/* Los minutos son de la versión, como el texto, y se guardan con él. */}
          <div className="w-40">
            <label htmlFor={minutesId} className="type-label text-text block">
              {t('minutesLabel')}
            </label>
            <input
              id={minutesId}
              type="number"
              min={1}
              max={600}
              inputMode="numeric"
              value={minutes}
              onChange={(event) => {
                setMinutes(event.target.value);
                setDirty(true);
              }}
              className="border-border bg-surface-base text-text type-body min-h-control rounded-control mt-1 w-full border px-3"
            />
          </div>
        </Card>

        {/* La actividad, como sección propia (23/9): qué entrega el estudiante y con qué. */}
        {activity !== null && <LessonActivity lessonId={lessonId} initial={activity} />}

        {/* La accesibilidad de un vídeo se edita en un diálogo desde el engranaje de su bloque. */}
        <MediaSettingsDialog
          item={media.items?.find((item) => item.mediaAssetId === mediaSettings) ?? null}
          open={mediaSettings !== null}
          onClose={() => setMediaSettings(null)}
          onSaved={() => {
            void media.reload();
            void validate();
          }}
        />
      </EditorLayout>

      {/* La lista completa de avisos, con «ir a la línea», en una hoja (24/9). */}
      <Sheet
        open={issuesOpen}
        onOpenChange={setIssuesOpen}
        title={t('issuesTitle')}
        description={t('issuesSheetHint', { errors: errors.length, warnings: warnings.length })}
      >
        {hasIssues ? (
          <IssueList
            issues={[...errors, ...warnings]}
            errorCount={errors.length}
            onGo={(line) => {
              setIssuesOpen(false);
              goToLine(line);
            }}
          />
        ) : (
          <p className="type-body text-text-muted">{t('issuesNone')}</p>
        )}
      </Sheet>

      <PageHelp screen={t('contentLabel')} topics={lessonHelpTopics(t, { canPublish })} />

      {/* ── Vista previa: una hoja, con el render real ── */}
      <Sheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={t('previewTitle')}
        description={t('previewHint')}
        size="reading"
      >
        {previewing || preview === null ? (
          <p className="type-body text-text-muted">{t('validating')}</p>
        ) : (
          <>
            {preview.missingAssets.length > 0 && (
              <Alert severity="warning">
                {t('previewMissing', { count: preview.missingAssets.length })}
              </Alert>
            )}
            {/*
              `dangerouslySetInnerHTML` con el nombre que tiene, y aquí está bien: este HTML
              sale de `renderLessonHtml`, que pasa por `rehype-sanitize` con un esquema
              cerrado. Es EL sitio donde ese saneado se paga. Si alguna vez alguien mete aquí
              HTML de otra procedencia, esta línea deja de ser segura.
            */}
            {/* `contenido` es la misma clase que usa el player del estudiante: si la vista
                previa se pintara distinto, estaría previendo algo que nadie va a ver. */}
            <div
              className="contenido max-w-reading"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </>
        )}
      </Sheet>

      {/* ── Publicar: un diálogo, con la casilla de reapertura y lo que lo impide ── */}
      <Dialog.Root open={confirming} onOpenChange={setConfirming}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content className="bg-surface-base elevation-modal rounded-sheet fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 p-6">
            <Dialog.Title className="type-subheading text-text">{t('publishTitle')}</Dialog.Title>

            {blocked ? (
              <>
                <Dialog.Description className="type-body text-text max-w-reading">
                  {validation === null
                    ? t('validating')
                    : t('blockedErrors', { count: errors.length })}
                </Dialog.Description>
                <div className="flex flex-wrap gap-3">
                  <Dialog.Close asChild>
                    <Button type="button" variant="secondary" onClick={() => setIssuesOpen(true)}>
                      {t('seeIssues')}
                    </Button>
                  </Dialog.Close>
                  <Dialog.Close asChild>
                    <Button type="button" variant="quiet">
                      {t('cancel')}
                    </Button>
                  </Dialog.Close>
                </div>
              </>
            ) : (
              <>
                <Dialog.Description className="type-body text-text max-w-reading">
                  {t('confirmBody', { warnings: warnings.length })}
                </Dialog.Description>
                {/*
                  Publicar no cambia lo que las cohortes ya tienen asignado (eso es
                  `PATCH /api/cohorts/assignments/[id]`); lo que sí abre es que las cohortes
                  abiertas que aún no tienen el tema puedan añadirlo. Se dice aquí, que es
                  donde se decide.
                */}
                {pendingCohorts.length > 0 && (
                  <p className="type-body text-text-muted max-w-reading">
                    {t('confirmPending', {
                      count: pendingCohorts.length,
                      list: pendingCohorts.map((cohort) => cohort.code).join(', '),
                    })}
                  </p>
                )}

                <div className="flex items-start gap-2">
                  <input
                    id="reabre"
                    type="checkbox"
                    checked={reopens}
                    onChange={(event) => {
                      setReopens(event.target.checked);
                      setDirty(true);
                    }}
                    className="border-border text-accent-base focus:ring-accent-base mt-0.5 h-6 w-6 rounded"
                  />
                  <label htmlFor="reabre" className="type-body text-text max-w-reading">
                    {t('reopensLabel')}
                  </label>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="button" loading={publishing} onClick={() => void onPublish()}>
                    {t('confirmPublish')}
                  </Button>
                  <Dialog.Close asChild>
                    <Button type="button" variant="quiet" disabled={publishing}>
                      {t('cancel')}
                    </Button>
                  </Dialog.Close>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/** Los avisos, como lista navegable con enlace a la línea (plan/07:35). */
function IssueList({
  issues,
  errorCount,
  onGo,
}: {
  issues: Issue[];
  errorCount: number;
  onGo: (line: number) => void;
}) {
  const t = useTranslations('editor');
  const ti = useTranslations('issues');

  // Filas con divisor y no cajas con borde: los avisos son una lista de lo mismo dentro de
  // una tarjeta, y una caja por aviso eran tarjetas dentro de la tarjeta.
  return (
    <ul className="divide-border-muted -my-1 divide-y">
      {issues.map((issue, index) => {
        const line = lineOf(issue);
        const isError = index < errorCount;
        const text = issueText(issue, ti);

        return (
          <li key={`${issue.rule ?? 'issue'}-${index}`} className="space-y-1 py-3">
            <p className="type-body-emphasis text-text">
              {/* El tipo va en palabras, no en color. */}
              {isError ? t('error') : t('warning')}
              {line !== null ? ` · ${t('line', { line })}` : ''}
            </p>
            <p className="type-body text-text max-w-reading">{text.message}</p>
            {text.fix && <p className="type-caption text-text-muted max-w-reading">{text.fix}</p>}
            {text.detail && (
              <p className="type-caption text-text-subtle max-w-reading">
                {ti('detail', { detail: text.detail })}
              </p>
            )}
            {line !== null && (
              <Button type="button" variant="quiet" onClick={() => onGo(line)}>
                {t('goToLine', { line })}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Las comprobaciones del panel de preparación. Lo que la base sabe viene en `readiness`; lo
 * que cambia mientras se escribe (texto, minutos, avisos, vídeos) se lee del estado.
 */
function readinessChecks({
  t,
  readiness,
  content,
  minutes,
  validation,
  media,
  activity,
  publishedNumber,
}: {
  t: ReturnType<typeof useTranslations<'editor'>>;
  readiness: LessonReadiness | null;
  content: string;
  minutes: string;
  validation: Validation | null;
  media: Array<{ missingCaptions: boolean }> | null;
  activity: { instructions: string | null; accepts: ActivityAccepts; prompts: string[] } | null;
  publishedNumber: number | null;
}): ReadinessCheck[] {
  if (readiness === null) return [];

  const builder = `/contenido/programas/${readiness.program.id}` as const;
  const checks: ReadinessCheck[] = [];

  checks.push({
    key: 'route',
    state: 'info',
    label: t('readiness.route'),
    detail: `${t('readiness.routeDetail', {
      program: readiness.program.name,
      position: readiness.module.position,
      module: readiness.module.name,
    })} · ${
      readiness.previousTitle === null
        ? t('readiness.routeFirst')
        : t('readiness.routeAfter', { title: readiness.previousTitle })
    }`,
    href: builder,
    linkLabel: t('readiness.routeLink'),
  });

  const empty = content.trim() === '';
  const errors = validation?.errors.length ?? 0;
  const warnings = validation?.warnings.length ?? 0;
  checks.push({
    key: 'content',
    state: empty ? 'todo' : validation === null ? 'todo' : errors > 0 ? 'warn' : 'ok',
    label: t('readiness.content'),
    detail: empty
      ? t('readiness.contentEmpty')
      : validation === null
        ? t('readiness.contentChecking')
        : errors > 0
          ? t('readiness.contentErrors', { count: errors })
          : t('readiness.contentOk', { warnings }),
  });

  const videos = media?.length ?? 0;
  const missing = media?.filter((item) => item.missingCaptions).length ?? 0;
  checks.push({
    key: 'videos',
    state: media === null ? 'todo' : videos === 0 ? 'info' : missing > 0 ? 'warn' : 'ok',
    label: t('readiness.videos'),
    detail:
      media === null
        ? t('readiness.videosLoading')
        : videos === 0
          ? t('readiness.videosNone')
          : missing > 0
            ? t('readiness.videosMissing', { missing, count: videos })
            : t('readiness.videosOk', { count: videos }),
  });

  const parsedMinutes = minutes.trim() === '' ? null : Number(minutes);
  const hasMinutes = parsedMinutes !== null && Number.isFinite(parsedMinutes) && parsedMinutes > 0;
  checks.push({
    key: 'minutes',
    state: hasMinutes ? 'ok' : 'warn',
    label: t('readiness.minutes'),
    detail: hasMinutes
      ? t('readiness.minutesOk', { minutes: parsedMinutes })
      : t('readiness.minutesMissing'),
  });

  // Solo en un tema con actividad: en los demás no hay nada que preparar ahí.
  if (activity !== null) {
    const hasInstructions = (activity.instructions ?? '').trim() !== '';
    checks.push({
      key: 'activity',
      state: hasInstructions ? 'ok' : 'warn',
      label: t('readiness.activity'),
      detail: hasInstructions
        ? t('readiness.activityOk', { accepts: activity.accepts })
        : t('readiness.activityMissing'),
    });
  }

  const exams = readiness.exams;
  const onlyExam = exams.length === 1 ? exams[0] : undefined;
  const examsPublished = exams.filter((exam) => exam.hasPublished).length;
  checks.push({
    key: 'exam',
    state: exams.length === 0 ? 'todo' : examsPublished < exams.length ? 'warn' : 'ok',
    label: t('readiness.exam'),
    detail:
      exams.length === 0
        ? t('readiness.examNone')
        : onlyExam
          ? t('readiness.examOne', {
              title: onlyExam.title,
              status: onlyExam.hasPublished ? 'published' : 'draft',
            })
          : t('readiness.examMany', { count: exams.length, published: examsPublished }),
    ...(exams.length === 0 ? { href: builder, linkLabel: t('readiness.examLink') } : {}),
  });

  const { assigned, pending } = readiness.cohorts;
  const cohortsDetail =
    assigned === 0 && pending.length === 0
      ? t('readiness.cohortsNone')
      : [
          assigned > 0 ? t('readiness.cohortsAssigned', { count: assigned }) : null,
          pending.length > 0 ? t('readiness.cohortsPending', { count: pending.length }) : null,
        ]
          .filter((part) => part !== null)
          .join(' · ');
  checks.push({
    key: 'publish',
    state: publishedNumber === null ? 'todo' : 'ok',
    label: t('readiness.publish'),
    detail: `${
      publishedNumber === null
        ? t('readiness.publishNone')
        : t('readiness.publishOk', { number: publishedNumber })
    } · ${cohortsDetail}`,
  });

  return checks;
}
