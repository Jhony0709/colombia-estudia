'use client';

/**
 * Live region announcements for screen readers.
 * SSOT: reference/03-ui/accesibilidad.md
 *
 * Usage:
 * ```tsx
 * const { announce } = useAnnounce();
 * announce('Guardado correctamente');
 * announce('Error crítico', { assertive: true });
 * ```
 */

import React, { createContext, useContext, useCallback, useRef, type ReactNode } from 'react';

interface AnnounceOptions {
  /** Use assertive for urgent messages (errors). Default: polite. */
  assertive?: boolean;
}

interface AnnounceContextValue {
  announce: (message: string, options?: AnnounceOptions) => void;
}

const AnnounceContext = createContext<AnnounceContextValue | null>(null);

interface AnnounceProviderProps {
  children: ReactNode;
}

/**
 * Provider for live region announcements.
 * Renders two hidden live regions (polite and assertive).
 *
 * CORRECTION 11: Single component, no separate LiveRegions.
 */
export function AnnounceProvider({ children }: AnnounceProviderProps) {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, options?: AnnounceOptions) => {
    const target = options?.assertive ? assertiveRef.current : politeRef.current;
    if (target) {
      // Clear + set so screen readers announce repeated identical messages
      target.textContent = '';
      requestAnimationFrame(() => {
        target.textContent = message;
      });
    }
  }, []);

  return (
    <AnnounceContext.Provider value={{ announce }}>
      {children}
      <div
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        ref={assertiveRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </AnnounceContext.Provider>
  );
}

/**
 * Hook to announce messages to screen readers.
 * Must be used within AnnounceProvider.
 */
export function useAnnounce(): AnnounceContextValue {
  const ctx = useContext(AnnounceContext);
  if (!ctx) {
    throw new Error('useAnnounce must be used within AnnounceProvider');
  }
  return ctx;
}
