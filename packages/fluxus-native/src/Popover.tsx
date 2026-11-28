/**
 * A panel by what opened it: below if it fits, above if not, never off the screen. It grows from the corner
 * that touches its origin. `Menu` is this with rows to choose. (SPEC §15.8)
 */
import { cloneElement, useRef, useState, type ReactElement, type ReactNode, type Ref } from 'react';
import { I18nManager, ScrollView, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { floating, focusOn, Overlay } from './overlay';
import { useTheme } from './theme';

export type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Between it and its origin, and between it and the edge of the screen. */
const GAP = 4;
const MARGIN = 8;
const SMALL = 0.96;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

/** Where a panel of `size` goes by `anchor` in a `screen`, in the points of the window, and the corner it grows from. */
export function place(anchor: Rect, size: { width: number; height: number }, screen: { width: number; height: number }, placement: Placement = 'bottom-start', rtl = false): { left: number; top: number; origin: string } {
  const below = anchor.y + anchor.height + GAP;
  const above = anchor.y - GAP - size.height;
  const fitsBelow = below + size.height <= screen.height - MARGIN;
  const fitsAbove = above >= MARGIN;
  const up = placement.startsWith('top') ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
  // `end` is the right edge in a language written from the left, and the left one in the others.
  const right = placement.endsWith('end') !== rtl;
  return {
    left: clamp(right ? anchor.x + anchor.width - size.width : anchor.x, MARGIN, Math.max(MARGIN, screen.width - MARGIN - size.width)),
    top: clamp(up ? above : below, MARGIN, Math.max(MARGIN, screen.height - MARGIN - size.height)),
    origin: `${right ? 'right' : 'left'} ${up ? 'bottom' : 'top'}`,
  };
}

type Trigger = ReactElement<{ onPress?: (event: GestureResponderEvent) => unknown; ref?: Ref<unknown>; 'aria-expanded'?: boolean }>;

/** The trigger, opening what it opens, and where it is on the screen. Its own `onPress` and `ref` still work. */
export function useAnchored(trigger: Trigger, onOpenChange?: (open: boolean) => void) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const anchor = useRef<{ measureInWindow?: (done: (x: number, y: number, width: number, height: number) => void) => void } | null>(null);
  const set = (next: boolean): void => {
    setOpen(next);
    onOpenChange?.(next);
  };
  const own = trigger.props.ref;
  return {
    open,
    rect,
    close: (): void => {
      set(false);
      focusOn(anchor.current);
    },
    trigger: cloneElement(trigger, {
      'aria-expanded': open,
      ref: (node: unknown) => {
        anchor.current = node as typeof anchor.current;
        if (typeof own === 'function') own(node);
        else if (own) (own as { current: unknown }).current = node;
      },
      onPress: (event: GestureResponderEvent) => {
        trigger.props.onPress?.(event);
        // Where it was the last time is not where it is now: the screen may have scrolled.
        setRect(null);
        anchor.current?.measureInWindow?.((x, y, width, height) => setRect({ x, y, width, height }));
        set(true);
      },
    }),
  };
}

export interface FloatingProps {
  t: SharedValue<number>;
  rect: Rect | null;
  placement: Placement;
  role: 'dialog' | 'menu';
  label?: string;
  /** Around what it holds. Default: none. */
  padding?: number;
  children: ReactNode;
  testID?: string;
}

/** The panel itself. Until it knows where its origin is and how big it is, it is not seen. */
export function Floating({ t, rect, placement, role, label, padding, children, testID }: FloatingProps) {
  const theme = useTheme();
  const screen = useWindowDimensions();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const at = rect && size ? place(rect, size, screen, placement, I18nManager.isRTL) : null;
  const ready = !!at;
  const grow = useAnimatedStyle(() => ({ opacity: ready ? t.value : 0, transform: [{ scale: SMALL + (1 - SMALL) * t.value }] }));
  return (
    <Animated.View
      role={role}
      aria-label={label}
      testID={testID}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      // `left` and `top`: the points of the window, not the direction of the language.
      style={[floating(theme), { position: 'absolute', left: at?.left ?? 0, top: at?.top ?? 0, minWidth: Math.min(rect?.width ?? 0, screen.width - 2 * MARGIN), maxWidth: screen.width - 2 * MARGIN, maxHeight: screen.height - 2 * MARGIN, overflow: 'hidden', transformOrigin: at?.origin }, grow]}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding }}>
        {children}
      </ScrollView>
    </Animated.View>
  );
}

export interface PopoverProps {
  /** What opens it: something that is pressed and takes a `ref`, as a Button. */
  trigger: Trigger;
  /** What it holds; as a function, it is given what closes it. */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Its name, for a screen reader. */
  label: string;
  /** Default: 'bottom-start'. It goes to the other side when it does not fit. */
  placement?: Placement;
  onOpenChange?: (open: boolean) => void;
  testID?: string;
}

/** A small panel with anything in it, by what opened it. A press outside closes it. */
export function Popover({ trigger, children, label, placement = 'bottom-start', onOpenChange, testID }: PopoverProps) {
  const theme = useTheme();
  const anchored = useAnchored(trigger, onOpenChange);
  return (
    <>
      {anchored.trigger}
      <Overlay open={anchored.open} onClose={anchored.close} veil={false}>
        {(t) => (
          <Floating t={t} rect={anchored.rect} placement={placement} role="dialog" label={label} padding={theme.size['space.3']} testID={testID}>
            {typeof children === 'function' ? children(anchored.close) : children}
          </Floating>
        )}
      </Overlay>
    </>
  );
}
