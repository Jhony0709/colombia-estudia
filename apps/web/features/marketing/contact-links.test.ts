import { primaryContact, whatsappUrl } from './contact-links';

describe('whatsappUrl', () => {
  it('quita todo lo que no sea dígito y conserva el indicativo', () => {
    expect(whatsappUrl('+57 300 123 4567')).toBe('https://wa.me/573001234567');
  });

  it('con mensaje, lo lleva escrito y codificado en `text` (28/9)', () => {
    expect(whatsappUrl('+57 310 250 2207', 'Hola, quiero información')).toBe(
      'https://wa.me/573102502207?text=Hola%2C%20quiero%20informaci%C3%B3n'
    );
    expect(whatsappUrl('+57 310 250 2207', '   ')).toBe('https://wa.me/573102502207');
  });

  it('no inventa un enlace sin teléfono o con uno demasiado corto', () => {
    expect(whatsappUrl(null)).toBeNull();
    expect(whatsappUrl('123')).toBeNull();
  });
});

describe('primaryContact', () => {
  it('prefiere WhatsApp y cae a correo', () => {
    expect(primaryContact('+57 300 123 4567', 'hola@ce.co')).toEqual({
      href: 'https://wa.me/573001234567',
      external: true,
    });
    expect(primaryContact(null, 'hola@ce.co')).toEqual({
      href: 'mailto:hola@ce.co',
      external: false,
    });
  });
});
