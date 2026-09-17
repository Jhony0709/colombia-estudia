/**
 * Request ID propagation.
 * Reads x-request-id from incoming request or generates a new one.
 */

import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';

export function getRequestId(req: NextRequest): string {
  return req.headers.get('x-request-id') ?? randomUUID();
}
