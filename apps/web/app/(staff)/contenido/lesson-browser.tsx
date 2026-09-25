'use client';

/**
 * La lista de temas: buscar, filtrar y ver el programa por dentro.
 * SSOT: plan/11-ux.md:56 («tablas densas con filtros»), revisión de UX del 18/9.
 *
 * Antes era **una sola tabla con todos los temas de la institución**, ordenada por el id del
 * módulo —es decir, por el momento en que se creó cada módulo—. Con dos programas ya se
 * mezclaban; con los 110 temas del programa real, encontrar uno era leer la lista entera.
 *
 * Ahora: un buscador, un filtro por programa y otro por estado, y el resultado agrupado por
 * módulo **en el orden de la ruta**. Es el mismo orden en que un estudiante lo recorre, así
 * que quien escribe y quien estudia ven el programa igual.
 *
 * Los filtros viven en el cliente y no en la URL: son 110 filas, no 11.000, y traerlas todas
 * una vez es más rápido que ir al servidor por cada tecla. Si esto llega a varios miles de
 * temas, el sitio de los filtros es la URL y la consulta.
 *
 * 24/9 (Jhonny: «igual para el resto de páginas con el mismo estilo, como Temas»): los
 * grupos `<details>` apilados pasan a **una tabla de módulos con filas expandibles**
 * (`DataTable.expandable`, el patrón de Programas): una fila por módulo —módulo, programa,
 * temas, publicados— y al abrirla los temas como subtabla. Sin filtro las filas vienen
 * cerradas y hay «Abrir todos»; al buscar o filtrar se abren solas las que tienen
 * coincidencias, que es lo que se vino a ver. El texto de búsqueda se pliega una vez por
 * tema (`index`), no en cada tecla por cada fila.
 */

import type { PublishStatus } from '@colombia-estudia/domain';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { cn } from '@/lib/utils';

export interface BrowsableLesson {
  id: string;
  code: string;
  title: string;
  position: number;
  subjectName: string;
  moduleId: string;
  moduleName: string;
  modulePosition: number;
  programId: string;
  programName: string;
  requiresSubmission: boolean;
  latestStatus: PublishStatus | null;
  latestNumber: number | null;
  hasPublished: boolean;
}

type StatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'NONE';

/** Sin tildes y en minúscula: buscar «metodologia» tiene que encontrar «Metodología». */
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function LessonBrowser({
  lessons,
  programs,
}: {
  lessons: BrowsableLesson[];
  programs: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations('content');

  const [query, setQuery] = useState('');
  const [programId, setProgramId] = useState('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  // Lo que se busca, plegado una vez por tema: título, módulo y asignatura.
  const index = useMemo(
    () =>
      new Map(
        lessons.map((lesson) => [
          lesson.id,
          `${fold(lesson.code)}\n${fold(lesson.title)}\n${fold(lesson.moduleName)}\n${fold(lesson.subjectName)}`,
        ])
      ),
    [lessons]
  );

  const filtered = useMemo(() => {
    const needle = fold(query.trim());

    return lessons.filter((lesson) => {
      if (programId !== 'ALL' && lesson.programId !== programId) return false;

      if (status === 'PUBLISHED' && !lesson.hasPublished) return false;
      if (status === 'DRAFT' && lesson.latestStatus !== 'DRAFT') return false;
      if (status === 'NONE' && lesson.hasPublished) return false;

      return needle === '' || (index.get(lesson.id)?.includes(needle) ?? false);
    });
  }, [lessons, index, programId, status, query]);

  // Los temas ya vienen ordenados (programa, posición del módulo, posición del tema), así que
  // agrupar en ese recorrido conserva el orden sin volver a ordenar nada.
  const groups = useMemo(() => {
    const out: ModuleGroup[] = [];

    for (const lesson of filtered) {
      const last = out[out.length - 1];
      if (last && last.key === lesson.moduleId) {
        last.rows.push(lesson);
        if (lesson.hasPublished) last.published += 1;
        continue;
      }
      out.push({
        key: lesson.moduleId,
        programName: lesson.programName,
        moduleName: lesson.moduleName,
        modulePosition: lesson.modulePosition,
        rows: [lesson],
        published: lesson.hasPublished ? 1 : 0,
      });
    }

    return out;
  }, [filtered]);

  const filtering = query.trim() !== '' || programId !== 'ALL' || status !== 'ALL';
  // Al filtrar, lo que coincide se abre solo; sin filtro, manda lo que abrió la persona.
  const isOpen = (group: ModuleGroup) => filtering || open.has(group.key);
  const allOpen = groups.every(isOpen);

  return (
    <div className="space-y-4">
      {/* Los filtros en su propia tarjeta: son el mando de la lista, no la lista. Sueltos
          sobre el lienzo se leían como una fila más de contenido. */}
      <div className="bg-surface-base border-border-muted rounded-card elevation-resting flex flex-wrap items-end gap-4 border p-5">
        <div className="min-w-[16rem] flex-1">
          <FormField
            label={t('filterSearch')}
            name="buscar"
            hint={t('filterSearchHint')}
            hintPlacement="icon"
          >
            <FormInput
              name="buscar"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </FormField>
        </div>

        {/* Con un solo programa el filtro sobra y estorba. */}
        {programs.length > 1 && (
          <div className="min-w-[14rem]">
            <FormField label={t('filterProgram')} name="filtroPrograma">
              <FormSelect
                name="filtroPrograma"
                value={programId}
                onChange={(event) => setProgramId(event.target.value)}
              >
                <option value="ALL">{t('filterProgramAll')}</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </div>
        )}

        <div className="min-w-[12rem]">
          <FormField label={t('filterStatus')} name="filtroEstado">
            <FormSelect
              name="filtroEstado"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
            >
              <option value="ALL">{t('filterStatusAll')}</option>
              <option value="PUBLISHED">{t('filterStatusPublished')}</option>
              <option value="DRAFT">{t('filterStatusDraft')}</option>
              <option value="NONE">{t('filterStatusUnpublished')}</option>
            </FormSelect>
          </FormField>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/*
          El recuento se anuncia: quien filtra con lector de pantalla necesita saber cuántos
          quedaron sin tener que recorrer la tabla. Sin filtro no se DIBUJA —el título de la
          sección ya da el total—, pero sigue en el DOM con su texto: una región viva tiene
          que existir antes de cambiar, y montarla al filtrar no anuncia nada.
        */}
        <p
          className={cn('type-caption text-text-muted m-0', !filtering && 'sr-only')}
          role="status"
        >
          {t('filterCount', { shown: filtered.length, total: lessons.length })}
        </p>
        {!filtering && groups.length > 1 && (
          <Button
            variant="quiet"
            className="ml-auto"
            onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((group) => group.key)))}
          >
            {allOpen ? t('table.closeAll') : t('table.openAll')}
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        lessons.length === 0 ? (
          <EmptyState title={t('emptyTitle')} description={t('emptyHint')} />
        ) : (
          <EmptyState title={t('noMatchesTitle')} description={t('noMatchesHint')} />
        )
      ) : (
        <DataTable<ModuleGroup>
          align="middle"
          caption={t('table.modulesCaption')}
          rowKey={(group) => group.key}
          rows={groups}
          empty={null}
          expandable={{
            isExpanded: isOpen,
            onToggle: (group) =>
              setOpen((prev) => {
                const next = new Set(prev);
                if (next.has(group.key)) next.delete(group.key);
                else next.add(group.key);
                return next;
              }),
            label: (group, expanded) =>
              t(expanded ? 'table.collapseModule' : 'table.expandModule', {
                module: group.moduleName,
              }),
            content: (group) => <LessonRows group={group} />,
          }}
          columns={[
            {
              key: 'position',
              header: t('colPosition'),
              numeric: true,
              narrow: true,
              cell: (group) => group.modulePosition,
            },
            {
              key: 'module',
              header: t('colModule'),
              cell: (group) => <span className="type-body-emphasis">{group.moduleName}</span>,
            },
            { key: 'program', header: t('table.program'), cell: (group) => group.programName },
            {
              key: 'lessons',
              header: t('table.lessons'),
              numeric: true,
              narrow: true,
              cell: (group) => group.rows.length,
            },
            {
              key: 'published',
              header: t('table.published'),
              numeric: true,
              narrow: true,
              cell: (group) => group.published,
            },
          ]}
        />
      )}
    </div>
  );
}

interface ModuleGroup {
  key: string;
  programName: string;
  moduleName: string;
  modulePosition: number;
  rows: BrowsableLesson[];
  published: number;
}

/** Los temas de un módulo, dentro de su fila. */
function LessonRows({ group }: { group: ModuleGroup }) {
  const t = useTranslations('content');
  return (
    <DataTable<BrowsableLesson>
      plain
      compactRows
      align="middle"
      caption={t('groupCaption', { module: group.moduleName })}
      rowKey={(lesson) => lesson.id}
      rows={group.rows}
      empty={null}
      columns={[
        {
          key: 'position',
          header: t('colPosition'),
          numeric: true,
          narrow: true,
          cell: (lesson) => lesson.position,
        },
        {
          key: 'code',
          header: t('colCode'),
          narrow: true,
          cell: (lesson) => <span className="font-mono">{lesson.code}</span>,
        },
        {
          key: 'title',
          header: t('colTitle'),
          cell: (lesson) => (
            <Link
              href={`/contenido/temas/${lesson.code}`}
              className="text-text-link underline underline-offset-4"
            >
              {lesson.title}
            </Link>
          ),
        },
        { key: 'subject', header: t('colSubject'), cell: (l) => l.subjectName },
        {
          key: 'status',
          header: t('colStatus'),
          /*
            El estado sigue siendo la PALABRA: el color nunca carga solo el significado
            (DESIGN.md §Color semántico). La píldora es forma y fondo alrededor del mismo
            texto, para que publicado y borrador se distingan de un vistazo.
          */
          cell: (lesson) =>
            lesson.latestStatus === null ? (
              <Badge variant="neutral">{t('statusNone')}</Badge>
            ) : (
              <Badge variant={lesson.hasPublished ? 'success' : 'neutral'}>
                {t(
                  `status.${lesson.hasPublished && lesson.latestStatus === 'DRAFT' ? 'DRAFT_OVER_PUBLISHED' : lesson.latestStatus}`,
                  { number: lesson.latestNumber ?? 0 }
                )}
              </Badge>
            ),
        },
        {
          key: 'flags',
          header: t('colFlags'),
          cell: (lesson) => (lesson.requiresSubmission ? t('flagSubmission') : '—'),
        },
      ]}
    />
  );
}
