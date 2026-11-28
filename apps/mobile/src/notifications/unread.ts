import { useSyncExternalStore } from 'react';

// Los avisos sin leer, para la pestaña: los dicen Mi ruta y Avisos al cargar.
let unread = 0;
const listeners = new Set<() => void>();

export function setUnread(count: number): void {
  if (count === unread) return;
  unread = count;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useUnread = (): number => useSyncExternalStore(subscribe, () => unread);
