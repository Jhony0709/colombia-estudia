/**
 * Los catálogos.
 * SSOT: reference/05-database/schema.md §"Catálogos".
 *
 * Son listas cerradas: `Notification.type`, `AuditLog.entity/action` y `LearningEvent.type`
 * son `String` en el schema, así que estas constantes son la única barrera contra que cada
 * sitio invente el suyo. Aquí no se repite la lista —eso sería copiar el archivo y llamarlo
 * prueba— sino lo que tiene que ser cierto de ella: sin repetidos, sin espacios, y con la
 * forma que el resto del código asume al leerlas.
 */

import {
  AUDIT_LOG_ACTIONS,
  AUDIT_LOG_ENTITIES,
  CAPABILITIES,
  LEARNING_EVENT_TYPES,
  NOTIFICATION_TYPES,
  QUESTION_TYPES,
} from './catalogs';

const catalogos: Array<[string, readonly string[]]> = [
  ['LEARNING_EVENT_TYPES', LEARNING_EVENT_TYPES],
  ['AUDIT_LOG_ENTITIES', AUDIT_LOG_ENTITIES],
  ['NOTIFICATION_TYPES', NOTIFICATION_TYPES],
  ['QUESTION_TYPES', QUESTION_TYPES],
  ['CAPABILITIES', CAPABILITIES],
];

describe('los catálogos son listas cerradas bien formadas', () => {
  it.each(catalogos)('%s no tiene entradas repetidas', (_nombre, lista) => {
    expect(new Set(lista).size).toBe(lista.length);
  });

  // Un valor con espacios o en mayúsculas se guarda igual en la base y luego no cruza con
  // nada: el `where` que lo busca no lo encuentra y el fallo aparece lejos de aquí.
  it.each(catalogos)('%s no tiene entradas vacías ni con espacios', (_nombre, lista) => {
    for (const valor of lista) {
      expect(valor).toBe(valor.trim());
      expect(valor.length).toBeGreaterThan(0);
      expect(valor).toBe(valor.toLowerCase());
    }
  });
});

describe('AUDIT_LOG_ACTIONS', () => {
  // `AuditLogAction<E>` indexa por entidad: una entidad sin acciones deja un tipo `never`
  // que solo se descubre al intentar auditar algo.
  it('tiene al menos una acción para cada entidad del catálogo', () => {
    for (const entidad of AUDIT_LOG_ENTITIES) {
      expect(AUDIT_LOG_ACTIONS[entidad].length).toBeGreaterThan(0);
    }
  });

  it('no declara acciones para entidades que no están en el catálogo', () => {
    expect(Object.keys(AUDIT_LOG_ACTIONS).sort()).toEqual([...AUDIT_LOG_ENTITIES].sort());
  });

  it('no repite acciones dentro de una misma entidad', () => {
    for (const entidad of AUDIT_LOG_ENTITIES) {
      const acciones = AUDIT_LOG_ACTIONS[entidad];
      expect(new Set(acciones).size).toBe(acciones.length);
    }
  });
});
