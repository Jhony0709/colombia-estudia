/**
 * A title that shows or hides what is under it. The one piece that animates a height: what is below it has to
 * travel with it, whatever it is. One at a time, and by a press. `Accordion` is a group of them. (SPEC §15.8)
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useControlled } from './controls';
import { Divider, fill } from './layout';
import { spring } from './motion';
import { Text } from './Text';
import { useTheme } from './theme';

/** An arrow drawn with two edges, without an icon: it points down at 0 and up at 1. */
export function Chevron({ t, color }: { t?: SharedValue<number>; color?: string }) {
  const theme = useTheme();
  const side = theme.size['space.2'];
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${45 + 180 * (t?.value ?? 0)}deg` }] }));
  const edges: ViewStyle = { width: side, height: side, borderColor: color ?? theme.color['text.muted'], borderEndWidth: 2, borderBottomWidth: 2 };
  return (
    <View aria-hidden importantForAccessibility="no" style={{ width: theme.size['icon.md'], height: theme.size['icon.md'], alignItems: 'center', justifyContent: 'center' }}>
      {/* One that never turns is not an animated view. */}
      {t ? <Animated.View style={[edges, turn]} /> : <View style={[edges, { transform: [{ rotate: '45deg' }] }]} />}
    </View>
  );
}

export interface DisclosureProps {
  title: string;
  children: ReactNode;
  /** It holds its own state from here. Default: false. */
  defaultOpen?: boolean;
  /** Or the app does. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Disclosure({ title, children, defaultOpen = false, open, onOpenChange, style, testID }: DisclosureProps) {
  const theme = useTheme();
  const [on, set] = useControlled(open, defaultOpen, onOpenChange);
  const [height, setHeight] = useState(0);
  const t = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    t.value = spring(on ? 1 : 0, 'smooth');
  }, [on, t]);
  // Until it is measured, an open one is as tall as what it holds and a closed one has no height.
  const body = useAnimatedStyle(() => (height ? { opacity: t.value, height: height * t.value } : { opacity: t.value }));
  const measured = height > 0 || !on;
  return (
    <View style={style}>
      <Pressable
        role="button"
        aria-expanded={on}
        testID={testID}
        onPress={() => set(!on)}
        style={({ pressed }) => [{ minHeight: theme.size['target.min'], flexDirection: 'row', alignItems: 'center', gap: theme.size['space.3'], paddingBlock: theme.size['space.2'] }, pressed ? { backgroundColor: theme.color['surface.hover'] } : null]}
      >
        <Text variant="label" style={fill}>
          {title}
        </Text>
        <Chevron t={t} />
      </Pressable>
      <Animated.View aria-hidden={!on} pointerEvents={on ? 'auto' : 'none'} style={[{ overflow: 'hidden' }, height || on ? null : { height: 0 }, body]}>
        <View onLayout={(e) => setHeight(e.nativeEvent.layout.height)} style={[{ paddingBottom: theme.size['space.3'] }, measured ? { position: 'absolute', top: 0, start: 0, end: 0 } : null]}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

export interface AccordionItem {
  key: string;
  title: string;
  content: ReactNode;
}

export interface AccordionProps extends Omit<ViewProps, 'children'> {
  items: readonly AccordionItem[];
  /** Several may be open at once. Default: opening one closes the others. */
  multiple?: boolean;
  /** The keys of the ones open at first. */
  defaultOpen?: readonly string[];
  onChange?: (open: readonly string[]) => void;
}

export function Accordion({ items, multiple = false, defaultOpen = [], onChange, ...rest }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = (key: string, on: boolean): void => {
    const next = on ? (multiple ? [...open, key] : [key]) : open.filter((k) => k !== key);
    setOpen(next);
    onChange?.(next);
  };
  return (
    <View {...rest}>
      {items.map((item, index) => (
        <View key={item.key}>
          {index > 0 && <Divider />}
          <Disclosure title={item.title} open={open.includes(item.key)} onOpenChange={(on) => toggle(item.key, on)}>
            {item.content}
          </Disclosure>
        </View>
      ))}
    </View>
  );
}
