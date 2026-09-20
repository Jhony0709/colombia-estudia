/**
 * Límite de peticiones por origen, en memoria. Para la verificación pública de constancias
 * (endpoints.md:49 «rate-limited») y, cuando toque, otros endpoints sin sesión.
 *
 * Es **por instancia**: en Vercel cada función tiene su memoria, así que el límite real es
 * este × instancias. Vale como freno a un barrido de códigos desde una IP; no vale como
 * protección contra un ataque distribuido, y eso se dice aquí para que nadie lo crea. Si
 * hace falta más, el sitio es un store compartido (Upstash), no este archivo.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export function rateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    // Sin barrido periódico: cuando hay demasiadas claves, se vacía todo. Es tosco y es
    // suficiente para lo que protege.
    if (buckets.size >= MAX_KEYS) buckets.clear();
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/** La IP del cliente tal como la deja el proxy; `unknown` si no hay cabecera. */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0]!.trim()
    : (req.headers.get('x-real-ip') ?? 'unknown');
  return ip;
}
