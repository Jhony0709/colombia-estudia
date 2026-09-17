/**
 * Dark theme color values.
 * SSOT: reference/03-ui/tokens.md
 *
 * All colors must pass contrast tests in contrast.test.ts
 */

import type { SemanticColorTokens } from '../contract/semantic-tokens';

export const darkColors: SemanticColorTokens = {
  surface: {
    canvas: '#0F172A',
    base: '#1E293B',
    sunken: '#0F172A',
    raised: '#334155',
    note: '#422006',
  },
  text: {
    default: '#F8FAFC',
    muted: '#94A3B8',
    subtle: '#94A3B8', // Same as muted for dark mode to meet 4.5:1
    onAccent: '#0F172A', // Dark text on light accent for 4.5:1
    link: '#60A5FA',
  },
  accent: {
    base: '#60A5FA', // Lightened for 4.5:1 with dark text
    hover: '#93C5FD',
    active: '#BFDBFE',
  },
  border: {
    default: '#64748B', // Lightened for 3:1 contrast
    muted: '#475569',
  },
  status: {
    success: {
      base: '#22C55E',
      muted: '#14532D',
      onBase: '#0F172A',
    },
    warning: {
      base: '#FBBF24',
      muted: '#422006',
      onBase: '#0F172A',
    },
    error: {
      base: '#EF4444',
      muted: '#450A0A',
      onBase: '#0F172A', // Dark text for 4.5:1
    },
    info: {
      base: '#60A5FA',
      muted: '#1E3A8A',
      onBase: '#0F172A',
    },
    locked: {
      base: '#9CA3AF',
      muted: '#1F2937',
      onBase: '#0F172A',
    },
    legacy: {
      base: '#F59E0B',
      muted: '#422006',
      onBase: '#0F172A',
    },
  },
  focus: {
    ring: '#60A5FA',
  },
};
