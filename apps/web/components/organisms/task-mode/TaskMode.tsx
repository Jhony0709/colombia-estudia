'use client';

/**
 * Modo tarea (E2 de la decisión del estudiante, 23/9): en el player y en el intento, la
 * navegación global sobra en el teléfono. Esto marca `<html class="task-mode">` mientras la
 * pantalla esté montada; `globals.css` esconde la barra superior del estudiante
 * (`[data-student-nav]`) por debajo de `lg`, y la pantalla pone la suya: una barra fina con
 * «‹ Ruta» y dónde estoy (`TaskBar`). En escritorio no cambia nada: la barra global cabe.
 *
 * Una clase en `<html>` y no una prop del layout: el layout es de servidor y no sabe la
 * ruta; una clase que entra y sale con la pantalla es lo más pequeño que hace el trabajo.
 */

import { useEffect } from 'react';

export function TaskMode() {
  useEffect(() => {
    document.documentElement.classList.add('task-mode');
    return () => document.documentElement.classList.remove('task-mode');
  }, []);
  return null;
}
