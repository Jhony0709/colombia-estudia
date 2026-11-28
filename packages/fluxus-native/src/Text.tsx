import type { ComponentRef, Ref } from 'react';
import { Text as NativeText, type TextProps as NativeTextProps, type TextStyle } from 'react-native';
import { useTheme, type Theme } from './theme';

export type TextVariant = 'display' | 'heading' | 'title' | 'body' | 'label' | 'caption';
export type TextWeight = 'regular' | 'medium' | 'bold';
export type TextTone = 'default' | 'muted' | 'accent' | 'disabled' | 'on-accent' | 'inverse';

export interface TextProps extends Omit<NativeTextProps, 'ref'> {
  /** Its place in the type scale. Default: 'body'. (`role` is taken: it is the ARIA role of React Native.) */
  variant?: TextVariant;
  /** Default: 'default'. */
  tone?: TextTone;
  /** Default: the one of its variant. */
  weight?: TextWeight;
  ref?: Ref<ComponentRef<typeof NativeText>>;
}

const TITLES: readonly TextVariant[] = ['display', 'heading', 'title'];

/** The family and the weight of a face: the app's own font if it loaded one for that weight. */
const face = (theme: Theme, weight: TextWeight): TextStyle => {
  const own = theme.font?.[weight];
  if (own) return { fontFamily: own };
  return { fontFamily: theme.font?.regular, fontWeight: theme.weight[`font.weight.${weight}`] as TextStyle['fontWeight'] };
};

/** The style of a variant: its size, its line and its weight, from the theme. */
export function textStyle(theme: Theme, variant: TextVariant = 'body', tone: TextTone = 'default', weight?: TextWeight): TextStyle {
  const size = theme.size[`type.${variant}.size`];
  const title = TITLES.includes(variant);
  return {
    color: theme.color[`text.${tone}`],
    fontSize: size,
    lineHeight: Math.round(size * theme.number[title ? 'type.heading.line' : 'type.body.line']),
    ...face(theme, weight ?? (title ? 'bold' : variant === 'label' ? 'medium' : 'regular')),
  };
}

/** Text in one of the six variants of the type scale; a title is a heading for a screen reader. It scales with the system's text size. */
export function Text({ variant = 'body', tone = 'default', weight, style, ...rest }: TextProps) {
  const theme = useTheme();
  return <NativeText role={TITLES.includes(variant) ? 'heading' : undefined} {...rest} style={[textStyle(theme, variant, tone, weight), style]} />;
}
