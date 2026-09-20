'use client';

/**
 * La carga CSV, en los tres pasos del plan.
 * SSOT: plan/06-cohortes-y-personas.md:38-56.
 *
 * Los tres pasos están siempre a la vista, no en un asistente que oculta los anteriores:
 * quien importa trabaja con la hoja de cálculo al lado (plan:78-82) y necesita volver al
 * paso 1 sin perder lo que ya validó. Lo que cambia es cuál está habilitado.
 *
 * El archivo se lee en el navegador y viaja como texto: el servidor corre la misma
 * validación en el ensayo y en la confirmación, así que "55 se importarán" no puede
 * convertirse en 54 al confirmar.
 */

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { DataTable } from '@/components/molecules/data-table';
import { PageSection } from '@/components/templates/page';

interface RowIssue {
  column: string | null;
  message: string;
  fix: string;
}

interface CheckedRow {
  line: number;
  values: Record<string, string>;
  issues: RowIssue[];
  notes: string[];
}

interface Summary {
  total: number;
  importable: number;
  withErrors: number;
  toCreate: number;
  toReuse: number;
}

interface DryRunResult {
  summary: Summary;
  rows: CheckedRow[];
}

type IssueRow = { key: string; line: number; column: string; message: string; fix: string };

export function ImportWizard({ cohortId }: { cohortId: string }) {
  const t = useTranslations('import');
  const router = useRouter();
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [busy, setBusy] = useState<'dry-run' | 'commit' | 'errors-csv' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<Summary | null>(null);

  const post = async (mode: 'dry-run' | 'commit' | 'errors-csv') => {
    if (csv === null) return null;
    return fetch(`/api/cohorts/${cohortId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, mode }),
    });
  };

  // Elegir otro archivo invalida lo validado: si no, se podría confirmar el ensayo de un
  // archivo mientras en pantalla se lee el nombre de otro.
  const onPickFile = async (file: File | undefined) => {
    setError(null);
    setResult(null);
    setImported(null);
    if (!file) {
      setFileName(null);
      setCsv(null);
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
  };

  const onValidate = async () => {
    setBusy('dry-run');
    setError(null);
    setImported(null);
    try {
      const res = await post('dry-run');
      const payload = await res?.json();
      if (!res?.ok) {
        setError(payload?.error?.message ?? t('genericError'));
        setResult(null);
        return;
      }
      setResult(payload as DryRunResult);
    } catch {
      setError(t('genericError'));
    } finally {
      setBusy(null);
    }
  };

  const onDownloadErrors = async () => {
    setBusy('errors-csv');
    try {
      const res = await post('errors-csv');
      if (!res?.ok) {
        setError(t('genericError'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'errores-importacion.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('genericError'));
    } finally {
      setBusy(null);
    }
  };

  const onCommit = async () => {
    setBusy('commit');
    setError(null);
    try {
      const res = await post('commit');
      const payload = await res?.json();
      if (!res?.ok) {
        setError(payload?.error?.message ?? t('genericError'));
        return;
      }
      setImported(payload.summary as Summary);
      setResult(null);
      setCsv(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch {
      setError(t('genericError'));
    } finally {
      setBusy(null);
    }
  };

  const clean = result !== null && result.summary.withErrors === 0;

  const issueRows: IssueRow[] =
    result?.rows.flatMap((row) =>
      row.issues.map((issue, index) => ({
        key: `${row.line}-${index}`,
        line: row.line,
        column: issue.column ?? t('wholeRow'),
        message: issue.message,
        fix: issue.fix,
      }))
    ) ?? [];

  return (
    <div className="space-y-10">
      {/* Paso 1 */}
      <PageSection id="paso-plantilla" title={t('step1Title')} card>
        <p className="type-body text-text-muted max-w-reading">{t('step1Body')}</p>
        <p>
          {/*
            `next/link` no: esto no navega a una página, descarga un fichero de una route
            handler. Un Link haría navegación de cliente y la descarga no ocurriría.
            La regla de Next lo confunde con una página porque el href es literal.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <Button asChild variant="secondary">
            <a href="/api/cohorts/import/template" download>
              {t('downloadTemplate')}
            </a>
          </Button>
        </p>
      </PageSection>

      {/* Paso 2 */}
      <PageSection id="paso-validar" title={t('step2Title')} card>
        <p className="type-body text-text-muted max-w-reading">{t('step2Body')}</p>

        {/*
          El `<input type="file">` nativo se pinta como el navegador quiere («Choisir un
          fichier», en el idioma del sistema) y no como el resto de controles. El campo sigue
          ahí y sigue siendo el que recibe el foco —el `sr-only` no lo saca del tabulador—;
          la etiqueta, vestida de botón secundario, es lo que se ve y lo que se pulsa.
        */}
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={fileInputId}
            className="bg-surface-base text-text border-border rounded-control min-h-touch type-label hover:bg-surface-sunken has-[:focus-visible]:outline-3 inline-flex cursor-pointer items-center border px-4 py-2"
          >
            {t('fileLabel')}
          </label>
          <input
            id={fileInputId}
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => void onPickFile(event.target.files?.[0])}
          />
          <span className="type-caption text-text-muted" aria-live="polite">
            {fileName ?? t('noFileChosen')}
          </span>
        </div>

        <Button
          type="button"
          onClick={() => void onValidate()}
          loading={busy === 'dry-run'}
          disabled={csv === null || busy !== null}
        >
          {t('validate')}
        </Button>
      </PageSection>

      {error !== null && <Alert severity="error">{error}</Alert>}

      {imported !== null && (
        <Alert severity="success">
          {t('imported', {
            count: imported.importable,
            created: imported.toCreate,
            reused: imported.toReuse,
          })}
        </Alert>
      )}

      {/* Resultado del ensayo */}
      {result !== null && (
        <PageSection id="paso-resultado" title={t('resultTitle', { file: fileName ?? '' })}>
          <Alert severity={clean ? 'success' : 'warning'}>
            {t('summary', {
              importable: result.summary.importable,
              withErrors: result.summary.withErrors,
              created: result.summary.toCreate,
              reused: result.summary.toReuse,
            })}
          </Alert>

          {issueRows.length > 0 && (
            <>
              <DataTable<IssueRow>
                caption={t('issuesCaption')}
                rowKey={(row) => row.key}
                empty={<p className="type-body text-text-muted">{t('noIssues')}</p>}
                rows={issueRows}
                columns={[
                  { key: 'line', header: t('colLine'), numeric: true, cell: (r) => r.line },
                  { key: 'column', header: t('colColumn'), cell: (r) => r.column },
                  { key: 'message', header: t('colProblem'), cell: (r) => r.message },
                  { key: 'fix', header: t('colFix'), cell: (r) => r.fix },
                ]}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void onDownloadErrors()}
                loading={busy === 'errors-csv'}
                disabled={busy !== null}
              >
                {t('downloadErrors')}
              </Button>
            </>
          )}

          <Notes rows={result.rows} label={t('notesTitle')} />
        </PageSection>
      )}

      {/* Paso 3 */}
      <PageSection id="paso-confirmar" title={t('step3Title')} card>
        <p className="type-body text-text-muted max-w-reading">
          {clean ? t('step3Ready', { count: result.summary.importable }) : t('step3Blocked')}
        </p>
        <Button
          type="button"
          onClick={() => void onCommit()}
          loading={busy === 'commit'}
          disabled={!clean || busy !== null}
        >
          {t('confirm')}
        </Button>
      </PageSection>
    </div>
  );
}

/** Lo que conviene saber y no impide importar: personas que ya existían, nombres distintos. */
function Notes({ rows, label }: { rows: CheckedRow[]; label: string }) {
  const withNotes = rows.filter((row) => row.notes.length > 0);
  if (withNotes.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="type-overline text-text-muted uppercase">{label}</h3>
      <ul className="space-y-1">
        {withNotes.map((row) =>
          row.notes.map((note, index) => (
            <li key={`${row.line}-${index}`} className="type-caption text-text-muted">
              {row.line}: {note}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
