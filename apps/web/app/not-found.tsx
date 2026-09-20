/**
 * 404 de la aplicación: lo que `notFound()` pinta en cualquier área. Dice lo justo: un id
 * que no existe y uno que es de otra institución se ven igual (errors.md:14).
 */

import Link from 'next/link';
import { Button } from '@/components/atoms/button';

export default function NotFound() {
  return (
    <main id="contenido" className="mx-auto max-w-[36rem] px-4 py-16 sm:px-6">
      <h1 tabIndex={-1} className="type-display">
        No encontramos esa página
      </h1>
      <p className="type-body mt-3">Puede que el enlace esté mal escrito o que ya no exista.</p>
      <div className="mt-6">
        <Button asChild variant="secondary">
          <Link href="/ingresar">Ir al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
