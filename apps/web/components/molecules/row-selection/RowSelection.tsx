'use client';

/**
 * Selección de filas para acciones en lote. El estado vive en un contexto de cliente; la
 * tabla sigue siendo un componente de servidor y solo las celdas de casilla, la barra de
 * acciones y el menú de fila son de cliente. Sin JavaScript no hay casillas ni barra, y la
 * tabla se lee igual: la selección es un atajo, no la única puerta.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface RowSelectionValue {
  selected: ReadonlySet<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  clear: () => void;
}

const Ctx = createContext<RowSelectionValue | null>(null);

export function RowSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const setMany = useCallback((ids: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  const value = useMemo<RowSelectionValue>(
    () => ({ selected, isSelected: (id) => selected.has(id), toggle, setMany, clear }),
    [selected, toggle, setMany, clear]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRowSelection(): RowSelectionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRowSelection must be used within RowSelectionProvider');
  return ctx;
}

const BOX =
  'border-border text-accent-base focus-visible:outline-focus size-5 cursor-pointer rounded-[4px] border accent-[var(--accent-base)]';

/** Casilla de una fila. `label` es el nombre de la persona/cosa: «Seleccionar Ana Pérez». */
export function SelectRowCell({ id, label }: { id: string; label: string }) {
  const { isSelected, toggle } = useRowSelection();
  return (
    <span className="min-h-touch min-w-touch -m-2 inline-flex items-center justify-center p-2">
      <input
        type="checkbox"
        className={BOX}
        checked={isSelected(id)}
        onChange={() => toggle(id)}
        aria-label={label}
      />
    </span>
  );
}

/** Casilla de cabecera: selecciona o quita todas las filas de la página. */
export function SelectAllCell({ ids, label }: { ids: string[]; label: string }) {
  const { selected, setMany } = useRowSelection();
  const count = ids.filter((id) => selected.has(id)).length;
  const all = ids.length > 0 && count === ids.length;
  const some = count > 0 && !all;
  return (
    <span className="min-h-touch min-w-touch -m-2 inline-flex items-center justify-center p-2">
      <input
        type="checkbox"
        className={BOX}
        checked={all}
        ref={(el) => {
          if (el) el.indeterminate = some;
        }}
        onChange={() => setMany(ids, !all)}
        aria-label={label}
      />
    </span>
  );
}
