/**
 * Type definitions for semantic design tokens.
 * SSOT: reference/03-ui/tokens.md
 *
 * These are the NAMES from the contract. Values are in values/*.ts
 */

export interface SurfaceTokens {
  canvas: string;
  base: string;
  sunken: string;
  raised: string;
  note: string;
}

export interface TextTokens {
  default: string;
  muted: string;
  subtle: string;
  onAccent: string;
  link: string;
}

export interface AccentTokens {
  base: string;
  hover: string;
  active: string;
}

export interface StatusTokens {
  base: string;
  muted: string;
  onBase: string;
}

export interface BorderTokens {
  default: string;
  muted: string;
}

export interface SemanticColorTokens {
  surface: SurfaceTokens;
  text: TextTokens;
  accent: AccentTokens;
  border: BorderTokens;
  status: {
    success: StatusTokens;
    warning: StatusTokens;
    error: StatusTokens;
    info: StatusTokens;
    locked: StatusTokens;
    legacy: StatusTokens;
  };
  focus: {
    ring: string;
  };
}

export interface TypographyScale {
  size: string;
  lineHeight: string;
  weight: number;
  letterSpacing?: string;
}

export interface TypographyTokens {
  display: TypographyScale;
  heading: TypographyScale;
  subheading: TypographyScale;
  body: TypographyScale;
  data: TypographyScale;
  caption: TypographyScale;
  overline: TypographyScale;
}

export interface SpaceTokens {
  1: string;
  2: string;
  3: string;
  4: string;
  6: string;
  8: string;
  12: string;
}

export interface RadiusTokens {
  control: string;
  card: string;
  sheet: string;
  pill: string;
}

export interface SizeTokens {
  touchMin: string;
  readingWidth: string;
}

export interface ElevationTokens {
  0: string;
  1: string;
  2: string;
  3: string;
}

export interface DurationTokens {
  instant: string;
  fast: string;
  normal: string;
  slow: string;
}

export interface EasingTokens {
  standard: string;
  enter: string;
  exit: string;
}

export interface MotionTokens {
  duration: DurationTokens;
  easing: EasingTokens;
}

export interface ReadingPreferences {
  fontScale: '1' | '1.15' | '1.3';
  lineHeight: '1.5' | '1.75' | '2';
  width: '68ch' | '56ch';
  contrast: 'normal' | 'high';
  motion: 'system' | 'reduced';
  transcriptAlwaysVisible: boolean;
}

export interface DesignTokens {
  colors: SemanticColorTokens;
  typography: TypographyTokens;
  space: SpaceTokens;
  radius: RadiusTokens;
  size: SizeTokens;
  elevation: ElevationTokens;
  motion: MotionTokens;
}
