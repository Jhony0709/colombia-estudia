'use client';

/**
 * Focus management for accessible navigation.
 * SSOT: reference/03-ui/accesibilidad.md
 *
 * Moves focus to the first h1 on route changes (WCAG 2.4.3).
 */

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useCallback } from 'react';

/**
 * Component that manages focus on route changes.
 * Renders nothing; only handles focus side effects.
 */
export function FocusManager() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== previousPathname.current) {
      previousPathname.current = pathname;

      // Move focus to the first h1 (2.4.3 Focus Order)
      const h1 = document.querySelector('h1');
      if (h1) {
        // Make it focusable without adding to tab order
        h1.setAttribute('tabindex', '-1');
        h1.focus();
        // Focus ring is handled by global :focus-visible
      }
    }
  }, [pathname]);

  return null;
}

/**
 * Hook to save and restore focus to a trigger element.
 * Use when opening/closing modals or dialogs.
 *
 * Usage:
 * ```tsx
 * const { saveTrigger, returnFocus } = useReturnFocus();
 *
 * function openModal() {
 *   saveTrigger();
 *   setIsOpen(true);
 * }
 *
 * function closeModal() {
 *   setIsOpen(false);
 *   returnFocus();
 * }
 * ```
 */
export function useReturnFocus() {
  const triggerRef = useRef<HTMLElement | null>(null);

  const saveTrigger = useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement;
  }, []);

  const returnFocus = useCallback(() => {
    triggerRef.current?.focus();
  }, []);

  return { saveTrigger, returnFocus };
}
