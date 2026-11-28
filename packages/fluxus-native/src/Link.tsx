/**
 * A link in text: the colour of the accent, underlined, and a link for a screen reader. Alone it is pressed
 * with a target of 44 points; `inline`, it is part of a sentence. Pressed, it fades a little, and stays so
 * while what its press returned is not settled: nothing moves. (SPEC §15.10, §15.11)
 */
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useAsyncPress } from './pending';
import { Text, textStyle, type TextProps, type TextVariant } from './Text';
import { useTheme } from './theme';

export interface LinkProps extends Omit<TextProps, 'onPress' | 'style' | 'role'> {
  children: ReactNode;
  /** An address the system opens. For the browser of the app, or a screen of the app, use `onPress`. */
  href?: string;
  /** If it returns a promise, the link waits for it: faded, and taking no other press. */
  onPress?: () => void | Promise<unknown>;
  /** Inside a sentence: a nested text, with the line it is in. Default: false, an element of its own. */
  inline?: boolean;
  /** Default: 'body'. */
  variant?: TextVariant;
  /** The style of the text. */
  style?: StyleProp<TextStyle>;
}

/** How much of it is seen while it is pressed, or waits. */
const FADED = 0.6;

export function Link({ children, href, onPress, inline = false, variant, style, testID, ...rest }: LinkProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  // Opening an address is waited for too: two presses do not open it twice.
  const [waiting, run] = useAsyncPress<void>(() => {
    const result = onPress?.();
    return href ? Promise.all([result, Linking.openURL(href)]) : result;
  });
  const go = (): void => {
    if (!waiting) run();
  };
  const ink: TextStyle = { color: theme.color['text.accent'], textDecorationLine: 'underline' };
  if (inline) {
    return (
      <Text role="link" aria-busy={waiting} disabled={waiting} suppressHighlighting variant={variant} testID={testID} {...rest} onPress={go} style={[ink, waiting ? { opacity: FADED } : null, style]}>
        {children}
      </Text>
    );
  }
  // The text may be lower than a finger: the rest of the 44 points is around it, and takes no room.
  const slop = Math.max(0, (theme.size['target.min'] - (textStyle(theme, variant).lineHeight ?? 0)) / 2);
  const ring: ViewStyle | null = focused ? { outlineStyle: 'solid', outlineWidth: theme.size['focus.width'], outlineOffset: theme.size['focus.offset'], outlineColor: theme.color['focus.ring'] } : null;
  return (
    // In a column it would be as wide as the column, and pressed where there is no text: it stays as wide as its text, in a row of its own.
    <View style={{ flexDirection: 'row' }}>
      <Pressable role="link" aria-busy={waiting} disabled={waiting} testID={testID} hitSlop={slop} onPress={go} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => [{ flexShrink: 1, borderRadius: theme.size['radius.1'], opacity: pressed || waiting ? FADED : 1 }, ring]}>
        <Text variant={variant} {...rest} style={[ink, style]}>
          {children}
        </Text>
      </Pressable>
    </View>
  );
}
