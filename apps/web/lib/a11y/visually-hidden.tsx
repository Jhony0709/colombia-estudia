/**
 * Visually hidden content for screen readers.
 * SSOT: reference/03-ui/accesibilidad.md
 *
 * Use for accessible labels that should not be visible.
 */

import React, { type ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';

interface VisuallyHiddenProps {
  children: ReactNode;
  /** Render as child element instead of span */
  asChild?: boolean;
}

export function VisuallyHidden({ children, asChild }: VisuallyHiddenProps) {
  const Comp = asChild ? Slot : 'span';
  return <Comp className="sr-only">{children}</Comp>;
}
