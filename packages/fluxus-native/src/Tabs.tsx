import { useEffect, useState } from 'react';
import { I18nManager, Pressable, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { spring } from './motion';
import { usePending } from './pending';
import { Text } from './Text';
import { useTheme } from './theme';

export interface TabItem {
  key: string;
  label: string;
}

export interface TabsProps extends Omit<ViewProps, 'style' | 'children'> {
  items: readonly TabItem[];
  /** The key of the chosen one. */
  value: string;
  /** If it returns a promise, the pressed tab waits for it: the mark goes to it at once, and it fills. If it fails, the mark goes back. */
  onChange: (key: string) => void | Promise<unknown>;
  /** The name of the group, for a screen reader. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

function Tab({ label, on, waiting, failed, height, onPress }: { label: string; on: boolean; waiting: boolean; failed: boolean; height: number; onPress: () => void }) {
  const theme = useTheme();
  const pending = usePending(waiting, theme.color['text.default'], failed);
  return (
    <Pressable
      role="tab"
      aria-selected={on}
      aria-busy={waiting}
      onPress={onPress}
      onPressIn={pending.onPressIn}
      onLayout={pending.onLayout}
      hitSlop={Math.max(0, (theme.size['target.min'] - height) / 2)}
      style={{ flex: 1, minHeight: height, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: theme.size['radius.control'], paddingInline: theme.size['space.2'] }}
    >
      {pending.fill}
      <Text variant="label" tone={on ? 'default' : 'muted'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A few views of the same thing, one chosen. The mark slides to it on the smooth spring, moving only its transform. */
export function Tabs({ items, value, onChange, label, style, ...rest }: TabsProps) {
  const theme = useTheme();
  const pad = theme.size['space.1'] / 2;
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  // The pressed tab is marked at once, as on the web: it does not wait for the answer to look chosen.
  const index = Math.max(0, items.findIndex((i) => i.key === (waitingFor ?? value)));
  const choose = (key: string): void => {
    const result = onChange(key) as PromiseLike<unknown> | undefined;
    if (typeof result?.then !== 'function') return;
    setWaitingFor(key);
    setFailedFor(null);
    const done = (): void => setWaitingFor((now) => (now === key ? null : now));
    result.then(done, () => {
      done();
      setFailedFor(key);
    });
  };
  const [width, setWidth] = useState(0);
  const step = items.length ? (width - 2 * pad) / items.length : 0;
  const at = useSharedValue(index);
  useEffect(() => {
    at.value = spring(index, 'smooth');
  }, [index, at]);
  // In a language written from the right, the first tab is at the right.
  const way = I18nManager.isRTL ? -1 : 1;
  const mark = useAnimatedStyle(() => ({ transform: [{ translateX: way * at.value * step }] }));
  const height = theme.size['control.h.md'];
  return (
    <View role="tablist" aria-label={label} {...rest} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[{ flexDirection: 'row', padding: pad, borderRadius: theme.size['radius.control'], backgroundColor: theme.color['surface.sunken'] }, style]}>
      {step > 0 && <Animated.View style={[{ position: 'absolute', top: pad, bottom: pad, start: pad, width: step, borderRadius: theme.size['radius.control'] - pad, backgroundColor: theme.color['surface.raised'] }, mark]} />}
      {items.map((item) => (
        <Tab key={item.key} label={item.label} on={item.key === (waitingFor ?? value)} waiting={item.key === waitingFor} failed={item.key === failedFor} height={height - 2 * pad} onPress={() => choose(item.key)} />
      ))}
    </View>
  );
}
