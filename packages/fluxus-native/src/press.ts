import type { GestureResponderEvent, PressableProps } from 'react-native';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { spring } from './motion';

/** As the web (core/src/press.ts): what is pressed gives a little, on the snappy spring. */
const PRESSED = 0.97;

/** The style and the two handlers of something that gives when pressed; the handlers of the app still run. */
export function usePress({ onPressIn, onPressOut }: Pick<PressableProps, 'onPressIn' | 'onPressOut'>) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: (e: GestureResponderEvent) => {
      scale.value = spring(PRESSED, 'snappy');
      onPressIn?.(e);
    },
    onPressOut: (e: GestureResponderEvent) => {
      scale.value = spring(1, 'snappy');
      onPressOut?.(e);
    },
  };
}
