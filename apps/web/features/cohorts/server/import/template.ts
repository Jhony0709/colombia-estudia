/**
 * The downloadable template.
 * SSOT: plan/06-cohortes-y-personas.md:40-44.
 *
 * The plan asks for "un README en la primera hoja". A README sheet needs a workbook, and what
 * gets uploaded back is a CSV, so the instructions live on the import screen instead, next to
 * the download link, where they are also readable by a screen reader.
 */

import { toCsv } from '@/lib/csv/serialize';
import { IMPORT_COLUMNS, EXAMPLE_ROW } from './columns';

export function buildTemplateCsv(): string {
  return toCsv([...IMPORT_COLUMNS], [IMPORT_COLUMNS.map((column) => EXAMPLE_ROW[column])]);
}
