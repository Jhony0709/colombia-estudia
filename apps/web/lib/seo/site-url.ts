/** Origen público sin barra final; en producción, la raíz sin `www` (D2, 11/10). */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : 'http://localhost:3030';
}
