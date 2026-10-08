'use client';

/**
 * Una portada con URL firmada de Storage (8/10). Cliente por una razón: si la firma venció
 * (una página abierta mucho rato, o recuperada con «atrás»), Storage responde `InvalidJWT` y se
 * veía la imagen rota; aquí se cambia por `fallback`, el mismo relleno de cuando no hay portada.
 * El error puede llegar antes de hidratar, así que también se mira al montar.
 * Decorativa siempre: `alt=""`, el nombre va al lado (WCAG 1.1.1).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function CoverImage({
  src,
  className,
  fallback,
}: {
  src: string;
  className?: string;
  fallback: ReactNode;
}) {
  const ref = useRef<HTMLImageElement>(null);
  // La URL que falló, no un sí/no: una firma nueva (tras `router.refresh`) se vuelve a intentar.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailedSrc(src);
  }, [src]);

  if (failedSrc === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage.
    <img ref={ref} src={src} alt="" className={className} onError={() => setFailedSrc(src)} />
  );
}
