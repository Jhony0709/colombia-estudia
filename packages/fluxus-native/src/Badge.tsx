import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme, type Theme } from './theme';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends Omit<ViewProps, 'style'> {
  children: ReactNode;
  /** Default: 'neutral'. */
  tone?: Tone;
  /** 'dot': a point of the tone before the text, on a quiet ground. Default: 'tint'. */
  look?: 'tint' | 'dot';
  style?: StyleProp<ViewStyle>;
}

/** The ground, the ink and the solid colour of a tone. */
export function toneColors(theme: Theme, tone: Tone = 'neutral'): { subtle: string; ink: string; solid: string } {
  const c = theme.color;
  if (tone === 'neutral') return { subtle: c['surface.sunken'], ink: c['text.muted'], solid: c['text.muted'] };
  if (tone === 'accent') return { subtle: c['accent.subtle'], ink: c['text.accent'], solid: c['accent.default'] };
  return { subtle: c[`state.${tone}.subtle`], ink: c[`state.${tone}.text`], solid: c[`state.${tone}.solid`] };
}

/** A state in a word. The tone is never the only thing that says it: the text does. */
export function Badge({ children, tone = 'neutral', look = 'tint', style, ...rest }: BadgeProps) {
  const theme = useTheme();
  const { subtle, ink, solid } = toneColors(theme, tone);
  const dot = look === 'dot';
  const size = theme.size['space.2'];
  return (
    <View
      {...rest}
      style={[
        { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: theme.size['space.1'], paddingHorizontal: theme.size['space.2'], paddingVertical: theme.size['space.1'] / 2, borderRadius: theme.size['radius.pill'], backgroundColor: dot ? theme.color['surface.sunken'] : subtle },
        style,
      ]}
    >
      {dot && <View style={{ width: size, height: size, borderRadius: size, backgroundColor: solid }} />}
      <Text variant="caption" weight="medium" style={{ color: dot ? theme.color['text.default'] : ink }}>
        {children}
      </Text>
    </View>
  );
}
