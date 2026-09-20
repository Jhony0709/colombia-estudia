/**
 * Shared input helpers for the admin endpoints.
 *
 * Optional text travels as a string, empty when unset: apiHandler's `ZodSchema<T>` requires
 * the schema's input and output types to match, so no `preprocess`/`transform` here. The
 * blank-to-null step is explicit and happens in the handler.
 */

import { z } from 'zod';
import { APIError } from '@/lib/core/errors';

export const optionalText = (max: number) => z.union([z.literal(''), z.string().trim().max(max)]);

/** An empty field means "no value", not an empty string, in the database. */
export const blankToNull = (value: string): string | null =>
  value.trim() === '' ? null : value.trim();

/** Reads a single route param, rejecting the array form Next allows. */
export async function routeParam(
  params: Promise<Record<string, string | string[] | undefined>>,
  name: string
): Promise<string> {
  const value = (await params)[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new APIError(`Missing route param: ${name}`, 'VALIDATION_ERROR');
  }
  return value;
}

/** apiHandler fills this in when `capability` is set; this keeps the types honest. */
export function requireInstitutionId(institutionId: string | undefined): string {
  if (!institutionId) {
    throw new APIError('Missing institution context', 'INTERNAL');
  }
  return institutionId;
}
