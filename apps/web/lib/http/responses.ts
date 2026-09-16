/**
 * Standardized API responses.
 * SSOT: reference/02-api/endpoints.md:17
 *
 * Success: { data: T }
 * Error: { error: { code, message, details? } }
 */

import { NextResponse } from 'next/server';
import type { APIErrorCode } from '../core/errors';

export type SuccessResponse<T> = { data: T };
export type ErrorResponse = {
  error: { code: APIErrorCode; message: string; details?: unknown };
};

export function success<T>(data: T, status = 200): NextResponse<SuccessResponse<T>> {
  return NextResponse.json({ data }, { status });
}

export function error(
  code: APIErrorCode,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ErrorResponse> {
  return NextResponse.json({ error: { code, message, details } }, { status });
}
