/**
 * Next.js instrumentation hook.
 * Runs once when the server starts.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initSentry } = await import('./lib/observability/sentry');
    initSentry();
  }
}
