/**
 * A number with a short run, set by sliding. It takes the touch with React Native's own responder, not with
 * react-native-gesture-handler: its 2 and its 3 have different APIs, and this works with both and with none.
 * A screen reader moves it a step at a time. (SPEC §15.7)
 */
import { useEffect, useRef, useState } from 'react';
import { I18nManager, View, type GestureResponderEvent, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useControlled } from './controls';
import { spring } from './motion';
import { useTheme } from './theme';

export interface SliderProps extends Omit<ViewProps, 'children' | 'style'> {
  /** What it sets, for a screen reader. */
  label: string;
  /** Default: 0. */
  min?: number;
  /** Default: 100. */
  max?: number;
  /** Default: 1. */
  step?: number;
  value?: number;
  defaultValue?: number;
  /** On every step, while it slides too. */
  onChange?: (value: number) => void;
  /** What a screen reader says for a value: «0,8 ×», «3 de 5». Default: the number. */
  valueText?: (value: number) => string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Slider({ label, min = 0, max = 100, step = 1, value, defaultValue, onChange, valueText, disabled = false, style, ...rest }: SliderProps) {
  const theme = useTheme();
  const c = theme.color;
  const [now, set] = useControlled(value, defaultValue ?? min, onChange);
  const [width, setWidth] = useState(0);
  const left = useRef<number | null>(null);
  const dragging = useRef(false);
  const part = max > min ? Math.min(1, Math.max(0, (now - min) / (max - min))) : 0;
  const at = useSharedValue(part);
  useEffect(() => {
    // Under the finger it goes with it; a step from elsewhere travels on the spring.
    at.value = dragging.current ? part : spring(part, 'snappy');
  }, [part, at]);

  const thumb = theme.size['control.h.sm'];
  const rail = theme.size['space.1'];
  const run = Math.max(0, width - thumb);
  const way = I18nManager.isRTL ? -1 : 1;
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: way * at.value * run }] }));
  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: `${-way * (1 - at.value) * 100}%` }] }));

  const snap = (ratio: number): number => {
    const raw = min + Math.min(1, Math.max(0, ratio)) * (max - min);
    return Math.min(max, Math.max(min, Number((Math.round((raw - min) / step) * step + min).toFixed(6))));
  };
  const follow = (e: GestureResponderEvent): void => {
    // The point is in the window; where the track starts in it is measured when the touch begins.
    const x = left.current === null ? e.nativeEvent.locationX : e.nativeEvent.pageX - left.current;
    const ratio = run ? (x - thumb / 2) / run : 0;
    const next = snap(I18nManager.isRTL ? 1 - ratio : ratio);
    if (next !== now) set(next);
  };
  const nudge = (by: number): void => set(snap((now + by * step - min) / (max - min)));

  return (
    <View
      accessible
      role="slider"
      aria-label={label}
      aria-disabled={disabled}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={now}
      aria-valuetext={valueText?.(now)}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => !disabled && nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      {...rest}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !disabled}
      // Once it has the touch it keeps it: a list that scrolls does not take it away halfway.
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        dragging.current = true;
        left.current = null;
        const first = e;
        (e.currentTarget as unknown as { measureInWindow?: (done: (x: number) => void) => void } | null)?.measureInWindow?.((x) => {
          left.current = x;
        });
        follow(first);
      }}
      onResponderMove={follow}
      onResponderRelease={() => {
        dragging.current = false;
      }}
      onResponderTerminate={() => {
        dragging.current = false;
      }}
      style={[{ height: theme.size['target.min'], justifyContent: 'center', opacity: disabled ? 0.5 : 1 }, style]}
    >
      <View style={{ height: rail, marginInline: thumb / 2, borderRadius: rail, backgroundColor: c['surface.sunken'], overflow: 'hidden' }}>
        <Animated.View style={[{ height: rail, borderRadius: rail, backgroundColor: c['accent.default'] }, fill]} />
      </View>
      <Animated.View style={[{ position: 'absolute', start: 0, width: thumb, height: thumb, borderRadius: thumb, borderWidth: 1, borderColor: c['border.control'], backgroundColor: c['surface.base'] }, knob]} />
    </View>
  );
}
