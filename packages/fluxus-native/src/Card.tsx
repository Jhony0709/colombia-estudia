import type { ComponentRef, ReactNode, Ref } from 'react';
import { Pressable, View, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAsyncPress, usePending } from './pending';
import { usePress } from './press';
import { useTheme, type Theme } from './theme';

export interface CardProps extends Omit<PressableProps, 'children' | 'style' | 'ref' | 'onPress'> {
  /** If it returns a promise, the card waits for it: it fills from where it was pressed. */
  onPress?: (event: GestureResponderEvent) => void | Promise<unknown>;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<ComponentRef<typeof Pressable>>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const cardStyle = (theme: Theme): ViewStyle => ({
  padding: theme.size['card.pad'],
  borderWidth: 1,
  borderColor: theme.color['card.border'],
  borderRadius: theme.size['card.radius'],
  backgroundColor: theme.color['card.bg'],
});

/**
 * A surface. With `onPress` it is one button that gives when pressed, and a screen reader reads it whole.
 * Without, it is a plain view: what it holds is reached piece by piece.
 */
export function Card({ children, style, onPress, onPressIn, onPressOut, onLayout, ...rest }: CardProps) {
  const theme = useTheme();
  const press = usePress({ onPressIn, onPressOut });
  const [waiting, run, failed] = useAsyncPress(onPress);
  const pending = usePending(waiting, theme.color['text.default'], failed);
  if (!onPress) {
    const { ref, testID } = rest;
    return (
      <View ref={ref} testID={testID} style={[cardStyle(theme), style]}>
        {children}
      </View>
    );
  }
  return (
    <AnimatedPressable
      role="button"
      {...rest}
      disabled={!!rest.disabled || waiting}
      aria-busy={waiting}
      onPress={run}
      onLayout={(e) => {
        pending.onLayout(e);
        onLayout?.(e);
      }}
      onPressIn={(e) => {
        pending.onPressIn(e);
        press.onPressIn(e);
      }}
      onPressOut={press.onPressOut}
      style={[cardStyle(theme), { overflow: 'hidden' }, style, press.style]}
    >
      {pending.fill}
      {children}
    </AnimatedPressable>
  );
}
