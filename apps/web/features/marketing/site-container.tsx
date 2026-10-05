import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Marco editorial de la web pública: 1280 px (ALBA, 5/10) y márgenes 16 / 24 / 32. */
export function SiteContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[80rem] px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}
