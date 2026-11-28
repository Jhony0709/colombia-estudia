/**
 * A message of a chat: on the side of who wrote it, never wider than most of the screen, with who above and
 * when below. A plain view: a chat has many, and one that arrives is wrapped in `Appear`. (SPEC §15.10)
 */
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export interface BubbleProps extends Omit<ViewProps, 'style'> {
  /** 'start': what arrives. 'end': one's own. */
  side: 'start' | 'end';
  /** Who wrote it, above. */
  author?: string;
  /** When, or whether it was read, below. */
  meta?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** How much of the width it may take. */
const WIDEST = '88%';

export function Bubble({ side, author, meta, children, style, ...rest }: BubbleProps) {
  const theme = useTheme();
  const own = side === 'end';
  const radius = theme.size['radius.card'];
  const corner = theme.size['radius.1'];
  return (
    <View
      {...rest}
      style={[
        { alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: WIDEST, gap: theme.size['space.1'], padding: theme.size['space.3'], borderWidth: 1, borderRadius: radius },
        // The corner of its side is tighter: it says whose it is without a tail.
        own ? { borderBottomEndRadius: corner, borderColor: 'transparent', backgroundColor: theme.color['accent.subtle'] } : { borderBottomStartRadius: corner, borderColor: theme.color['border.default'], backgroundColor: theme.color['surface.raised'] },
        style,
      ]}
    >
      {author !== undefined && (
        <Text variant="caption" weight="medium" tone="muted">
          {author}
        </Text>
      )}
      {typeof children === 'string' ? <Text>{children}</Text> : children}
      {meta !== undefined && (
        <Text variant="caption" tone="muted" style={{ alignSelf: 'flex-end' }}>
          {meta}
        </Text>
      )}
    </View>
  );
}
