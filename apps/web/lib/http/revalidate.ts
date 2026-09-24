/**
 * Invalidar en el servidor lo que una escritura acaba de dejar viejo.
 * SSOT: revisión de UX del 18/9 («nada se refresca después de crear»).
 *
 * Las pantallas de staff son Server Components: leen de la base al renderizar. Cuando el
 * cliente escribe por `fetch` a una ruta de API, `router.refresh()` le pide a Next que vuelva
 * a pedir el árbol —pero Next puede contestar con lo que ya tenía, porque nadie le dijo que
 * esa ruta cambió. Eso es lo que se vio probando el curso de Valida YA!: se crea un módulo,
 * la petición devuelve 200, y la lista sigue diciendo «este programa aún no tiene módulos»
 * hasta que alguien recarga a mano. Tres veces de tres.
 *
 * Lo que arregla eso no está en el cliente: es que **el servidor marque la ruta como
 * caducada** al escribir. `router.refresh()` sigue haciendo falta —dispara la nueva
 * petición—, pero sin esto la petición trae lo mismo.
 *
 * La lista es corta y está escrita a mano, no deducida de la URL de la API: la ruta de una
 * API (`/api/admin/modules`) no es la de la pantalla que la enseña (`/admin/institucion`), y
 * cualquier intento de adivinar una desde la otra se rompe la primera vez que alguien mueva
 * una pantalla. Caducar cuatro páginas de staff de más no cuesta nada; que una se quede vieja
 * cuesta que alguien cree el mismo módulo dos veces.
 */

import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/observability/logger';

/**
 * Las pantallas de staff que leen de la base al renderizar.
 *
 * La advertencia de arriba —«se rompe la primera vez que alguien mueva una pantalla»— se
 * cumplió el 18/9 conmigo: programas y asignaturas salieron de `/admin/institucion` a sus
 * rutas propias y esta lista no se enteró. Crear un programa devolvía 200 y caducaba cinco
 * páginas, ninguna de ellas la que lo enseñaba. Las dos `/nuevo` van también porque leen el
 * currículo para sus desplegables: una asignatura recién creada tiene que aparecer en el
 * `select` del tema que se va a escribir a continuación.
 */
const STAFF_PAGES = [
  '/admin/institucion',
  '/contenido/temas',
  '/contenido/temas/nuevo',
  '/contenido/examenes',
  '/contenido/examenes/nuevo',
  '/contenido/programas',
  '/contenido/asignaturas',
  '/cohortes',
  '/personas',
] as const;

/**
 * Las dinámicas van aparte y con el patrón de la ruta, no con una URL concreta: así se caduca
 * la ficha de **cualquier** persona sin saber de quién se trata. `revalidatePath('/personas')`
 * no alcanza a `/personas/[personId]` —son rutas distintas para Next—, y por eso la ficha
 * seguía diciendo «todavía no se le ha enviado ninguna invitación» justo después de enviarla.
 */
const STAFF_DYNAMIC_PAGES = [
  '/personas/[personId]',
  '/cohortes/[cohortId]',
  '/cohortes/[cohortId]/actividades',
  '/cohortes/[cohortId]/matriculas/[enrollmentId]',
  '/cartera',
  '/cartera/[enrollmentId]',
  '/aprender/mi-cuenta',
  '/aprender',
  '/aprender/tema/[assignmentId]',
  '/aprender/examen/[assignmentId]',
  '/aprender/examen/[assignmentId]/intento/[attemptId]',
  '/aprender/resultados',
  '/aprender/notificaciones',
  '/aprender/calendario',
  '/aprender/certificados',
  '/aprender/biblioteca',
  '/contenido/temas/[lessonId]',
  '/contenido/examenes/[assessmentId]',
  '/contenido/programas/[programId]',
] as const;

/**
 * Caducar no puede tumbar una escritura que ya ocurrió.
 *
 * `revalidatePath` exige el contexto de petición de Next y **lanza** si no lo hay. Esto se
 * llama desde `api-handler.ts:153`, dentro del `try` que envuelve todas las rutas, así que
 * una excepción aquí se convierte en un 500 — sobre una petición cuyo trabajo ya está hecho y
 * guardado. El usuario vería un error por algo que sí funcionó, y reintentaría, y crearía la
 * cosa dos veces.
 *
 * Que la pantalla se quede vieja es peor que nada, pero mucho mejor que eso, y se anuncia en
 * el registro en vez de desaparecer.
 */
export function revalidateStaffPages(): void {
  try {
    for (const path of STAFF_PAGES) {
      revalidatePath(path);
    }
    for (const path of STAFF_DYNAMIC_PAGES) {
      revalidatePath(path, 'page');
    }
  } catch (err) {
    logger.warn({ event: 'revalidate-failed', error: String(err) });
  }
}
