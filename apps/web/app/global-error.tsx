'use client';

/**
 * El último recurso: cuando falla el layout raíz. Sin tokens ni componentes (pueden ser la
 * causa) y **sin estilos**: aquí no hay `globals.css` y la CSP (`style-src 'self' nonce`)
 * bloquea el atributo `style`. HTML a pelo, que es legible y accesible igual.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es-CO">
      <body>
        <main id="contenido">
          <h1>Algo salió mal</h1>
          <p>No pudimos cargar la aplicación. Intenta de nuevo en un momento.</p>
          {error.digest && (
            <p>
              Si escribes a soporte, menciona el código <code>{error.digest}</code>.
            </p>
          )}
          <button type="button" onClick={() => reset()}>
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
