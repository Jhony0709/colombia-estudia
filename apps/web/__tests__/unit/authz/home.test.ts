import { homePathForRoles } from '@/lib/authz/home';

describe('homePathForRoles', () => {
  it('elige por prioridad cuando hay varios roles', () => {
    expect(homePathForRoles(['STUDENT', 'INSTRUCTOR', 'ADMIN'])).toBe('/admin/institucion');
    expect(homePathForRoles(['STUDENT', 'OPERATIONS'])).toBe('/cohortes');
    expect(homePathForRoles(['INCLUSION_COORDINATOR', 'STUDENT'])).toBe('/admin/inclusion/reporte');
  });

  it('cada rol solo va a su área', () => {
    expect(homePathForRoles(['INSTRUCTOR'])).toBe('/contenido');
    expect(homePathForRoles(['STUDENT'])).toBe('/aprender');
  });

  it('sin rol reconocido va a /sin-acceso', () => {
    expect(homePathForRoles([])).toBe('/sin-acceso');
    expect(homePathForRoles(['GUARDIAN'])).toBe('/sin-acceso');
  });

  it('el contacto del aliado va a /aliado (19/9)', () => {
    expect(homePathForRoles(['PARTNER_CONTACT'])).toBe('/aliado');
  });
});
