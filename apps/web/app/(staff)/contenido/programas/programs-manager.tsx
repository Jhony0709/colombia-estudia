'use client';

/**
 * Los programas y sus módulos.
 * SSOT: plan/06-cohortes-y-personas.md:19-22 (§2).
 *
 * Vivía dentro de `/admin/institucion` junto a las asignaturas, en un componente de 547
 * líneas que no estaba en la navegación: los avisos de otras pantallas decían «se crean en
 * Institución», que es una instrucción, no un enlace.
 *
 * El orden de los módulos es por botones «subir/bajar». `reference/03-ui/accesibilidad.md:55`
 * (WCAG 2.5.7) exige una alternativa de teclado a cualquier arrastre; los botones SON esa
 * alternativa, así que son la base y el arrastre se apoya luego en el mismo endpoint.
 *
 * Nada se borra: solo se archiva, y cada acción que parece destructiva pide confirmación en
 * línea (un segundo botón) en vez de un diálogo nativo — anunciable, operable con teclado y
 * comprobable sin manejadores de diálogo.
 *
 * 24/9 (Jhonny: «no me gusta el layout de Programas… tabla y rows expandibles como en
 * Basikon»): una tabla con una fila por programa (código, nombre, módulos, temas, días de
 * acceso, acciones) y, al abrir la fila, los módulos como subtabla y el alta de módulo.
 * Antes era una pila de tarjetas con todo abierto a la vez —cuatro formularios de «nuevo
 * módulo» en pantalla sin que nadie los pidiera—. El patrón es `DataTable.expandable`.
 */

import Link from 'next/link';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Tooltip } from '@/components/atoms/tooltip';
import { DataTable } from '@/components/molecules/data-table';
import { Menu, MenuItem, MenuSeparator } from '@/components/molecules/menu';
import type {
  CurriculumModule,
  CurriculumProgram,
} from '@/features/admin/server/curriculum.service';
import { CurriculumFeedback, useCurriculumSend, type Send } from '../curriculum-send';

export function ProgramsManager({ programs }: { programs: CurriculumProgram[] }) {
  const t = useTranslations('admin.curriculum');
  const { busy, feedback, send } = useCurriculumSend();
  // Con un solo programa no hay nada que elegir: abierto. Con varios, cerrados y se abre el
  // que se mira; «Editar» abre la fila si hacía falta.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(programs.length === 1 ? [programs[0]!.id] : [])
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expand = (id: string) => setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  const lessonsOf = (program: CurriculumProgram) =>
    program.modules.reduce((n, m) => n + m.lessonCount, 0);

  return (
    <div className="space-y-6">
      <CurriculumFeedback feedback={feedback} />

      <DataTable
        align="middle"
        caption={t('table.caption')}
        rows={programs}
        rowKey={(program) => program.id}
        empty={<p className="type-body text-text-muted">{t('programsEmpty')}</p>}
        expandable={{
          isExpanded: (program) => open.has(program.id),
          onToggle: (program) => toggle(program.id),
          label: (program, expanded) =>
            t(expanded ? 'table.collapse' : 'table.expand', { name: program.code }),
          content: (program) => (
            <ProgramDetail
              program={program}
              busy={busy}
              send={send}
              editing={editing === program.id}
              onEditingDone={() => setEditing(null)}
            />
          ),
        }}
        columns={[
          {
            key: 'code',
            header: t('table.code'),
            narrow: true,
            cell: (program) => (
              <Link
                href={`/contenido/programas/${program.id}`}
                className="text-text-link type-body-emphasis underline underline-offset-4"
              >
                {program.code}
              </Link>
            ),
          },
          {
            key: 'name',
            header: t('table.program'),
            cell: (program) => (
              <div className="min-w-0">
                <p className="type-body text-text m-0">{program.name}</p>
                {program.description && (
                  <p className="type-caption text-text-muted m-0">{program.description}</p>
                )}
              </div>
            ),
          },
          {
            key: 'modules',
            header: t('table.modules'),
            numeric: true,
            narrow: true,
            cell: (program) => program.modules.length,
          },
          {
            key: 'lessons',
            header: t('table.lessons'),
            numeric: true,
            narrow: true,
            cell: (program) => lessonsOf(program),
          },
          {
            key: 'access',
            header: t('table.access'),
            numeric: true,
            narrow: true,
            cell: (program) => t('table.accessDays', { count: program.defaultAccessDays }),
          },
          {
            key: 'actions',
            header: t('table.actions'),
            narrow: true,
            cell: (program) => (
              // §7: la acción frecuente a la vista; editar y archivar bajo «⋯», y archivar
              // confirma en línea al elegirlo. Sin envolver: la celda es estrecha.
              <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                {confirmArchive === program.id ? (
                  <>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await send(
                          `/api/admin/programs/${program.id}`,
                          'PATCH',
                          { op: 'archive' },
                          t('programArchived')
                        );
                        if (ok) setConfirmArchive(null);
                      }}
                    >
                      {t('confirmArchive')}
                      <span className="sr-only"> {program.code}</span>
                    </Button>
                    <Button variant="quiet" disabled={busy} onClick={() => setConfirmArchive(null)}>
                      {t('cancel')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="secondary">
                      <Link href={`/contenido/programas/${program.id}`}>
                        {t('openBuilder')}
                        <span className="sr-only"> {program.code}</span>
                      </Link>
                    </Button>
                    <Menu label={t('table.menuFor', { name: program.code })}>
                      <MenuItem
                        onSelect={() => {
                          if (editing === program.id) {
                            setEditing(null);
                          } else {
                            setEditing(program.id);
                            expand(program.id);
                          }
                        }}
                      >
                        {editing === program.id ? t('cancel') : t('edit')}
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem destructive onSelect={() => setConfirmArchive(program.id)}>
                        {t('archive')}
                      </MenuItem>
                    </Menu>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

/** Lo que cuelga de la fila: el formulario si se está editando, y los módulos. */
function ProgramDetail({
  program,
  busy,
  send,
  editing,
  onEditingDone,
}: {
  program: CurriculumProgram;
  busy: boolean;
  send: Send;
  editing: boolean;
  onEditingDone: () => void;
}) {
  const t = useTranslations('admin.curriculum');
  return (
    <div className="space-y-5">
      {editing && (
        <div className="bg-surface-base border-border-muted rounded-card border p-4">
          <ProgramForm
            initial={program}
            submitLabel={t('save')}
            busy={busy}
            onSubmit={async (values) => {
              const ok = await send(
                `/api/admin/programs/${program.id}`,
                'PATCH',
                { op: 'update', ...values },
                t('programSaved')
              );
              if (ok) onEditingDone();
            }}
          />
        </div>
      )}
      <ModuleList program={program} busy={busy} send={send} />
    </div>
  );
}

interface ProgramValues {
  code: string;
  name: string;
  description: string;
  defaultAccessDays: number;
}

export function ProgramForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial?: CurriculumProgram;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: ProgramValues) => Promise<void>;
}) {
  const t = useTranslations('admin.curriculum');
  const [values, setValues] = useState<ProgramValues>({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    defaultAccessDays: initial?.defaultAccessDays ?? 300,
  });

  return (
    <form
      className="max-w-reading space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(values);
      }}
    >
      {/*
        El nombre va primero. Estaba en tercer lugar, detrás del código y de los días de
        acceso: se entra a este formulario a crear «Bachillerato nocturno», no a decidir unas
        siglas, y el primer campo es el que dice de qué va la pantalla.
      */}
      <FormField label={t('programName')} name="name" required>
        <FormInput
          name="name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        />
      </FormField>
      {/* El código son unos caracteres y los días un número: a ancho completo, el ojo
          recorre media pantalla entre la etiqueta y lo que hay escrito. La columna de los
          días es más ancha que la del código porque debajo lleva su explicación, y en 10rem
          esa frase caía en cuatro líneas que empujaban la fila entera. */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-40">
          <FormField label={t('programCode')} name="code" required>
            <FormInput
              name="code"
              value={values.code}
              onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
              spellCheck={false}
            />
          </FormField>
        </div>
        <div className="w-64">
          <FormField
            label={t('defaultAccessDays')}
            name="defaultAccessDays"
            required
            hint={t('defaultAccessDaysHint')}
          >
            <FormInput
              name="defaultAccessDays"
              type="number"
              inputMode="numeric"
              min={1}
              max={3650}
              value={String(values.defaultAccessDays)}
              onChange={(e) =>
                setValues((v) => ({ ...v, defaultAccessDays: Number(e.target.value) || 0 }))
              }
            />
          </FormField>
        </div>
      </div>
      <FormField label={t('programDescription')} name="description">
        <FormInput
          name="description"
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
        />
      </FormField>
      <Button type="submit" loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}

// ─────────────────────────── Modules ───────────────────────────

function ModuleList({
  program,
  busy,
  send,
}: {
  program: CurriculumProgram;
  busy: boolean;
  send: Send;
}) {
  const t = useTranslations('admin.curriculum');
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const listId = useId();
  const last = program.modules.length - 1;

  const move = (module: CurriculumModule, direction: 'up' | 'down') =>
    send(`/api/admin/modules/${module.id}`, 'PATCH', { op: 'move', direction }, t('moduleMoved'));

  return (
    <div className="space-y-3">
      <h4 id={listId} className="type-overline text-text-muted m-0 uppercase">
        {t('modules')}
      </h4>

      <DataTable
        plain
        compactRows
        align="middle"
        caption={t('table.modulesCaption', { name: program.name })}
        rows={program.modules}
        rowKey={(module) => module.id}
        empty={<p className="type-caption text-text-muted m-0">{t('modulesEmpty')}</p>}
        columns={[
          {
            key: 'position',
            header: t('table.order'),
            numeric: true,
            narrow: true,
            cell: (module) => module.position,
          },
          { key: 'name', header: t('table.module'), cell: (module) => module.name },
          {
            key: 'lessons',
            header: t('table.lessons'),
            numeric: true,
            narrow: true,
            cell: (module) => t('lessonCount', { count: module.lessonCount }),
          },
          {
            key: 'actions',
            header: t('table.actions'),
            narrow: true,
            cell: (module) => {
              const index = program.modules.indexOf(module);
              return (
                <div className="flex items-center justify-end gap-1">
                  {/*
                    La flecha es decorativa y el nombre del módulo va en un `sr-only`: el
                    nombre accesible sigue diciendo de qué módulo se habla (WCAG 2.4.6).
                  */}
                  <Tooltip label={t('moveUp')}>
                    <Button
                      variant="quiet"
                      disabled={busy || index === 0}
                      onClick={() => move(module, 'up')}
                    >
                      <span aria-hidden="true">↑</span>
                      <span className="sr-only">{t('moveUpNamed', { name: module.name })}</span>
                    </Button>
                  </Tooltip>
                  <Tooltip label={t('moveDown')}>
                    <Button
                      variant="quiet"
                      disabled={busy || index === last}
                      onClick={() => move(module, 'down')}
                    >
                      <span aria-hidden="true">↓</span>
                      <span className="sr-only">{t('moveDownNamed', { name: module.name })}</span>
                    </Button>
                  </Tooltip>
                  {confirming === module.id ? (
                    <>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={async () => {
                          const ok = await send(
                            `/api/admin/modules/${module.id}`,
                            'PATCH',
                            { op: 'archive' },
                            t('moduleArchived')
                          );
                          if (ok) setConfirming(null);
                        }}
                      >
                        {t('confirmArchive')}
                        <span className="sr-only"> {module.name}</span>
                      </Button>
                      <Button variant="quiet" onClick={() => setConfirming(null)} disabled={busy}>
                        {t('cancel')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="quiet"
                      disabled={busy}
                      onClick={() => setConfirming(module.id)}
                    >
                      {t('archive')}
                      <span className="sr-only"> {module.name}</span>
                    </Button>
                  )}
                </div>
              );
            },
          },
        ]}
      />

      <form
        className="max-w-reading flex flex-wrap items-end gap-2"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await send(
            '/api/admin/modules',
            'POST',
            { programId: program.id, name },
            t('moduleCreated')
          );
          if (ok) setName('');
        }}
      >
        <div className="flex-1">
          <FormField label={t('newModule')} name={`module-${program.id}`}>
            <FormInput
              name={`module-${program.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
        </div>
        <Button type="submit" variant="secondary" loading={busy} disabled={name.trim() === ''}>
          {t('add')}
        </Button>
      </form>
    </div>
  );
}
