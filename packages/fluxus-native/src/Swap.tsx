/**
 * What it shows gives way to what comes without a jump: the old dissolves, then the new condenses. In a browser
 * it loses focus too (`filter: blur`); on a phone React Native cannot animate a blur, and the veil of
 * `@fluxus-ui/native/blur` does it. With reduced motion the change is immediate. (SPEC §15.6)
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { motion } from './generated/tokens';
import { timing } from './motion';
import { presence } from './presence';

/** How small it gets as it goes, and how blurred in a browser. */
const SHRINK = 0.02;
const BLUR = 8;

/**
 * `content` is what to paint now, `t` goes 1 → 0 → 1 across a change, and `moving` is true while it does.
 * A change of `id` is a relay; a change of the children under the same `id` just shows.
 */
export function useSwap(id: string | number, children: ReactNode): { content: ReactNode; t: SharedValue<number>; moving: boolean } {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(id);
  const [moving, setMoving] = useState(false);
  const kept = useRef(children);
  const t = useSharedValue(1);
  if (id === shown) kept.current = children;
  const now = useRef(shown);
  now.current = shown;
  useEffect(() => {
    if (id === now.current) return;
    if (reduced) {
      setShown(id);
      return;
    }
    setMoving(true);
    t.value = timing(0, 'fast', 'accelerate');
    let last: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      setShown(id);
      t.value = timing(1, 'normal', 'decelerate');
      last = setTimeout(() => setMoving(false), motion.duration.normal);
    }, motion.duration.fast);
    return () => {
      clearTimeout(timer);
      clearTimeout(last);
    };
    // Only a new `id` starts a relay: showing it must not cut short the one under way.
  }, [id]);
  return { content: id === shown ? children : kept.current, t, moving };
}

export interface SwapProps extends Omit<ViewProps, 'style' | 'id'> {
  /** What is shown: when it changes, the old gives way to the new. */
  id: string | number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Swap({ id, children, style, ...rest }: SwapProps) {
  const { content, t } = useSwap(id, children);
  const web = Platform.OS === 'web';
  const body = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scale: 1 - SHRINK * (1 - t.value) }],
    ...(web ? { filter: `blur(${(1 - t.value) * BLUR}px)` } : null),
  }));
  // Its height changes with what it shows: what is below glides, where layout animations exist.
  return (
    <Animated.View layout={presence().layout} {...rest} style={[style, body]}>
      {content}
    </Animated.View>
  );
}
