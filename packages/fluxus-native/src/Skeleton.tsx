import { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, { ReduceMotion, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { motion } from './generated/tokens';
import { useTheme } from './theme';

export interface SkeletonProps extends Omit<ViewProps, 'style' | 'children'> {
  /** Default: the whole width. */
  width?: DimensionValue;
  /** Default: a line of body text. */
  height?: number;
  /** Default: `radius.1`. For an avatar, half its height. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** The shape of what is coming, breathing while it loads. Still with reduced motion; not there for a screen reader. */
export function Skeleton({ width = '100%', height, radius, style, ...rest }: SkeletonProps) {
  const theme = useTheme();
  const light = useSharedValue(1);
  useEffect(() => {
    light.value = withRepeat(withTiming(0.5, { duration: motion.duration.slow * 2 }), -1, true, undefined, ReduceMotion.System);
    return () => cancelAnimation(light);
  }, [light]);
  const breath = useAnimatedStyle(() => ({ opacity: light.value }));
  return <Animated.View aria-hidden importantForAccessibility="no-hide-descendants" {...rest} style={[{ width, height: height ?? theme.size['type.body.size'], borderRadius: radius ?? theme.size['radius.1'], backgroundColor: theme.color['surface.sunken'] }, style, breath]} />;
}
