/**
 * Los catálogos de personas: roles y estados de invitación.
 * SSOT: packages/domain/src/capabilities.ts (`Role`), plan/03 «Invitación».
 *
 * Vive fuera de `features/people/server/` porque **el cliente también los necesita**: los
 * `<select>` de rol de `/personas` y de la ficha de una persona se pintan con esta lista.
 *
 * Estaban dentro de `people.service.ts`, que empieza con `import 'server-only'`. Un
 * componente `'use client'` que importaba `ROLES` de ahí arrastraba el servicio entero al
 * paquete del navegador, y Next tumbaba la compilación con «You're importing a component
 * that needs server-only». Resultado: `/personas/[personId]` devolvía **500 siempre** —la
 * ficha de una persona no se podía abrir—. Se vio al crear el primer estudiante.
 *
 * Aquí no hay `server-only` ni nada que lo necesite: son dos listas de cadenas.
 */

import type { Role } from '@colombia-estudia/domain';

/**
 * `satisfies` mantiene esto honesto contra el tipo del dominio: un rol que deje de existir
 * rompe la compilación. (Uno añadido no — eso queda en quien lo añada.)
 */
export const ROLES = [
  'ADMIN',
  'OPERATIONS',
  'INSTRUCTOR',
  'INCLUSION_COORDINATOR',
  'STUDENT',
  'GUARDIAN',
  'PARTNER_CONTACT',
] as const satisfies readonly Role[];

export type InvitationState = 'accepted' | 'pending' | 'expired' | 'none';

export const INVITATION_STATES: readonly InvitationState[] = [
  'accepted',
  'pending',
  'expired',
  'none',
];
