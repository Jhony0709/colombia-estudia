/**
 * SUPABASE_SECRET_KEY never reaches the client (reference/08-env-vars.md:16).
 *
 * `lib/auth/supabase-server.ts` imports 'server-only', so Next fails the build if a client
 * component pulls it in. This test fails earlier and with a clearer message: no file
 * marked 'use client' under app/ or components/ may import the server auth module (or the
 * `lib/auth` barrel, which re-exports it), and SUPABASE_SECRET_KEY is only read by the known
 * server modules.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const SCANNED_DIRS = ['app', 'components', 'features', 'lib'];
const SERVER_AUTH_IMPORT =
  /from\s+['"](@\/lib\/auth(\/supabase-server)?|\.{1,2}\/(.*\/)?auth(\/supabase-server)?)['"]/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = SCANNED_DIRS.flatMap((d) => walk(join(ROOT, d)));

describe('server-only auth boundary', () => {
  it('scans real files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no 'use client' file imports the server auth module", () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      const isClient = /^\s*['"]use client['"]/m.test(source.slice(0, 500));
      return isClient && SERVER_AUTH_IMPORT.test(source);
    });
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('SUPABASE_SECRET_KEY is read only under lib/, never in a client file', () => {
    const readers = files.filter((file) =>
      readFileSync(file, 'utf8').includes('SUPABASE_SECRET_KEY')
    );
    // Known readers: the admin client and the Storage health check (both server-only by
    // construction: route handlers). Any new reader must be reviewed.
    expect(readers.map((f) => relative(ROOT, f)).sort()).toEqual([
      'lib/auth/supabase-server.ts',
      'lib/media/storage.ts',
    ]);
    for (const file of readers) {
      expect(/^\s*['"]use client['"]/m.test(readFileSync(file, 'utf8').slice(0, 500))).toBe(false);
    }
  });

  it('RESEND_API_KEY is read only under lib/mail/, never in a client file', () => {
    const readers = files.filter((file) => readFileSync(file, 'utf8').includes('RESEND_API_KEY'));
    // Known reader: mail module factory (server-only by construction).
    expect(readers.map((f) => relative(ROOT, f)).sort()).toEqual(['lib/mail/index.ts']);
    for (const file of readers) {
      expect(/^\s*['"]use client['"]/m.test(readFileSync(file, 'utf8').slice(0, 500))).toBe(false);
    }
  });
});
