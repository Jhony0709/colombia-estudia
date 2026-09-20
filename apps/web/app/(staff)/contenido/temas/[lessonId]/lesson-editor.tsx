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
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/atoms/alert';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { PageHeader } from '@/components/templates/page';
import { PageHelp } from '@/components/organisms/page-help';
import { Sheet } from '@/components/organisms/sheet';
import { issueText } from '@/lib/content/issue-text';
import { LessonDetailsForm, type ModuleChoice, type SubjectChoice } from './lesson-details-form';
import { lessonHelpTopics } from './lesson-help';
import { MediaSettingsDialog, useLessonMedia } from './lesson-media';
import { BlockEditor, type BlockEditorHandle } from '@/features/content/editor/BlockEditor';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

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
  details,
}: LessonWorkspaceProps) {
  const t = useTranslations('editor');
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
  const [error, setError] = useState<string | null>(null);
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
      setError(payload?.error?.message ?? t('saveError'));
      return false;
    }

    setSavedAt(new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' }));
    setDirty(false);
    setError(null);
    return true;
  }, [content, minutes, reopens, t, versionId]);

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
    setError(null);
    try {
      if (dirty && !(await save())) return;

      const res = await fetch(`/api/content/lessons/${versionId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      const payload = await res.json();

      if (!res.ok) {
        setError(payload?.error?.message ?? t('previewError'));
        return;
      }

      setPreview((payload.data ?? payload) as { html: string; missingAssets: string[] });
    } catch {
      setError(t('previewError'));
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
    setError(null);
    try {
      if (dirty && !(await save())) return;

      const res = await fetch(`/api/content/lessons/${versionId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      const payload = await res.json();

      if (!res.ok) {
        setError(payload?.error?.message ?? t('publishError'));
        void validate();
        return;
      }

      setPublished(payload.number as number);
      setConfirming(false);
    } catch {
      setError(t('publishError'));
    } finally {
      setPublishing(false);
    }
  };

  const errors = validation?.errors ?? [];
  const warnings = validation?.warnings ?? [];
  const blocked = !validation || errors.length > 0 || !canPublish;
  const hasIssues = errors.length + warnings.length > 0;

  const saveStatus = dirty
    ? t('unsaved')
    : savedAt
      ? t('savedAt', { time: savedAt })
      : t('noChanges');

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
      </div>

      <LessonDetailsForm
        lessonId={lessonId}
        modules={details.modules}
        subjects={details.subjects}
        hasPublished={header.hasPublished}
        initial={details.initial}
      />

      {error !== null && <Alert severity="error">{error}</Alert>}
      {published !== null && (
        <Alert severity="success">{t('publishedOk', { number: published })}</Alert>
      )}

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

      {/* Los avisos solo cuando los hay. «El contenido cumple las reglas» no merece una
          tarjeta: se dice en el diálogo de publicar, que es donde importa. */}
      {hasIssues && (
        <div id="editor-avisos">
          <Card as="h2" title={t('issuesTitle')}>
            <IssueList
              issues={[...errors, ...warnings]}
              errorCount={errors.length}
              onGo={goToLine}
            />
          </Card>
        </div>
      )}

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
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        document.getElementById('editor-avisos')?.scrollIntoView({ block: 'start' })
                      }
                    >
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
