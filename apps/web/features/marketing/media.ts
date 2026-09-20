/**
 * Contrato de imágenes de la web pública.
 *
 * Cada hueco tiene un id y una relación de aspecto fijados aquí; la foto se declara en
 * `MEDIA` (`src`, `alt`, medidas y, si hace falta, `focalPoint`) y el layout no se toca. Para
 * cambiar una foto se cambia su entrada, nada más.
 *
 * Las de hoy (19/9) son generadas: valen como ilustración de marketing, no como estudiantes
 * reales; el manual pide personas reales y diversas, y eso sigue pendiente del cliente.
 */

export type MediaId =
  | 'hero-student' // persona sobre las formas de marca (hero)
  | 'hero-city' // fondo de todo el hero en tablet/escritorio (background en site.css)
  | 'editorial-colombia' // paisaje/patrimonio (panel "Una Colombia más preparada")
  | 'banner-student' // persona con audífonos/portátil (banner azul)
  | 'final-students' // grupo de estudiantes (CTA final)
  | 'program-bachillerato'; // tarjeta del programa

export type AspectRatio = '4/5' | '16/9' | '3/2' | '1/1' | '21/9' | '5/4';

export interface EditorialMedia {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Punto de interés en 0–1; `object-position` lo respeta al recortar. */
  focalPoint?: { x: number; y: number };
}

export interface MediaSlot {
  id: MediaId;
  ratio: AspectRatio;
  /** Para la lista de entrega: qué debería mostrar la foto. */
  brief: string;
}

/** Los huecos, con su encargo. Esta es la lista de fotos que hay que entregar. */
export const MEDIA_SLOTS: readonly MediaSlot[] = [
  {
    id: 'hero-student',
    ratio: '4/5',
    brief:
      'Estudiante de cuerpo medio, mirando arriba/lateral, sobre fondo neutro o recortable; vertical.',
  },
  {
    id: 'hero-city',
    ratio: '21/9',
    brief:
      'Ciudad o paisaje colombiano luminoso, sin texto; es el fondo de todo el hero en tablet y escritorio, tras una máscara degradada (site.css). El teléfono no la muestra.',
  },
  {
    id: 'editorial-colombia',
    ratio: '3/2',
    brief:
      'Patrimonio o paisaje con bandera o color de país; horizontal; el panel blanco tapa la mitad derecha.',
  },
  {
    id: 'banner-student',
    ratio: '4/5',
    brief: 'Persona estudiando con portátil o audífonos; fondo oscuro o azul funciona mejor.',
  },
  {
    id: 'final-students',
    ratio: '3/2',
    brief: 'Grupo de dos o tres estudiantes sonriendo; horizontal.',
  },
  {
    id: 'program-bachillerato',
    ratio: '16/9',
    brief: 'Aula, tutoría o estudiante adulto; horizontal.',
  },
];

/**
 * Las fotos disponibles. `null` = todavía no hay: el hueco se pinta como placeholder.
 * Rellenar aquí es toda la integración.
 */
export const MEDIA: Record<MediaId, EditorialMedia | null> = {
  // Fotografías entregadas por Jhonny el 19/9 (generadas; ilustración de marketing, no
  // estudiantes reales: nunca junto a un nombre o un testimonio). Optimizadas a JPEG en
  // apps/web/public/photos/. Los `alt` describen lo que se ve, sin inventar historia.
  'hero-student': {
    // Recortada sin fondo (rembg + matting), WebP con alpha: la persona va sobre las formas.
    src: '/photos/hero-student.webp',
    alt: 'Estudiante con un suéter amarillo abraza un portátil y un cuaderno mientras mira hacia arriba, sonriendo.',
    width: 1000,
    height: 1250,
    focalPoint: { x: 0.5, y: 0.5 },
  },
  'hero-city': {
    src: '/photos/hero-city.jpg',
    alt: 'Ciudad colombiana de edificios de ladrillo entre árboles, con montañas verdes al fondo y cielo despejado.',
    width: 1448,
    height: 1086,
    focalPoint: { x: 0.5, y: 0.55 },
  },
  'editorial-colombia': {
    src: '/photos/editorial-colombia.jpg',
    alt: 'Bandera de Colombia ondeando sobre una muralla de piedra junto al mar, al atardecer.',
    width: 1672,
    height: 941,
    focalPoint: { x: 0.2, y: 0.4 },
  },
  'banner-student': {
    src: '/photos/banner-student.jpg',
    alt: 'Joven con audífonos sonríe frente a un portátil, de noche, con luz cálida de una lámpara.',
    width: 1145,
    height: 1374,
    focalPoint: { x: 0.55, y: 0.3 },
  },
  'final-students': {
    src: '/photos/final-students.jpg',
    alt: 'Tres estudiantes ríen juntos al aire libre, uno de ellos con un cuaderno, entre árboles al sol.',
    width: 2000,
    height: 727,
    focalPoint: { x: 0.7, y: 0.45 },
  },
  'program-bachillerato': {
    src: '/photos/program-bachillerato.jpg',
    alt: 'Mujer adulta estudia en la mesa de la cocina con un cuaderno y una tableta, con una niña al fondo.',
    width: 1600,
    height: 900,
    focalPoint: { x: 0.25, y: 0.5 },
  },
};

export function ratioOf(id: MediaId): AspectRatio {
  return MEDIA_SLOTS.find((s) => s.id === id)!.ratio;
}
