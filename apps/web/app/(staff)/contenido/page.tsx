/**
 * `/contenido` ya no es una pantalla: redirige a los temas.
 * SSOT: reference/01-routing/routes.md:41.
 *
 * El 18/9 la pantalla se partió en `/contenido/temas` y `/contenido/examenes`. Esta ruta
 * se conserva **redirigiendo** y no se borra: está en enlaces guardados, en el historial de
 * quien ya la usaba y en `revalidate.ts`. Una redirección cuesta nada; un 404 cuesta una
 * llamada a soporte.
 *
 * Va a los temas y no a una pantalla de resumen porque una pantalla de resumen sin contenido
 * propio es una parada de más entre el clic y el trabajo.
 */

import { redirect } from 'next/navigation';

export default function ContentIndexPage() {
  redirect('/contenido/temas');
}
