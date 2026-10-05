/**
 * Contrato de imágenes de la web pública.
 *
 * Cada hueco tiene un id y una relación de aspecto fijados aquí; la foto se declara en
 * `MEDIA` (`src`, `alt`, medidas y, si hace falta, `focalPoint`) y el layout no se toca. Para
 * cambiar una foto se cambia su entrada, nada más.
 *
 * Las de hoy (19/9 y 23/9) son generadas: valen como ilustración de marketing, no como
 * estudiantes reales; el manual pide personas reales y diversas, y eso sigue pendiente del
 * cliente. `alt: ''` solo en el fondo del CTA final: es paisaje bajo un velo, decorativo.
 */

export type MediaId =
  // Portada ALBA (5/10). Una foto por hueco; ninguna se repite en la página.
  | 'home-hero' // persona adulta estudiando, vertical, dentro de la máscara en arco del hero
  | 'home-adult' // adulto estudiando en casa («Volver a estudiar puede sentirse diferente»)
  | 'home-program' // foto de la tarjeta navy del programa
  | 'home-story' // vida adulta con responsabilidades («Historias reales», máscara ovalada)
  | 'home-mosaic-place' // mosaico: estudiar desde cualquier sitio (pieza grande, vertical)
  | 'home-mosaic-work' // mosaico: compatible con el trabajo (pieza apaisada)
  | 'home-mosaic-future' // mosaico: un futuro mejor (pieza apaisada)
  | 'home-final' // paisaje panorámico, fondo del CTA final bajo un velo navy
  // Columna izquierda de las pantallas de acceso (23/9): una por intención.
  | 'auth-login' // iniciar sesión
  | 'auth-register' // registro
  | 'auth-recover' // recuperar, restablecer, segundo factor
  | 'auth-strip'; // banda apaisada sobre el formulario en el teléfono

export type AspectRatio = '4/5' | '16/9' | '3/2' | '1/1' | '21/9' | '5/4' | '3/4' | '3/1' | '4/3';

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
    id: 'home-hero',
    ratio: '4/5',
    brief:
      'Persona adulta (25–50) estudiando o pensando, sin mirar a cámara, con ciudad o montaña de fondo; vertical. Va dentro de un arco: el tercio izquierdo se recorta.',
  },
  {
    id: 'home-adult',
    ratio: '4/5',
    brief: 'Adulto estudiando en casa (cocina, sala), luz cálida; vertical, la persona centrada.',
  },
  {
    id: 'home-program',
    ratio: '3/4',
    brief:
      'Adulto con portátil o cuaderno; fondo oscuro o azul (va sobre la tarjeta navy); vertical.',
  },
  {
    id: 'home-story',
    ratio: '1/1',
    brief:
      'Vida adulta con responsabilidades: estudiar con la familia cerca, de noche o al final del día; cuadrada, la persona en el tercio izquierdo.',
  },
  {
    id: 'home-mosaic-place',
    ratio: '3/4',
    brief: 'Estudiar en tránsito o fuera de casa (bus, parque, descanso del trabajo); vertical.',
  },
  {
    id: 'home-mosaic-work',
    ratio: '16/9',
    brief:
      'Trabajo y estudio en la misma jornada (puesto de trabajo, mesa con portátil); apaisada.',
  },
  {
    id: 'home-mosaic-future',
    ratio: '16/9',
    brief:
      'Personas adultas sonriendo, al aire libre o en familia; apaisada, sin campus ni birretes.',
  },
  {
    id: 'home-final',
    ratio: '21/9',
    brief:
      'Amanecer sobre montañas o ciudad colombiana, panorámica, sin texto; va bajo un velo navy.',
  },
  {
    id: 'auth-login',
    ratio: '3/4',
    brief:
      'Persona adulta estudiando en casa, vertical; el tercio izquierdo tranquilo para el titular.',
  },
  {
    id: 'auth-register',
    ratio: '3/4',
    brief: 'Persona adulta empezando a estudiar, vertical; misma composición que auth-login.',
  },
  {
    id: 'auth-recover',
    ratio: '3/4',
    brief: 'Persona con el teléfono, en tránsito, vertical; misma composición que auth-login.',
  },
  {
    id: 'auth-strip',
    ratio: '3/1',
    brief: 'Mesa de estudio sin caras, apaisada 3:1; la mitad izquierda libre.',
  },
];

/**
 * Las fotos disponibles. `null` = todavía no hay: el hueco se pinta como placeholder.
 * Rellenar aquí es toda la integración.
 */
export const MEDIA: Record<MediaId, EditorialMedia | null> = {
  // Portada ALBA (5/10): las fotografías generadas del 19/9 y 23/9 repartidas por hueco. Son
  // ilustración de marketing, no estudiantes reales: nunca junto a un nombre, un testimonio o
  // una cifra. Los `alt` describen lo que se ve.
  'home-hero': {
    src: '/photos/login-woman.jpg',
    alt: 'Mujer adulta de cárdigan verde escribe en un cuaderno junto a una ventana con vista a una ciudad entre montañas.',
    width: 1086,
    height: 1448,
    focalPoint: { x: 0.6, y: 0.5 },
  },
  'home-adult': {
    src: '/photos/register-man.jpg',
    alt: 'Hombre adulto estudia con un cuaderno en la mesa de la cocina, al atardecer, con un dibujo infantil pegado en la nevera.',
    width: 1086,
    height: 1448,
    focalPoint: { x: 0.65, y: 0.5 },
  },
  'home-program': {
    src: '/photos/banner-student.jpg',
    alt: 'Joven con audífonos sonríe frente a un portátil, de noche, con luz cálida de una lámpara.',
    width: 1145,
    height: 1374,
    focalPoint: { x: 0.5, y: 0.25 },
  },
  'home-story': {
    src: '/photos/program-bachillerato.jpg',
    alt: 'Mujer adulta estudia en la mesa de la cocina con un cuaderno y una tableta, con una niña al fondo.',
    width: 1600,
    height: 900,
    focalPoint: { x: 0.25, y: 0.5 },
  },
  'home-mosaic-place': {
    src: '/photos/recover-bus.jpg',
    alt: 'Joven lee en su teléfono sentada junto a la ventana de un bus, con un cuaderno en las piernas y la ciudad afuera.',
    width: 1086,
    height: 1448,
    focalPoint: { x: 0.6, y: 0.5 },
  },
  'home-mosaic-work': {
    src: '/photos/login-strip.jpg',
    alt: 'Mesa de madera con un cuaderno abierto, un bolígrafo, una taza y un portátil, con luz de ventana.',
    width: 2172,
    height: 724,
    focalPoint: { x: 0.75, y: 0.5 },
  },
  'home-mosaic-future': {
    src: '/photos/final-students.jpg',
    alt: 'Tres personas ríen juntas al aire libre, una de ellas con un cuaderno, entre árboles al sol.',
    width: 2000,
    height: 727,
    focalPoint: { x: 0.5, y: 0.4 },
  },
  'home-final': {
    src: '/photos/hero-city.jpg',
    alt: '',
    width: 1448,
    height: 1086,
    focalPoint: { x: 0.5, y: 0.25 },
  },
  // Pantallas de acceso (23/9). Generadas, como las demás: ilustración, no estudiantes reales.
  'auth-login': {
    src: '/photos/login-woman.jpg',
    alt: 'Mujer adulta de cárdigan verde escribe en un cuaderno junto a una ventana con vista a una ciudad entre montañas.',
    width: 1086,
    height: 1448,
    focalPoint: { x: 0.7, y: 0.25 },
  },
  'auth-register': {
    src: '/photos/register-man.jpg',
    alt: 'Hombre adulto estudia con un cuaderno en la mesa de la cocina, al atardecer, con un dibujo infantil pegado en la nevera.',
    width: 1086,
    height: 1448,
    focalPoint: { x: 0.65, y: 0.45 },
  },
  'auth-recover': {
    src: '/photos/recover-bus.jpg',
    alt: 'Joven lee en su teléfono sentada junto a la ventana de un bus, con un cuaderno en las piernas y la ciudad afuera.',
    width: 1086,
    height: 1448,
    focalPoint: { x: 0.7, y: 0.4 },
  },
  'auth-strip': {
    src: '/photos/login-strip.jpg',
    alt: 'Mesa de madera con un cuaderno abierto, un bolígrafo, una taza y un portátil, con luz de ventana.',
    width: 2172,
    height: 724,
    focalPoint: { x: 0.75, y: 0.5 },
  },
};

export function ratioOf(id: MediaId): AspectRatio {
  return MEDIA_SLOTS.find((s) => s.id === id)!.ratio;
}
