import { useEffect } from 'react';
import { I18nManager, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { spring } from './motion';
import { useTheme } from './theme';

export interface ProgressProps extends Omit<ViewProps, 'style' | 'children'> {
  value: number;
  /** Default: 100. */
  max?: number;
  /** What advances, for a screen reader. */
  label: string;
  style?: StyleProp<ViewStyle>;
}

/** How far something has gone. The bar travels to a new value on the smooth spring, moving only its transform. */
export function Progress({ value, max = 100, label, style, ...rest }: ProgressProps) {
  const theme = useTheme();
  const part = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const shown = useSharedValue(part);
  useEffect(() => {
    shown.value = spring(part, 'smooth');
  }, [part, shown]);
  // The whole bar is there, and slides in from the side the language starts on: no layout on each frame.
  const from = I18nManager.isRTL ? 1 : -1;
  const bar = useAnimatedStyle(() => ({ transform: [{ translateX: `${from * (1 - shown.value) * 100}%` }] }));
  const height = theme.size['space.2'];
  return (
    <View accessible role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(max, Math.max(0, value))} {...rest} style={[{ height, borderRadius: height, backgroundColor: theme.color['surface.sunken'], overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: theme.color['accent.default'] }, bar]} />
    </View>
  );
}
