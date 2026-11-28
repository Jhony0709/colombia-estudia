import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { themes, type ThemeTokens } from './generated/tokens';

export type Mode = 'light' | 'dark';

/**
 * The faces the app loaded (with expo-font, or linked), by weight. With a face for a weight, text takes
 * that family and no `fontWeight`: Android would thicken it again. Without, the regular one and the weight.
 */
export interface Fonts {
  regular: string;
  medium?: string;
  bold?: string;
}

/** A theme in one mode: what a component reads. `Theme<typeof theme>` has the tokens of the app too, by name. */
export type Theme<T extends ThemeTokens = ThemeTokens> = Omit<T, 'color'> & {
  mode: Mode;
  color: T['color']['light'];
  /** Without it, the font of the system. */
  font?: Fonts;
};

const Context = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  /** Default: the base theme. */
  theme?: ThemeTokens;
  /** Default: what the system says. */
  mode?: Mode;
  /** Default: the font of the system. */
  fonts?: Fonts;
  children?: ReactNode;
}

export function ThemeProvider({ theme = themes.base, mode, fonts, children }: ThemeProviderProps) {
  const system = useColorScheme();
  const now: Mode = mode ?? (system === 'dark' ? 'dark' : 'light');
  const value = useMemo<Theme>(() => ({ ...theme, mode: now, color: theme.color[now], font: fonts }), [theme, now, fonts?.regular, fonts?.medium, fonts?.bold]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The theme, in the mode it is in. `useTheme<typeof theme>()` gives the app its own tokens (`app.…`), checked by name. */
export function useTheme<T extends ThemeTokens = ThemeTokens>(): Theme<T> {
  const theme = useContext(Context);
  if (!theme) throw new Error('@fluxus-ui/native: no theme. Wrap the app in <ThemeProvider>.');
  return theme as Theme<T>;
}
