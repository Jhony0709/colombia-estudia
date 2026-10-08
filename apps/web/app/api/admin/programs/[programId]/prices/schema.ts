/** Los campos de un precio, para crearlo y para corregirlo (8/10). */

import { z } from 'zod';

export const priceFields = z.object({
  gradeFrom: z.number().int().min(0).max(13).nullable(),
  gradeTo: z.number().int().min(0).max(13).nullable(),
  amount: z.number().int().positive().max(1_000_000_000),
  period: z.enum(['ONE_TIME', 'MONTHLY', 'PER_MODULE']),
  validFrom: z.string().date(),
  validTo: z.string().date().nullable(),
});
