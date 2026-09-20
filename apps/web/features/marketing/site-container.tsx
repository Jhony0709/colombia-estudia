import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Marco editorial de la web pública: 1240 px y márgenes 16 / 24 / 32. */
export function SiteContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('max-w-site mx-auto w-full px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}
