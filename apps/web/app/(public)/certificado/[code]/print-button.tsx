'use client';

/** «Descargar PDF» = `window.print()`: el navegador imprime a PDF; sin JavaScript el atajo del navegador hace lo mismo. */

import { Printer } from 'lucide-react';
import { Button } from '@/components/atoms/button';

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
