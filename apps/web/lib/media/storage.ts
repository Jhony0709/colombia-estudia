/**
 * Supabase Storage utilities.
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Check if the media bucket is accessible.
 */
export async function checkStorageBucket(): Promise<'ok' | 'fail'> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !secretKey) {
      return 'fail';
    }

    const supabase = createClient(supabaseUrl, secretKey);
    const { error } = await supabase.storage.from('media').list('', { limit: 1 });

    return error ? 'fail' : 'ok';
  } catch {
    return 'fail';
  }
}
