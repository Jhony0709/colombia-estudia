/**
 * Los códigos legibles (25/9): `PER-0001`, `COM-0001`, `TEM-0001`, `EXA-0001`.
 * SSOT: reference/05-database/schema.md §Códigos legibles.
 *
 * Son lo que va en la URL de la ficha (`/personas/PER-0001`, `/contenido/temas/TEM-0001`) y
 * lo que se dice en voz alta; el `cuid` sigue siendo la clave y lo que viaja por la API. Las
 * páginas aceptan las dos cosas y redirigen del `cuid` al código, para que un enlace viejo
 * siga abriendo.
 */

const CODE = /^[A-Z]{3}-\d{4,}$/;

export function isEntityCode(value: string): boolean {
  return CODE.test(value);
}

/** El `where` de Prisma para buscar por código o por id, según lo que llegue. */
export function byCodeOrId(ref: string): { code: string } | { id: string } {
  return isEntityCode(ref) ? { code: ref } : { id: ref };
}
