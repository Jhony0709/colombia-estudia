/**
 * El ancho de la tarjeta de curso (7/10: 280 px), el mismo en el carrusel y en las rejillas.
 * Módulo aparte y sin `'use client'`: lo importan Server y Client Components. Clases literales
 * para que Tailwind las vea.
 */
export const COURSE_CARD_WIDTH = 'w-[17.5rem] max-w-[85vw]';
export const COURSE_CARD_GRID = 'sm:grid-cols-[repeat(auto-fill,17.5rem)]';
