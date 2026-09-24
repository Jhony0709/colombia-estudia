'use client';

/**
 * PrimaryActionTracker: envuelve la acción principal de una pantalla del estudiante y
 * declara dos cosas (E0, 23/9): que se mostró (al montar) y que se pulsó (captura del clic
 * de lo que tenga dentro, sea `Link` o `button`). No cambia lo que envuelve: `display:
 * contents`, sin rol, sin foco propio.
 *
 * Solo aquí, en tres sitios —`/aprender`, la barra del player y «Antes de empezar»—; no es
 * un rastreador general. Lo que se manda está cerrado en `events.service.ts`.
 */

import { useEffect, type ReactNode } from 'react';
import { trackStudentEvent, type StudentEventPayload } from '@/lib/telemetry/student-events';

/**
 * Impresiones ya mandadas en esta carga de página, por combinación. En desarrollo React
 * monta los efectos dos veces (StrictMode) y salían dos `shown` por una pantalla; y una
 * misma barra que se vuelve a montar al refrescar la ruta tampoco es una impresión nueva.
 */
const shown = new Set<string>();

export interface PrimaryActionTrackerProps extends StudentEventPayload {
  enrollmentId?: string | null;
  children: ReactNode;
}

export function PrimaryActionTracker({
  screen,
  action,
  assignmentId,
  form,
  enrollmentId = null,
  children,
}: PrimaryActionTrackerProps) {
  const payload: StudentEventPayload = { screen, action, assignmentId, form };
  const key = `${screen}|${action}|${assignmentId ?? ''}|${form ?? ''}|${enrollmentId ?? ''}`;

  useEffect(() => {
    if (shown.has(key)) return;
    shown.add(key);
    trackStudentEvent('student.primary_action.shown', payload, enrollmentId);
    // Una impresión por combinación: si cambia la acción (la barra pasa de «Enviar» a
    // «Siguiente»), es otra impresión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <span
      className="contents"
      onClickCapture={() =>
        trackStudentEvent('student.primary_action.clicked', payload, enrollmentId)
      }
    >
      {children}
    </span>
  );
}
