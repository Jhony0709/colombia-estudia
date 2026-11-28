import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from './theme';

/**
 * For what takes the room left in a row. Not `flex: 1`: that has no width of its own, and in what is only as
 * wide as what it holds (a menu, a popover) the text would break letter by letter. (SPEC §15.8)
 */
export const fill: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' };

/** A step of the space scale: `space.3` is 12 points. */
export type Space = '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12' | '16';

export interface StackProps extends ViewProps {
  gap?: Space;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
}

/** What it holds, one under the other. */
export function Stack({ gap = '3', align, justify, style, ...rest }: StackProps) {
  const theme = useTheme();
  return <View {...rest} style={[{ gap: theme.size[`space.${gap}`], alignItems: align, justifyContent: justify }, style]} />;
}

export interface RowProps extends StackProps {
  /** It goes on to the next line when it does not fit. */
  wrap?: boolean;
}

/** What it holds, side by side, in the direction of the language. */
export function Row({ gap = '2', align = 'center', justify, wrap, style, ...rest }: RowProps) {
  const theme = useTheme();
  return <View {...rest} style={[{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: theme.size[`space.${gap}`], alignItems: align, justifyContent: justify }, style]} />;
}

/** A rule between two things. It is not there for a screen reader. */
export function Divider({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return <View aria-hidden importantForAccessibility="no" {...rest} style={[{ height: 1, backgroundColor: theme.color['border.default'] }, style]} />;
}
