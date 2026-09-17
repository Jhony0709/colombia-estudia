/**
 * Light theme color values.
 * SSOT: reference/03-ui/tokens.md
 *
 * Palette: Blue institutional (#1E40AF as accent.base)
 * All colors must pass contrast tests in contrast.test.ts
 */

import type { SemanticColorTokens } from '../contract/semantic-tokens';

export const lightColors: SemanticColorTokens = {
  surface: {
    canvas: '#F8FAFC',
    base: '#FFFFFF',
    sunken: '#F1F5F9',
    raised: '#FFFFFF',
    note: '#FEF3C7',
  },
  text: {
    default: '#0F172A',
    muted: '#475569',
    subtle: '#64748B',
    onAccent: '#FFFFFF',
    link: '#1E40AF',
  },
  accent: {
    base: '#1E40AF',
    hover: '#1E3A8A',
    active: '#172554',
  },
  border: {
    default: '#64748B', // Darkened for 3:1 contrast on white
    muted: '#CBD5E1',
  },
  status: {
    success: {
      base: '#15803D', // Darkened for 4.5:1 contrast with white text
      muted: '#DCFCE7',
      onBase: '#FFFFFF',
    },
    warning: {
      base: '#CA8A04',
      muted: '#FEF9C3',
      onBase: '#0F172A',
    },
    error: {
      base: '#DC2626',
      muted: '#FEE2E2',
      onBase: '#FFFFFF',
    },
    info: {
      base: '#2563EB',
      muted: '#DBEAFE',
      onBase: '#FFFFFF',
    },
    locked: {
      base: '#6B7280',
      muted: '#F3F4F6',
      onBase: '#FFFFFF',
    },
    legacy: {
      base: '#92400E',
      muted: '#FEF3C7',
      onBase: '#FFFFFF',
    },
  },
  focus: {
    ring: '#2563EB',
  },
};
