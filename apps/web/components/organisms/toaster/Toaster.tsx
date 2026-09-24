'use client';

/**
 * Toasts: avisos que aparecen, dicen lo suyo y se van (24/9, Jhonny: «la sección avisos
 * debe funcionar como un toast de información dependiendo lo que se quiera mostrar,
 * success o errores o información»).
 *
 * Es `@radix-ui/react-toast`, que ya trae lo que un toast tiene que hacer bien: región
 * viva (`role="status"` o `role="alert"` según lo que se anuncia), pausa al pasar el ratón o
 * enfocar, atajo F8 para llegar a los toasts con teclado, deslizar para cerrar en táctil.
 *
 * Reglas de la casa: la palabra dice la gravedad (el icono y el color solo la hacen visible
 * de lejos); un error no se va solo —se cierra— porque lo que impide seguir no puede
 * desaparecer antes de leerse; éxito e información se van a los seis segundos. Motion:
 * entra con grow y sale con fade (`.toast-item` en `globals.css`, tokens de motion; corte
 * seco con reduced-motion). Un solo `Toaster` en el layout raíz; `useToast()` en cualquier
 * cliente.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

export interface ToastInput {
  severity: ToastSeverity;
  title: string;
  description?: string;
  /** Una acción, con nombre propio. `altText` es lo que oye quien no la ve como botón. */
  action?: { label: string; altText?: string; onClick: () => void };
  /** Milisegundos antes de irse. Los errores no se van solos salvo que se diga. */
  duration?: number;
  /**
   * Clave para no repetir: un toast con la misma clave sustituye al anterior en vez de
   * apilarse (validaciones que corren cada pocos segundos).
   */
  key?: string;
}

interface ToastItem extends ToastInput {
  id: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_MS: Record<ToastSeverity, number> = {
  success: 6_000,
  info: 6_000,
  warning: 10_000,
  error: Number.POSITIVE_INFINITY,
};

const TONE: Record<ToastSeverity, { border: string; Icon: typeof Info; live: 'status' | 'alert' }> =
  {
    success: { border: 'border-status-success-base', Icon: CheckCircle, live: 'status' },
    info: { border: 'border-status-info-base', Icon: Info, live: 'status' },
    warning: { border: 'border-status-warning-base', Icon: AlertTriangle, live: 'status' },
    error: { border: 'border-status-error-base', Icon: XCircle, live: 'alert' },
  };

let counter = 0;

export function ToastProvider({
  children,
  labels,
}: {
  children: ReactNode;
  /** Textos accesibles: nombre de la región, «Cerrar» y la palabra de cada gravedad. */
  labels: { region: string; close: string; severity: Record<ToastSeverity, string> };
}) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = `toast-${++counter}`;
    setItems((prev) => [
      ...prev.filter((item) => !(input.key && item.key === input.key)),
      { ...input, id },
    ]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="right" label={labels.region}>
        {children}
        {items.map((item) => {
          const tone = TONE[item.severity];
          const duration = item.duration ?? DEFAULT_MS[item.severity];
          return (
            <Toast.Root
              key={item.id}
              type={tone.live === 'alert' ? 'foreground' : 'background'}
              duration={duration}
              onOpenChange={(open) => {
                if (!open) dismiss(item.id);
              }}
              className={cn(
                'toast-item bg-surface-base elevation-modal rounded-card border border-l-4 p-4',
                'border-border-muted grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1',
                tone.border
              )}
            >
              <tone.Icon className="text-text-muted mt-0.5 size-5" aria-hidden="true" />
              <div className="min-w-0">
                <Toast.Title className="type-body-emphasis text-text">
                  <span className="sr-only">{labels.severity[item.severity]}: </span>
                  {item.title}
                </Toast.Title>
                {item.description && (
                  <Toast.Description className="type-caption text-text-muted mt-0.5">
                    {item.description}
                  </Toast.Description>
                )}
                {item.action && (
                  <Toast.Action asChild altText={item.action.altText ?? item.action.label}>
                    <button
                      type="button"
                      onClick={item.action.onClick}
                      className="text-text-link type-body min-h-touch mt-1 inline-flex items-center underline underline-offset-4"
                    >
                      {item.action.label}
                    </button>
                  </Toast.Action>
                )}
              </div>
              <Toast.Close className="text-text-muted hover:bg-surface-sunken hover:text-text rounded-control min-h-touch min-w-touch -mr-2 -mt-2 inline-flex items-center justify-center self-start">
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">{labels.close}</span>
              </Toast.Close>
            </Toast.Root>
          );
        })}
        {/* Abajo a la derecha en escritorio, abajo a lo ancho en el teléfono; por encima de la barra de acciones. */}
        <Toast.Viewport className="fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-[24rem] flex-col gap-2 outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
