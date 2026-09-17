/**
 * Internationalization configuration.
 * Single locale for now (es-CO), expandable later.
 */

export const locales = ['es-CO'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'es-CO';
