import { Lexend } from 'next/font/google';

/**
 * Lexend, solo para la web pública (Jhonny, 19/9; manual ALBA, 5/10: 400/500/600/700). El
 * motivo para no usarla en el producto —no trae `tnum` y sus dígitos son proporcionales,
 * ver sans.ts— no aplica en una portada sin columnas de cifras. `next/font/google` la
 * descarga en la build y la sirve desde `_next/static`: `font-src 'self'` de la CSP basta.
 */
export const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-site',
  display: 'swap',
});
