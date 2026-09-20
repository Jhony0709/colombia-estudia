'use client';

/**
 * La pantalla de error genérica (plan/10 §1): dice qué pasó en una frase, ofrece
 * reintentar y da un código para soporte. El código es el `digest` que Next calcula del
 * error del servidor —el mismo que aparece en los logs y en Sentry—, así que «menciona el
 * código» le permite a Jhonny encontrar el rastro en menos de un minuto.
 *
 * Sin `useTranslations`: si el error está en el árbol de i18n, esta pantalla también
 * tiene que pintarse. Textos fijos en español.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/atoms/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry ya recibe el error del servidor con su `digest` (instrumentation.ts); aquí
    // solo se deja rastro en la consola para el desarrollo.
    if (process.env.NODE_ENV !== 'production') console.error(error);
  }, [error]);

  const code = error.digest ?? null;

  return (
    <main id="contenido" className="mx-auto max-w-[36rem] px-4 py-16 sm:px-6">
      <h1 tabIndex={-1} className="type-display">
        Algo salió mal
      </h1>
      <p className="type-body mt-3">
        No pudimos cargar esta pantalla. Puedes intentarlo de nuevo; si sigue fallando, escríbenos.
      </p>
      {code && (
        <p className="type-caption text-text-muted mt-2">
          Si escribes a soporte, menciona el código <code className="font-mono">{code}</code>.
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => reset()}>Intentar de nuevo</Button>
        <Button asChild variant="secondary">
          <Link href="/ingresar">Ir al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
