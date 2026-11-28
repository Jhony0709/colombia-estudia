import { Image, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export interface AvatarProps extends Omit<ViewProps, 'style' | 'children'> {
  /** Gives the initials. */
  name: string;
  /** A picture over the initials. */
  src?: string;
  /** Who it is, for a screen reader. Without it the avatar is decoration: the name is usually beside it. */
  label?: string;
  /** Default: 'md'. */
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

/** As the web: the first letter of the first two words that start with a letter or a figure. */
export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toUpperCase();

/** Who someone is, in a circle: the picture, or the initials. */
export function Avatar({ name, src, label, size = 'md', style, ...rest }: AvatarProps) {
  const theme = useTheme();
  const side = theme.size[`control.h.${size}`];
  const a11y = label ? ({ accessible: true, role: 'img', 'aria-label': label } as const) : ({ 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants' } as const);
  return (
    <View {...a11y} {...rest} style={[{ width: side, height: side, borderRadius: side, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: theme.color['accent.subtle'] }, style]}>
      {src ? (
        <Image source={{ uri: src }} style={{ width: side, height: side }} />
      ) : (
        <Text variant={size === 'sm' ? 'caption' : 'label'} weight="medium" tone="accent" allowFontScaling={false}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
