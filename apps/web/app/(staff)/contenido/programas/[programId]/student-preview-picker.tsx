'use client';

/**
 * «Ver como estudiante» en el constructor del programa (31/10): la ruta sale de una cohorte,
 * así que se elige cuál. Solo administración; sin cohortes con contenido no se pinta.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@/components/molecules/dropdown';
import { useToast } from '@/components/organisms/toaster';
import { openStudentPreview } from '@/lib/preview/student-preview';

export function StudentPreviewPicker({
  cohorts,
}: {
  cohorts: Array<{ id: string; code: string; name: string }>;
}) {
  const t = useTranslations('builder');
  const router = useRouter();
  const { toast } = useToast();

  const open = async (cohortId: string) => {
    const result = await openStudentPreview(cohortId, t('previewError'));
    if ('href' in result) router.push(result.href);
    else toast({ severity: 'error', title: result.error, key: 'program-preview' });
  };

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button type="button" variant="secondary">
          <Eye aria-hidden className="size-4" />
          {t('previewAsStudent')}
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label={t('previewPickCohort')} align="end">
        {cohorts.map((cohort) => (
          <DropdownItem key={cohort.id} itemKey={cohort.id} onSelect={() => void open(cohort.id)}>
            {`${cohort.code} — ${cohort.name}`}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
