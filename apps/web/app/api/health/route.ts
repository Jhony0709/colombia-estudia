/**
 * Health check endpoint.
 * GET /api/health
 *
 * Checks DB and Storage connectivity.
 * Returns 200 if all OK, 503 if any fail.
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/http/api-handler';
import { checkDatabase } from '@/lib/db/health';
import { checkStorageBucket } from '@/lib/media/storage';

export const GET = apiHandler({})(async () => {
  const [db, storage] = await Promise.all([checkDatabase(), checkStorageBucket()]);

  const allOk = db === 'ok' && storage === 'ok';

  return NextResponse.json({ data: { db, storage } }, { status: allOk ? 200 : 503 });
});
