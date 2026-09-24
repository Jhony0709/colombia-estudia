import { homePathForRoles } from '@/lib/authz/home';

describe('homePathForRoles', () => {
  it('elige por prioridad cuando hay varios roles', () => {
    expect(homePathForRoles(['STUDENT', 'INSTRUCTOR', 'ADMIN'])).toBe('/inicio');
    expect(homePathForRoles(['STUDENT', 'OPERATIONS'])).toBe('/inicio');
    expect(homePathForRoles(['INCLUSION_COORDINATOR', 'STUDENT'])).toBe('/admin/inclusion/reporte');
  });

  it('cada rol solo va a su área', () => {
    expect(homePathForRoles(['INSTRUCTOR'])).toBe('/contenido');
    expect(homePathForRoles(['STUDENT'])).toBe('/aprender');
  });

  it('ADMIN y OPERATIONS aterrizan en la pantalla de situación (23/9, ola 3)', () => {
    expect(homePathForRoles(['ADMIN'])).toBe('/inicio');
    expect(homePathForRoles(['OPERATIONS'])).toBe('/inicio');
  });

  it('sin rol reconocido va a /sin-acceso', () => {
    expect(homePathForRoles([])).toBe('/sin-acceso');
  });

  it('el acudiente va a /familia, y detrás del estudiante si es las dos cosas (Fase C, 23/9)', () => {
    expect(homePathForRoles(['GUARDIAN'])).toBe('/familia');
    expect(homePathForRoles(['GUARDIAN', 'STUDENT'])).toBe('/aprender');
  });

  it('el contacto del aliado va a /aliado (19/9)', () => {
    expect(homePathForRoles(['PARTNER_CONTACT'])).toBe('/aliado');
  });
});
