'use client';

/**
 * El menú del tema (23/9): «Cómo leer» y «Reportar un problema», detrás de un botón en la
 * cabecera. Las dos cosas se usan poco y antes ocupaban sitio entre el título y el texto
 * (las preferencias) y al pie de cada tema (el reporte). Cada una abre su hoja.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Flag, MoreHorizontal, Settings2 } from 'lucide-react';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@/components/molecules/dropdown';
import { Button } from '@/components/atoms/button';
import { ReadingPreferences } from './reading-preferences';
import { ReportProblem } from './report-problem';

export function LessonTools({
  assignmentId,
  /** En la barra del modo tarea (E2): solo el icono, sin borde, del alto de la barra. */
  compact = false,
}: {
  assignmentId: string;
  compact?: boolean;
}) {
  const t = useTranslations('learn.tools');
  const [reading, setReading] = useState(false);
  const [report, setReport] = useState(false);

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <Button type="button" variant={compact ? 'quiet' : 'secondary'} aria-label={t('label')}>
            <MoreHorizontal aria-hidden className="size-4" />
            {!compact && <span className="hidden sm:inline">{t('label')}</span>}
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label={t('label')} align="end">
          <DropdownItem
            itemKey="reading"
            startContent={<Settings2 aria-hidden className="size-4" />}
            onSelect={() => setReading(true)}
          >
            {t('reading')}
          </DropdownItem>
          <DropdownItem
            itemKey="report"
            startContent={<Flag aria-hidden className="size-4" />}
            onSelect={() => setReport(true)}
          >
            {t('report')}
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
      <ReadingPreferences open={reading} onOpenChange={setReading} />
      <ReportProblem assignmentId={assignmentId} open={report} onOpenChange={setReport} />
    </>
  );
}
