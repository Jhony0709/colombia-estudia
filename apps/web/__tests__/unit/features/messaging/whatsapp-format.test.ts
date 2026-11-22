/**
 * El formato de WhatsApp en la bandeja (22/11). SSOT: features/messaging/whatsapp-format.ts.
 */

import { parseInline, parseWhatsApp } from '@/features/messaging/whatsapp-format';

describe('parseInline', () => {
  it('negrita, cursiva y tachado', () => {
    expect(parseInline('Hola *Ana*, _ya_ ~no~')).toEqual([
      { kind: 'text', text: 'Hola ' },
      { kind: 'bold', children: [{ kind: 'text', text: 'Ana' }] },
      { kind: 'text', text: ', ' },
      { kind: 'italic', children: [{ kind: 'text', text: 'ya' }] },
      { kind: 'text', text: ' ' },
      { kind: 'strike', children: [{ kind: 'text', text: 'no' }] },
    ]);
  });

  it('se anidan', () => {
    expect(parseInline('*muy _importante_*')).toEqual([
      {
        kind: 'bold',
        children: [
          { kind: 'text', text: 'muy ' },
          { kind: 'italic', children: [{ kind: 'text', text: 'importante' }] },
        ],
      },
    ]);
  });

  it('no formatea dentro de palabras ni con espacios pegados al marcador', () => {
    expect(parseInline('snake_case_name')).toEqual([{ kind: 'text', text: 'snake_case_name' }]);
    expect(parseInline('2 * 3 * 4')).toEqual([{ kind: 'text', text: '2 * 3 * 4' }]);
    expect(parseInline('*sin cerrar')).toEqual([{ kind: 'text', text: '*sin cerrar' }]);
  });

  it('monoespacio y código en línea, sin formato adentro', () => {
    expect(parseInline('```*tal cual*``` y `x_y_z`')).toEqual([
      { kind: 'mono', text: '*tal cual*' },
      { kind: 'text', text: ' y ' },
      { kind: 'code', text: 'x_y_z' },
    ]);
  });
});

describe('parseWhatsApp', () => {
  it('listas, numeradas y citas por línea', () => {
    expect(parseWhatsApp('Pasos:\n- uno\n2. dos\n> ojo').map((l) => l.kind)).toEqual([
      'para',
      'bullet',
      'number',
      'quote',
    ]);
  });

  it('un bloque ``` de varias líneas es un solo párrafo', () => {
    const lines = parseWhatsApp('```\nlínea 1\nlínea 2\n```');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({
      kind: 'para',
      inline: [{ kind: 'mono', text: '\nlínea 1\nlínea 2\n' }],
    });
  });
});
